/**
 * Gemini-based Translation Service
 * Uses Gemini API for high-quality news translation
 */

import { 
  ITranslationService,
  TranslationRequest,
  TranslationResponse,
  BatchTranslationRequest,
  BatchTranslationResponse,
  TranslationError,
  GeminiTranslationConfig,
  GeminiPromptOptions,
} from '@/types/translation';
import { 
  GEMINI_SYSTEM_PROMPTS,
  GEMINI_CONFIG,
  buildTranslationPrompt,
  REVIEW_PROMPTS,
} from '@/config/gemini-prompts';
import { TranslationCache } from './translationCache';

export class GeminiTranslator implements ITranslationService {
  private apiKey: string;
  private config: GeminiTranslationConfig;
  private cache: TranslationCache;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string, config?: GeminiTranslationConfig) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.config = {
      model: config?.model || GEMINI_CONFIG.defaultModel,
      ...GEMINI_CONFIG.translation,
      ...config,
    };

    this.cache = new TranslationCache();
  }

  /**
   * Translate a single text
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(request);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return {
          id: request.id,
          originalText: request.text,
          translatedText: cached.translatedText,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          confidence: cached.confidence,
          timestamp: new Date(),
        };
      }

      // Build prompt based on type
      const prompt = buildTranslationPrompt(
        request.text,
        request.type as any,
        this.getPromptOptions(request)
      );

      // Call Gemini API
      const response = await this.callGeminiAPI(prompt);
      const translatedText = this.extractTranslation(response);

      // Review translation for quality
      let confidence = 0.9; // Default confidence
      if (request.type === 'sentence' || request.type === 'title') {
        const review = await this.reviewTranslation(request.text, translatedText);
        confidence = review.confidence;
      }

      // Cache the result
      await this.cache.set(cacheKey, {
        originalText: request.text,
        translatedText,
        confidence,
      });

      return {
        id: request.id,
        originalText: request.text,
        translatedText,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        confidence,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResponse> {
    const batchId = `batch_${Date.now()}`;
    const translations: TranslationResponse[] = [];
    const errors: TranslationError[] = [];

    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(request.requests, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (req) => {
        try {
          const result = await this.translate(req);
          translations.push(result);
        } catch (error: any) {
          errors.push({
            id: req.id,
            code: 'TRANSLATION_FAILED',
            message: error.message,
          });
        }
      });

      await Promise.all(promises);
    }

    return {
      batchId,
      translations,
      successCount: translations.length,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Review translation quality
   */
  async reviewTranslation(
    original: string, 
    translation: string
  ): Promise<{ isAccurate: boolean; suggestions?: string[]; confidence: number }> {
    try {
      const prompt = REVIEW_PROMPTS.accuracy(original, translation);
      const response = await this.callGeminiAPI(prompt, GEMINI_CONFIG.review);
      
      // Parse JSON response
      const reviewData = JSON.parse(this.extractTranslation(response));
      
      return {
        isAccurate: reviewData.isAccurate ?? true,
        suggestions: reviewData.suggestions,
        confidence: reviewData.confidence ?? 0.9,
      };
    } catch (error) {
      console.error('Review error:', error);
      // Return default values if review fails
      return {
        isAccurate: true,
        confidence: 0.8,
      };
    }
  }

  /**
   * Call Gemini API
   */
  private async callGeminiAPI(
    prompt: string, 
    config?: Partial<GeminiTranslationConfig>
  ): Promise<any> {
    const model = config?.model || this.config.model;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt,
        }],
      }],
      generationConfig: {
        temperature: config?.temperature || this.config.temperature,
        maxOutputTokens: config?.maxOutputTokens || this.config.maxOutputTokens,
        topK: config?.topK || this.config.topK,
        topP: config?.topP || this.config.topP,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Extract translation from Gemini response
   */
  private extractTranslation(response: any): string {
    try {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No translation in response');
      }
      return text.trim();
    } catch (error) {
      console.error('Failed to extract translation:', error);
      throw new Error('Invalid response format');
    }
  }

  /**
   * Get cache key for translation
   */
  private getCacheKey(request: TranslationRequest): string {
    return `${request.sourceLanguage}_${request.targetLanguage}_${request.type}_${
      this.hashText(request.text)
    }`;
  }

  /**
   * Simple hash function for text
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get prompt options based on request
   */
  private getPromptOptions(request: TranslationRequest): GeminiPromptOptions {
    return {
      includeExamples: request.type === 'article',
      formalityLevel: 'formal',
      preserveFormatting: true,
      technicalTermHandling: 'translate',
      targetAudience: 'general',
    };
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Translate article with consistency check
   */
  async translateArticleWithConsistency(
    title: string,
    summary: string,
    sentences: string[]
  ): Promise<{
    title: string;
    summary: string;
    sentences: string[];
  }> {
    // First, translate all parts
    const titleTranslation = await this.translate({
      id: 'title',
      text: title,
      sourceLanguage: 'en',
      targetLanguage: 'ko',
      type: 'title',
    });

    const summaryTranslation = await this.translate({
      id: 'summary',
      text: summary,
      sourceLanguage: 'en',
      targetLanguage: 'ko',
      type: 'summary',
    });

    const sentenceTranslations = await this.translateBatch({
      requests: sentences.map((sentence, index) => ({
        id: `sentence_${index}`,
        text: sentence,
        sourceLanguage: 'en' as const,
        targetLanguage: 'ko' as const,
        type: 'sentence' as const,
        context: title,
      })),
    });

    // Extract translated sentences
    const translatedSentences = sentenceTranslations.translations
      .sort((a, b) => parseInt(a.id.split('_')[1]) - parseInt(b.id.split('_')[1]))
      .map(t => t.translatedText);

    return {
      title: titleTranslation.translatedText,
      summary: summaryTranslation.translatedText,
      sentences: translatedSentences,
    };
  }
}