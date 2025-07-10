/**
 * TTS Background Job
 * Handles background generation of audio files for articles
 */

import { Job } from 'bull';
import { prisma } from '@/lib/prisma';
import { TextToSpeechService } from '@/services/server/tts/textToSpeech';

export interface TTSJobData {
  articleId?: string;
  articleIds?: string[];
  priority?: 'high' | 'normal' | 'low';
  regenerate?: boolean; // Force regenerate existing audio
}

export interface TTSJobResult {
  processed: number;
  failed: number;
  errors: string[];
  audioFilesGenerated: number;
  processingTime: number;
}

export class TTSJob {
  static readonly jobName = 'tts-job';
  static readonly maxRetries = 3;
  static readonly retryDelay = 5000;

  /**
   * Process TTS job
   */
  static async process(job: Job<TTSJobData>): Promise<TTSJobResult> {
    const startTime = Date.now();
    const { articleId, articleIds, priority = 'normal', regenerate = false } = job.data;

    let processed = 0;
    let failed = 0;
    let audioFilesGenerated = 0;
    const errors: string[] = [];

    try {
      // Get articles to process
      const articlesToProcess = await this.getArticlesToProcess(articleId, articleIds, regenerate);

      if (articlesToProcess.length === 0) {
        return {
          processed: 0,
          failed: 0,
          errors: ['No articles found to process'],
          audioFilesGenerated: 0,
          processingTime: Date.now() - startTime,
        };
      }

      // Initialize TTS service
      const ttsService = new TextToSpeechService();

      // Process articles based on priority
      const sortedArticles = this.sortArticlesByPriority(articlesToProcess, priority);

      for (const article of sortedArticles) {
        try {
          // Update job progress
          const progress = Math.round((processed / sortedArticles.length) * 100);
          await job.progress(progress);

          // Check if article has been translated
          if (!article.isProcessed || !article.titleKo || !article.summaryKo) {
            console.log(`Article ${article.id} not translated yet, skipping TTS...`);
            continue;
          }

          console.log(`Generating TTS for article: ${article.title}`);

          // Prepare sentence data for TTS
          const sentences = article.sentences.map(sentence => ({
            id: sentence.id,
            english: sentence.text,
            korean: sentence.translation || '',
          })).filter(s => s.korean); // Only process sentences with translations

          if (sentences.length === 0) {
            console.log(`No translated sentences found for article ${article.id}`);
            continue;
          }

          // Generate audio for all sentences
          const audioResults = await ttsService.generateNewsAudio(sentences);
          audioFilesGenerated += audioResults.length * 2; // English + Korean

          // Update sentences with audio URLs
          for (const result of audioResults) {
            await prisma.sentence.update({
              where: { id: result.sentenceId },
              data: {
                audioUrlEn: result.englishAudio,
                audioUrlKo: result.koreanAudio,
              },
            });
          }

          // Mark article as audio processed
          await prisma.article.update({
            where: { id: article.id },
            data: {
              audioProcessed: true,
              audioProcessedAt: new Date(),
            },
          });

          processed++;

          // Small delay to avoid API rate limits
          if (processed < sortedArticles.length) {
            await this.delay(1000);
          }
        } catch (error: any) {
          failed++;
          const errorMsg = `Failed to generate TTS for article ${article.id}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return {
        processed,
        failed,
        errors,
        audioFilesGenerated,
        processingTime: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('TTS job error:', error);
      throw new Error(`TTS job failed: ${error.message}`);
    }
  }

  /**
   * Get articles to process for TTS
   */
  private static async getArticlesToProcess(
    articleId?: string,
    articleIds?: string[],
    regenerate: boolean = false
  ) {
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

    // Get translated articles that don't have audio yet
    const whereCondition = regenerate
      ? {
          isProcessed: true,
          titleKo: { not: null },
          summaryKo: { not: null },
        }
      : {
          isProcessed: true,
          titleKo: { not: null },
          summaryKo: { not: null },
          audioProcessed: { not: true },
        };

    return await prisma.article.findMany({
      where: whereCondition,
      include: { sentences: true },
      take: 20, // Process up to 20 articles at once
      orderBy: { processedAt: 'desc' },
    });
  }

  /**
   * Sort articles by priority
   */
  private static sortArticlesByPriority(articles: any[], priority: string) {
    if (priority === 'high') {
      // Prioritize recent articles with more sentences
      return articles.sort((a, b) => {
        const scoreA = a.sentences.length + (new Date().getTime() - new Date(a.processedAt || a.createdAt).getTime()) / 1000 / 60;
        const scoreB = b.sentences.length + (new Date().getTime() - new Date(b.processedAt || b.createdAt).getTime()) / 1000 / 60;
        return scoreB - scoreA;
      });
    }

    // Default: chronological order
    return articles.sort((a, b) =>
      new Date(b.processedAt || b.createdAt).getTime() - new Date(a.processedAt || a.createdAt).getTime()
    );
  }

  /**
   * Delay helper
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Schedule batch TTS generation
   */
  static async scheduleBatchTTS(articleIds: string[], priority: 'high' | 'normal' | 'low' = 'normal') {
    const { processingQueue } = await import('@/lib/queue');

    // Split into smaller batches if needed
    const batchSize = 10; // Smaller batches for TTS due to longer processing time
    const batches = [];

    for (let i = 0; i < articleIds.length; i += batchSize) {
      batches.push(articleIds.slice(i, i + batchSize));
    }

    // Schedule each batch
    const jobs = await Promise.all(
      batches.map((batch, index) =>
        processingQueue.add(
          this.jobName,
          { articleIds: batch, priority },
          {
            attempts: this.maxRetries,
            backoff: {
              type: 'exponential',
              delay: this.retryDelay,
            },
            priority: priority === 'high' ? 1 : priority === 'normal' ? 5 : 10,
            delay: index * 5000, // Stagger batches by 5 seconds
          }
        )
      )
    );

    return jobs;
  }

  /**
   * Get TTS job statistics
   */
  static async getStatistics(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get articles with audio in the time period
    const audioProcessedArticles = await prisma.article.count({
      where: {
        audioProcessed: true,
        audioProcessedAt: { gte: since },
      },
    });

    // Get total articles that need audio processing
    const needsAudioProcessing = await prisma.article.count({
      where: {
        isProcessed: true,
        titleKo: { not: null },
        summaryKo: { not: null },
        audioProcessed: { not: true },
      },
    });

    // Get total audio files generated
    const totalAudioFiles = await prisma.sentence.count({
      where: {
        OR: [
          { audioUrlEn: { not: null } },
          { audioUrlKo: { not: null } },
        ],
      },
    });

    return {
      audioProcessedArticles,
      needsAudioProcessing,
      totalAudioFiles,
      processingRate: audioProcessedArticles > 0 ? 100 : 0, // Simplified
    };
  }
}