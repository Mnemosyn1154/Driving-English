/**
 * Article Content Extraction Background Worker
 * Processes article content extraction jobs using Bull Queue
 */

import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import { articleExtractor, type ExtractionResult } from '@/services/server/extraction/articleExtractor';
import { geminiExtractor, type GeminiExtractionResult } from '@/services/server/extraction/geminiExtractor';
import { extractionQueue, extractionJobOptions } from '@/lib/queue';

const prisma = new PrismaClient();

export interface ExtractionJobData {
  articleId: string;
  url: string;
  forceReExtract?: boolean;
}

interface ProcessingResult {
  success: boolean;
  method: 'readability' | 'gemini';
  content?: string;
  title?: string;
  error?: string;
}

export class ExtractionWorker {
  private maxRetries = 2;
  private processingJobs = new Set<string>();

  constructor() {
    this.setupWorker();
  }

  /**
   * Setup Bull queue worker
   */
  private setupWorker(): void {
    extractionQueue.process('extract-article', 2, async (job: Bull.Job<ExtractionJobData>) => {
      return this.processExtraction(job);
    });

    // Handle job events
    extractionQueue.on('completed', (job, result) => {
      console.log(`[ExtractionWorker] Job ${job.id} completed:`, result);
      this.processingJobs.delete(job.data.articleId);
    });

    extractionQueue.on('failed', (job, err) => {
      console.error(`[ExtractionWorker] Job ${job.id} failed:`, err);
      this.processingJobs.delete(job.data.articleId);
    });

    extractionQueue.on('stalled', (job) => {
      console.warn(`[ExtractionWorker] Job ${job.id} stalled`);
    });

    console.log('[ExtractionWorker] Worker initialized and listening for jobs');
  }

  /**
   * Add extraction job to queue
   */
  async addExtractionJob(data: ExtractionJobData): Promise<Bull.Job<ExtractionJobData>> {
    // Check if already processing
    if (this.processingJobs.has(data.articleId)) {
      throw new Error(`Article ${data.articleId} is already being processed`);
    }

    // Check if already extracted (unless force re-extract)
    if (!data.forceReExtract) {
      const article = await prisma.article.findUnique({
        where: { id: data.articleId },
        select: { fullContentExtracted: true, extractionAttempts: true }
      });

      if (article?.fullContentExtracted) {
        throw new Error(`Article ${data.articleId} already has extracted content`);
      }

      // Skip if too many failed attempts
      if (article && article.extractionAttempts >= 3) {
        throw new Error(`Article ${data.articleId} has exceeded maximum extraction attempts`);
      }
    }

    this.processingJobs.add(data.articleId);

    const job = await extractionQueue.add('extract-article', data, {
      ...extractionJobOptions,
      jobId: `extract_${data.articleId}_${Date.now()}`,
    });

    console.log(`[ExtractionWorker] Added extraction job ${job.id} for article ${data.articleId}`);
    return job;
  }

  /**
   * Main extraction processing function
   */
  async processExtraction(job: Bull.Job<ExtractionJobData>): Promise<ProcessingResult> {
    const { articleId, url, forceReExtract } = job.data;

    try {
      console.log(`[ExtractionWorker] Starting extraction for article ${articleId} from ${url}`);

      // Update job progress
      await job.progress(10);

      // Update extraction attempt count
      await this.incrementExtractionAttempts(articleId);
      await job.progress(20);

      // Try Readability first
      console.log(`[ExtractionWorker] Attempting Readability extraction`);
      let result: ProcessingResult;
      
      try {
        const readabilityResult = await this.extractWithReadability(url);
        await job.progress(60);

        if (this.validateExtractionResult(readabilityResult)) {
          result = {
            success: true,
            method: 'readability',
            content: readabilityResult.content,
            title: readabilityResult.title,
          };
          console.log(`[ExtractionWorker] Readability extraction successful`);
        } else {
          throw new Error('Readability result validation failed');
        }
      } catch (readabilityError) {
        console.warn(`[ExtractionWorker] Readability failed, trying Gemini:`, readabilityError);
        await job.progress(40);

        // Fallback to Gemini
        try {
          const geminiResult = await this.extractWithGemini(url);
          await job.progress(80);

          if (this.validateGeminiResult(geminiResult)) {
            result = {
              success: true,
              method: 'gemini',
              content: geminiResult.content,
              title: geminiResult.title,
            };
            console.log(`[ExtractionWorker] Gemini extraction successful (confidence: ${geminiResult.confidence})`);
          } else {
            throw new Error('Gemini result validation failed');
          }
        } catch (geminiError) {
          console.error(`[ExtractionWorker] Both extraction methods failed:`, geminiError);
          result = {
            success: false,
            method: 'readability',
            error: `Both Readability and Gemini failed. Last error: ${geminiError instanceof Error ? geminiError.message : 'Unknown error'}`,
          };
        }
      }

      await job.progress(90);

      // Update database with results
      if (result.success) {
        await this.updateArticleInDatabase(articleId, result);
        console.log(`[ExtractionWorker] Successfully processed article ${articleId} using ${result.method}`);
      } else {
        await this.markExtractionFailed(articleId, result.error || 'Unknown error');
        console.error(`[ExtractionWorker] Failed to extract article ${articleId}:`, result.error);
      }

      await job.progress(100);
      return result;

    } catch (error) {
      console.error(`[ExtractionWorker] Unexpected error processing article ${articleId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markExtractionFailed(articleId, errorMessage);
      
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Extract content using Readability
   */
  private async extractWithReadability(url: string): Promise<ExtractionResult> {
    try {
      const result = await articleExtractor.extractFromUrl({
        url,
        timeout: 30000,
      });

      return result;
    } catch (error) {
      console.error('[ExtractionWorker] Readability extraction error:', error);
      throw new Error(`Readability extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content using Gemini AI
   */
  private async extractWithGemini(url: string): Promise<GeminiExtractionResult> {
    try {
      // First fetch the HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // Use Gemini to extract content
      const result = await geminiExtractor.extractFromHtml(html, url);
      
      return result;
    } catch (error) {
      console.error('[ExtractionWorker] Gemini extraction error:', error);
      throw new Error(`Gemini extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update article in database with extracted content
   */
  private async updateArticleInDatabase(articleId: string, result: ProcessingResult): Promise<void> {
    try {
      const updateData: any = {
        fullContent: result.content,
        fullContentExtracted: true,
        extractionMethod: result.method,
        lastExtractionAt: new Date(),
        extractionError: null, // Clear any previous errors
      };

      // Update title if extracted title is better
      if (result.title && result.title.length > 10) {
        // Only update if current title is generic or empty
        const currentArticle = await prisma.article.findUnique({
          where: { id: articleId },
          select: { title: true }
        });

        if (!currentArticle?.title || 
            currentArticle.title.length < 20 || 
            currentArticle.title.toLowerCase().includes('untitled')) {
          updateData.title = result.title;
        }
      }

      await prisma.article.update({
        where: { id: articleId },
        data: updateData,
      });

      console.log(`[ExtractionWorker] Updated article ${articleId} in database`);
    } catch (error) {
      console.error(`[ExtractionWorker] Database update error for article ${articleId}:`, error);
      throw new Error(`Failed to update database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark extraction as failed in database
   */
  private async markExtractionFailed(articleId: string, error: string): Promise<void> {
    try {
      await prisma.article.update({
        where: { id: articleId },
        data: {
          fullContentExtracted: false,
          extractionError: error,
          lastExtractionAt: new Date(),
        },
      });

      console.log(`[ExtractionWorker] Marked article ${articleId} as extraction failed`);
    } catch (dbError) {
      console.error(`[ExtractionWorker] Failed to mark extraction as failed for article ${articleId}:`, dbError);
    }
  }

  /**
   * Increment extraction attempt count
   */
  private async incrementExtractionAttempts(articleId: string): Promise<void> {
    try {
      await prisma.article.update({
        where: { id: articleId },
        data: {
          extractionAttempts: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      console.error(`[ExtractionWorker] Failed to increment attempts for article ${articleId}:`, error);
    }
  }

  /**
   * Validate Readability extraction result
   */
  private validateExtractionResult(result: ExtractionResult): boolean {
    return (
      result &&
      result.content &&
      result.content.length > 200 &&
      result.title &&
      result.title.length > 5 &&
      result.readTime > 0
    );
  }

  /**
   * Validate Gemini extraction result
   */
  private validateGeminiResult(result: GeminiExtractionResult): boolean {
    return (
      result &&
      result.content &&
      result.content.length > 200 &&
      result.title &&
      result.title.length > 5 &&
      result.confidence > 0.3
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      extractionQueue.getWaiting(),
      extractionQueue.getActive(),
      extractionQueue.getCompleted(),
      extractionQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  /**
   * Clean up completed and failed jobs
   */
  async cleanupJobs(): Promise<void> {
    await extractionQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
    await extractionQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    console.log('[ExtractionWorker] Cleaned up old jobs');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[ExtractionWorker] Shutting down...');
    await extractionQueue.close();
    await prisma.$disconnect();
    console.log('[ExtractionWorker] Shutdown complete');
  }
}

// Export singleton instance
export const extractionWorker = new ExtractionWorker();

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await extractionWorker.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await extractionWorker.shutdown();
  process.exit(0);
});