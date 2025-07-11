/**
 * Translation Service V2
 * Unified translation service using the new cache system
 */

import { DomainCacheHelpers } from '../cache/CacheService';
import { prisma } from '../database/prisma';
import { config } from '@/lib/env';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  language: string;
  cached: boolean;
  confidence?: number;
}

export class TranslationServiceV2 {
  private static instance: TranslationServiceV2;
  private googleTranslateClient: any;
  private initialized = false;

  private constructor() {}

  static getInstance(): TranslationServiceV2 {
    if (!TranslationServiceV2.instance) {
      TranslationServiceV2.instance = new TranslationServiceV2();
    }
    return TranslationServiceV2.instance;
  }

  /**
   * Initialize Google Translate client
   */
  private async initialize() {
    if (this.initialized) return;

    try {
      const { Translate } = await import('@google-cloud/translate').then(m => m.v2);
      
      // Use credentials from environment
      const credentials = config.api.googleCredentials ? 
        JSON.parse(config.api.googleCredentials) : undefined;

      this.googleTranslateClient = new Translate({
        projectId: credentials?.project_id,
        keyFilename: credentials ? undefined : process.env.GOOGLE_APPLICATION_CREDENTIALS,
        credentials: credentials,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Translate:', error);
      throw new Error('Translation service initialization failed');
    }
  }

  /**
   * Translate text with caching
   */
  async translate(
    text: string,
    targetLanguage: string = 'ko',
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult> {
    // Check cache first
    const cached = await DomainCacheHelpers.getCachedTranslation(text, targetLanguage);
    if (cached) {
      return {
        originalText: text,
        translatedText: cached,
        language: targetLanguage,
        cached: true,
      };
    }

    // Initialize if needed
    await this.initialize();

    try {
      // Translate using Google Translate
      const [translation] = await this.googleTranslateClient.translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
      });

      // Cache the translation
      await DomainCacheHelpers.cacheTranslation(text, translation, targetLanguage);

      // Optionally save to database for analytics
      await this.saveTranslationRecord(text, translation, sourceLanguage, targetLanguage);

      return {
        originalText: text,
        translatedText: translation,
        language: targetLanguage,
        cached: false,
        confidence: 0.95, // Google Translate doesn't provide confidence scores
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Failed to translate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(
    texts: string[],
    targetLanguage: string = 'ko',
    sourceLanguage: string = 'en'
  ): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    const textsToTranslate: string[] = [];
    const cachedResults = new Map<string, string>();

    // Check cache for each text
    for (const text of texts) {
      const cached = await DomainCacheHelpers.getCachedTranslation(text, targetLanguage);
      if (cached) {
        cachedResults.set(text, cached);
      } else {
        textsToTranslate.push(text);
      }
    }

    // Translate uncached texts
    if (textsToTranslate.length > 0) {
      await this.initialize();

      try {
        // Google Translate supports batch translation
        const translations = await this.googleTranslateClient.translate(textsToTranslate, {
          from: sourceLanguage,
          to: targetLanguage,
        });

        // Cache new translations
        for (let i = 0; i < textsToTranslate.length; i++) {
          const text = textsToTranslate[i];
          const translation = translations[i];
          
          await DomainCacheHelpers.cacheTranslation(text, translation, targetLanguage);
          
          results.push({
            originalText: text,
            translatedText: translation,
            language: targetLanguage,
            cached: false,
          });
        }
      } catch (error) {
        console.error('Batch translation error:', error);
        throw new Error(`Failed to batch translate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Add cached results
    for (const [text, translation] of cachedResults) {
      results.push({
        originalText: text,
        translatedText: translation,
        language: targetLanguage,
        cached: true,
      });
    }

    // Maintain original order
    return texts.map(text => 
      results.find(r => r.originalText === text)!
    );
  }

  /**
   * Translate article sentences
   */
  async translateArticleSentences(articleId: string): Promise<{
    translatedCount: number;
    cachedCount: number;
    errors: string[];
  }> {
    const result = {
      translatedCount: 0,
      cachedCount: 0,
      errors: [] as string[],
    };

    try {
      // Get sentences that need translation
      const sentences = await prisma.sentence.findMany({
        where: {
          articleId,
          translation: null,
        },
        orderBy: { position: 'asc' },
      });

      if (sentences.length === 0) {
        return result;
      }

      // Batch translate
      const texts = sentences.map(s => s.text);
      const translations = await this.batchTranslate(texts);

      // Update database
      for (let i = 0; i < sentences.length; i++) {
        try {
          const sentence = sentences[i];
          const translation = translations[i];

          await prisma.sentence.update({
            where: { id: sentence.id },
            data: { 
              translation: translation.translatedText,
              translatedAt: new Date(),
            },
          });

          if (translation.cached) {
            result.cachedCount++;
          } else {
            result.translatedCount++;
          }
        } catch (error) {
          result.errors.push(`Failed to update sentence ${sentences[i].id}: ${error}`);
        }
      }
    } catch (error) {
      console.error('Article translation error:', error);
      result.errors.push(`Article translation failed: ${error}`);
    }

    return result;
  }

  /**
   * Get translation statistics
   */
  async getStatistics(): Promise<{
    totalTranslations: number;
    cachedTranslations: number;
    recentTranslations: number;
    popularTranslations: Array<{ text: string; count: number }>;
  }> {
    // Get from database
    const [total, recent] = await Promise.all([
      prisma.translationLog.count(),
      prisma.translationLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    // Get popular translations
    const popular = await prisma.translationLog.groupBy({
      by: ['originalText'],
      _count: true,
      orderBy: {
        _count: {
          originalText: 'desc',
        },
      },
      take: 10,
    });

    return {
      totalTranslations: total,
      cachedTranslations: 0, // Would need to track this separately
      recentTranslations: recent,
      popularTranslations: popular.map(p => ({
        text: p.originalText,
        count: p._count,
      })),
    };
  }

  /**
   * Clear translation cache
   */
  async clearCache(language?: string): Promise<void> {
    if (language) {
      await DomainCacheHelpers.clearTranslations();
    } else {
      await DomainCacheHelpers.clearTranslations();
    }
  }

  /**
   * Save translation record for analytics
   */
  private async saveTranslationRecord(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<void> {
    try {
      await prisma.translationLog.create({
        data: {
          originalText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          provider: 'google',
        },
      });
    } catch (error) {
      // Don't fail translation if logging fails
      console.error('Failed to save translation record:', error);
    }
  }
}

// Export singleton instance
export const translationServiceV2 = TranslationServiceV2.getInstance();