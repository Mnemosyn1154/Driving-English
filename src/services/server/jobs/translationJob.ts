/**
 * Translation Job
 * Handles background translation of news articles
 */

import { Job } from 'bull';
import { prisma } from '@/lib/prisma';
import { translator } from '@/services/server/translation/geminiTranslator';

export interface TranslationJobData {
  articleId?: string;
  articleIds?: string[];
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
}

export interface TranslationJobResult {
  processed: number;
  failed: number;
  errors: string[];
  processingTime: number;
}

export class TranslationJob {
  static readonly jobName = 'translation-job';
  static readonly maxRetries = 3;
  static readonly retryDelay = 5000; // 5 seconds

  /**
   * Process translation job
   */
  static async process(job: Job<TranslationJobData>): Promise<TranslationJobResult> {
    const startTime = Date.now();
    const { articleId, articleIds, priority = 'normal', retryCount = 0 } = job.data;
    
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      // Get articles to translate
      const articlesToTranslate = await this.getArticlesToTranslate(articleId, articleIds);
      
      if (articlesToTranslate.length === 0) {
        return {
          processed: 0,
          failed: 0,
          errors: ['No articles found to translate'],
          processingTime: Date.now() - startTime,
        };
      }

      // Process articles based on priority
      const sortedArticles = this.sortArticlesByPriority(articlesToTranslate, priority);
      
      // Translate articles
      for (const article of sortedArticles) {
        try {
          // Update job progress
          const progress = Math.round((processed / sortedArticles.length) * 100);
          await job.progress(progress);
          
          // Check if already translated
          if (article.isProcessed && article.titleKo && article.summaryKo) {
            console.log(`Article ${article.id} already translated, skipping...`);
            processed++;
            continue;
          }
          
          // Translate article
          console.log(`Translating article: ${article.title}`);
          await translator.translateArticle(article.id);
          
          processed++;
          
          // Small delay to avoid API rate limits
          if (processed < sortedArticles.length) {
            await this.delay(500);
          }
        } catch (error: any) {
          failed++;
          const errorMsg = `Failed to translate article ${article.id}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          
          // Retry logic for specific errors
          if (this.shouldRetry(error) && retryCount < this.maxRetries) {
            await job.retry();
          }
        }
      }
      
      // Update job statistics
      await this.updateStatistics(processed, failed);
      
      // Trigger TTS generation for successfully translated articles
      if (processed > 0 && articlesToTranslate.length > 0) {
        console.log(`🔄 Triggering TTS generation for ${processed} translated articles...`);
        try {
          const { TTSJob } = await import('./ttsJob');
          const translatedArticleIds = articlesToTranslate
            .slice(0, processed) // Only the successfully processed ones
            .map(article => article.id);
          await TTSJob.scheduleBatchTTS(translatedArticleIds, 'normal');
        } catch (error) {
          console.error('Failed to trigger TTS generation:', error);
        }
      }
      
      return {
        processed,
        failed,
        errors,
        processingTime: Date.now() - startTime,
      };
      
    } catch (error: any) {
      console.error('Translation job error:', error);
      throw new Error(`Translation job failed: ${error.message}`);
    }
  }

  /**
   * Get articles to translate
   */
  private static async getArticlesToTranslate(articleId?: string, articleIds?: string[]) {
    if (articleId) {
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { sentences: true },
      });
      return article ? [article] : [];
    }
    
    if (articleIds && articleIds.length > 0) {
      return await prisma.article.findMany({
        where: { id: { in: articleIds } },
        include: { sentences: true },
      });
    }
    
    // Get unprocessed articles
    return await prisma.article.findMany({
      where: {
        OR: [
          { isProcessed: false },
          { titleKo: null },
          { summaryKo: null },
        ],
      },
      include: { sentences: true },
      take: 50, // Process up to 50 articles at once
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Sort articles by priority
   */
  private static sortArticlesByPriority(articles: any[], priority: string) {
    if (priority === 'high') {
      // Prioritize recent articles with more sentences
      return articles.sort((a, b) => {
        const scoreA = a.sentences.length + (new Date().getTime() - new Date(a.createdAt).getTime()) / 1000 / 60;
        const scoreB = b.sentences.length + (new Date().getTime() - new Date(b.createdAt).getTime()) / 1000 / 60;
        return scoreB - scoreA;
      });
    }
    
    // Default: chronological order
    return articles.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Check if error should trigger retry
   */
  private static shouldRetry(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate limit',
      'quota exceeded',
      '429',
      '503',
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryError => 
      errorMessage.includes(retryError.toLowerCase())
    );
  }

  /**
   * Update job statistics
   */
  private static async updateStatistics(processed: number, failed: number) {
    try {
      // TODO: Implement job statistics tracking when schema is ready
      console.log(`Job statistics: Processed ${processed}, Failed ${failed}`);
    } catch (error) {
      console.error('Failed to update statistics:', error);
    }
  }

  /**
   * Delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Schedule batch translation
   */
  static async scheduleBatchTranslation(articleIds: string[], priority: 'high' | 'normal' | 'low' = 'normal') {
    const { newsQueue } = await import('@/lib/queue');
    
    // Split into smaller batches if needed
    const batchSize = 20;
    const batches = [];
    
    for (let i = 0; i < articleIds.length; i += batchSize) {
      batches.push(articleIds.slice(i, i + batchSize));
    }
    
    // Schedule each batch
    const jobs = await Promise.all(
      batches.map((batch, index) => 
        newsQueue.add(
          this.jobName,
          { articleIds: batch, priority },
          {
            attempts: this.maxRetries,
            backoff: {
              type: 'exponential',
              delay: this.retryDelay,
            },
            priority: priority === 'high' ? 1 : priority === 'normal' ? 5 : 10,
            delay: index * 2000, // Stagger batches by 2 seconds
          }
        )
      )
    );
    
    return jobs;
  }

  /**
   * Get job statistics
   */
  static async getStatistics(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get translated articles in the time period
    const translatedArticles = await prisma.article.count({
      where: {
        isProcessed: true,
        processedAt: { gte: since },
      },
    });
    
    // Get total articles that need translation
    const untranslatedArticles = await prisma.article.count({
      where: {
        OR: [
          { isProcessed: false },
          { titleKo: null },
          { summaryKo: null },
        ],
      },
    });
    
    return {
      totalProcessed: translatedArticles,
      totalFailed: 0, // TODO: Track failed translations
      totalJobs: 1, // Simplified for now
      successRate: 100, // Simplified for now
      recentJobs: [],
      untranslatedArticles,
    };
  }
}