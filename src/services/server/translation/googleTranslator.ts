/**
 * Google Cloud Translation Service
 * Handles English to Korean translation with caching
 */

import { Translate } from '@google-cloud/translate/build/src/v2';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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

export class GoogleTranslator {
  private translate: Translate;
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor() {
    // Initialize Google Cloud Translate client
    this.translate = new Translate({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
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
      // Translate using Google Cloud Translation API
      const [translation] = await this.translate.translate(text, {
        from,
        to,
        format,
      });

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
        const translations = await this.translate.translate(uncachedTexts, {
          from,
          to,
        });

        // Process translations
        for (let i = 0; i < uncachedTexts.length; i++) {
          const originalIndex = uncachedIndices[i];
          const translation = translations[0][i];

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
export const translator = new GoogleTranslator();