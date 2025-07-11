/**
 * Gemini Translation Service
 * Handles English to Korean translation with caching using Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { config } from '@/lib/env';

interface TranslationOptions {
  from?: string;
  to?: string;
  format?: 'text' | 'html';
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  cached?: boolean;
}

interface BatchTranslationRequest {
  texts: string[];
  options?: TranslationOptions;
}

export class GeminiTranslator {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor() {
    const apiKey = config.api.geminiApiKey;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Translate single text
   */
  async translateText(
    text: string, 
    options: TranslationOptions = {}
  ): Promise<TranslationResult> {
    const { from = 'en', to = 'ko', format = 'text' } = options;

    // Check cache first
    if (this.cacheEnabled) {
      const cached = await this.getCachedTranslation(text, from, to);
      if (cached) {
        return {
          translatedText: cached,
          cached: true,
        };
      }
    }

    try {
      // Create translation prompt
      const prompt = this.createTranslationPrompt(text, from, to);
      
      // Generate translation
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const translation = response.text().trim();

      // Cache the translation
      if (this.cacheEnabled) {
        await this.cacheTranslation(text, translation, from, to);
      }

      return {
        translatedText: translation,
        detectedSourceLanguage: from,
        cached: false,
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Failed to translate text: ${error.message}`);
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    texts: string[], 
    options: TranslationOptions = {}
  ): Promise<TranslationResult[]> {
    const { from = 'en', to = 'ko' } = options;

    // Check cache for all texts
    const cacheResults = await Promise.all(
      texts.map(text => this.getCachedTranslation(text, from, to))
    );

    // Separate cached and uncached texts
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    const results: TranslationResult[] = [];

    texts.forEach((text, index) => {
      if (cacheResults[index]) {
        results[index] = {
          translatedText: cacheResults[index]!,
          cached: true,
        };
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(index);
      }
    });

    // Translate uncached texts if any
    if (uncachedTexts.length > 0) {
      try {
        // Create batch translation prompt
        const prompt = this.createBatchTranslationPrompt(uncachedTexts, from, to);
        
        // Generate translations
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const translationsText = response.text();
        
        // Parse translations
        const translations = this.parseBatchTranslations(translationsText);

        // Process translations
        for (let i = 0; i < uncachedTexts.length; i++) {
          const originalIndex = uncachedIndices[i];
          const translation = translations[i] || `[Translation failed: ${uncachedTexts[i]}]`;

          results[originalIndex] = {
            translatedText: translation,
            cached: false,
          };

          // Cache the translation
          if (this.cacheEnabled) {
            await this.cacheTranslation(
              uncachedTexts[i], 
              translation, 
              from, 
              to
            );
          }
        }
      } catch (error) {
        console.error('Batch translation error:', error);
        throw new Error(`Failed to translate batch: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Translate article with all its content
   */
  async translateArticle(articleId: string): Promise<{
    title: string;
    summary: string;
    sentences: Array<{ id: string; translation: string }>;
  }> {
    // Fetch article with sentences
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        sentences: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!article) {
      throw new Error('Article not found');
    }

    // Prepare texts for batch translation
    const textsToTranslate = [
      article.title,
      article.summary,
      ...article.sentences.map(s => s.text),
    ];

    // Translate all texts
    const translations = await this.translateBatch(textsToTranslate);

    // Update article with translations
    await prisma.article.update({
      where: { id: articleId },
      data: {
        titleKo: translations[0].translatedText,
        summaryKo: translations[1].translatedText,
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    // Update sentences with translations
    const sentenceTranslations = await Promise.all(
      article.sentences.map(async (sentence, index) => {
        const translation = translations[index + 2].translatedText;
        
        await prisma.sentence.update({
          where: { id: sentence.id },
          data: { translation },
        });

        return {
          id: sentence.id,
          translation,
        };
      })
    );

    return {
      title: translations[0].translatedText,
      summary: translations[1].translatedText,
      sentences: sentenceTranslations,
    };
  }

  /**
   * Create translation prompt for Gemini
   */
  private createTranslationPrompt(text: string, from: string, to: string): string {
    const langMap = {
      en: 'English',
      ko: 'Korean',
      ja: 'Japanese',
      zh: 'Chinese',
      es: 'Spanish',
      fr: 'French',
    };

    const fromLang = langMap[from] || from;
    const toLang = langMap[to] || to;

    return `Translate the following ${fromLang} text to ${toLang}. 
Provide only the translated text without any explanations or additional content.
Preserve the original meaning and tone as much as possible.

Text to translate:
${text}

Translation:`;
  }

  /**
   * Create batch translation prompt
   */
  private createBatchTranslationPrompt(texts: string[], from: string, to: string): string {
    const langMap = {
      en: 'English',
      ko: 'Korean',
      ja: 'Japanese',
      zh: 'Chinese',
      es: 'Spanish',
      fr: 'French',
    };

    const fromLang = langMap[from] || from;
    const toLang = langMap[to] || to;

    const numberedTexts = texts.map((text, i) => `${i + 1}. ${text}`).join('\n');

    return `Translate the following ${fromLang} texts to ${toLang}.
For each numbered text, provide the translation on a new line with the same number.
Provide only the translations without any explanations.
Preserve the original meaning and tone.

Texts to translate:
${numberedTexts}

Translations:`;
  }

  /**
   * Parse batch translations from Gemini response
   */
  private parseBatchTranslations(response: string): string[] {
    const lines = response.split('\n').filter(line => line.trim());
    const translations: string[] = [];

    for (const line of lines) {
      // Match numbered format: "1. Translation text"
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        translations.push(match[1].trim());
      }
    }

    return translations;
  }

  /**
   * Get cached translation
   */
  private async getCachedTranslation(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string | null> {
    const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage);
    
    try {
      const cached = await prisma.cache.findUnique({
        where: { key: cacheKey },
      });

      if (cached && cached.expires_at > new Date()) {
        // Parse the cached value
        const data = cached.value as any;
        return data.translation;
      }
    } catch (error) {
      console.error('Cache retrieval error:', error);
    }

    return null;
  }

  /**
   * Cache translation
   */
  private async cacheTranslation(
    text: string,
    translation: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(text, sourceLanguage, targetLanguage);
    const expiresAt = new Date(Date.now() + this.cacheTTL);

    try {
      await prisma.cache.upsert({
        where: { key: cacheKey },
        update: {
          value: { text, translation, sourceLanguage, targetLanguage },
          expires_at: expiresAt,
        },
        create: {
          key: cacheKey,
          value: { text, translation, sourceLanguage, targetLanguage },
          expires_at: expiresAt,
        },
      });

      // Also track in cache entry for statistics
      await prisma.cacheEntry.upsert({
        where: { key: cacheKey },
        update: {
          hits: { increment: 1 },
          lastAccessed: new Date(),
          expiresAt,
        },
        create: {
          key: cacheKey,
          type: 'TRANSLATION',
          size: Buffer.byteLength(translation, 'utf8'),
          expiresAt,
        },
      });
    } catch (error) {
      console.error('Cache storage error:', error);
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${sourceLanguage}:${targetLanguage}:${text}`)
      .digest('hex');
    return `translation:${hash}`;
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    const result = await prisma.cache.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });

    await prisma.cacheEntry.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Get translation statistics
   */
  async getStatistics(): Promise<{
    totalTranslations: number;
    cachedTranslations: number;
    cacheHitRate: number;
    averageTranslationSize: number;
  }> {
    const stats = await prisma.cacheEntry.aggregate({
      where: { type: 'TRANSLATION' },
      _count: true,
      _sum: { hits: true, size: true },
      _avg: { size: true },
    });

    const totalTranslations = stats._count;
    const cachedHits = stats._sum.hits || 0;
    const totalSize = stats._sum.size || 0;
    const avgSize = stats._avg.size || 0;

    return {
      totalTranslations,
      cachedTranslations: cachedHits,
      cacheHitRate: totalTranslations > 0 ? cachedHits / (totalTranslations + cachedHits) : 0,
      averageTranslationSize: Math.round(avgSize),
    };
  }
}

// Export singleton instance
export const translator = new GeminiTranslator();