/**
 * News Collection Background Job
 * Handles scheduled news fetching and processing
 */

import { Job } from 'bull';
import { newsAggregator } from '@/services/server/news/newsAggregator';
import { prisma } from '@/lib/prisma';
import { JobType } from '@/lib/queue';

export interface NewsCollectionJobData {
  categories?: string[];
  sources?: string[];
  forceRefresh?: boolean;
}

export interface NewsCollectionJobResult {
  success: boolean;
  totalFetched: number;
  totalProcessed: number;
  duplicatesFound: number;
  errors: string[];
  duration: number;
}

export class NewsCollectionJob {
  /**
   * Process news collection job
   */
  static async process(job: Job<NewsCollectionJobData>): Promise<NewsCollectionJobResult> {
    const startTime = Date.now();
    console.log(`[${job.id}] Starting news collection job...`);
    
    try {
      const { categories = ['general', 'technology', 'business', 'science'], forceRefresh = false } = job.data;

      // Update job progress
      await job.progress(10);

      // Check if we should skip based on last fetch time
      if (!forceRefresh) {
        const shouldSkip = await this.shouldSkipCollection();
        if (shouldSkip) {
          console.log(`[${job.id}] Skipping collection - recently fetched`);
          return {
            success: true,
            totalFetched: 0,
            totalProcessed: 0,
            duplicatesFound: 0,
            errors: ['Skipped - recently fetched'],
            duration: Date.now() - startTime,
          };
        }
      }

      // Update job progress
      await job.progress(20);

      // Run news aggregation
      console.log(`[${job.id}] Aggregating news for categories: ${categories.join(', ')}`);
      const result = await newsAggregator.aggregateNews(categories);

      // Update job progress
      await job.progress(80);

      // Record job execution
      await this.recordJobExecution(job.id?.toString() || 'unknown', result);

      // Update job progress
      await job.progress(100);

      const duration = Date.now() - startTime;
      console.log(`[${job.id}] News collection completed in ${duration}ms`);

      return {
        success: true,
        totalFetched: result.totalFetched,
        totalProcessed: result.totalProcessed,
        duplicatesFound: result.duplicatesFound,
        errors: result.errors,
        duration,
      };
    } catch (error) {
      console.error(`[${job.id}] News collection job failed:`, error);
      throw error;
    }
  }

  /**
   * Check if we should skip collection based on recent fetches
   */
  private static async shouldSkipCollection(): Promise<boolean> {
    // Check last successful job
    const lastJob = await prisma.backgroundJob.findFirst({
      where: {
        type: JobType.FETCH_NEWS,
        status: 'SUCCESS',
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    if (!lastJob || !lastJob.completedAt) {
      return false;
    }

    // Skip if last successful fetch was less than 25 minutes ago
    const timeSinceLastFetch = Date.now() - lastJob.completedAt.getTime();
    return timeSinceLastFetch < 25 * 60 * 1000;
  }

  /**
   * Record job execution in database
   */
  private static async recordJobExecution(
    jobId: string, 
    result: any
  ): Promise<void> {
    await prisma.backgroundJob.create({
      data: {
        type: JobType.FETCH_NEWS,
        status: 'SUCCESS',
        payload: result,
        attempts: 1,
        scheduledFor: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  /**
   * Handle job failure
   */
  static async handleFailure(job: Job<NewsCollectionJobData>, error: Error): Promise<void> {
    console.error(`[${job.id}] News collection job failed after ${job.attemptsMade} attempts:`, error);

    // Record failure in database
    await prisma.backgroundJob.create({
      data: {
        type: JobType.FETCH_NEWS,
        status: 'FAILED',
        payload: job.data,
        error: error.message,
        attempts: job.attemptsMade,
        scheduledFor: new Date(job.timestamp),
        startedAt: new Date(job.processedOn || job.timestamp),
        completedAt: new Date(),
      },
    });

    // Send alert for critical failures
    if (job.attemptsMade >= 3) {
      console.error(`[${job.id}] CRITICAL: News collection failed after all retries`);
      // TODO: Send alert notification
    }
  }

  /**
   * Get job statistics
   */
  static async getStatistics(): Promise<{
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    averageDuration: number;
    lastRun?: Date;
  }> {
    const jobs = await prisma.backgroundJob.findMany({
      where: {
        type: JobType.FETCH_NEWS,
        completedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    const successfulJobs = jobs.filter(j => j.status === 'SUCCESS');
    const durations = successfulJobs
      .filter(j => j.startedAt && j.completedAt)
      .map(j => j.completedAt!.getTime() - j.startedAt!.getTime());

    return {
      totalJobs: jobs.length,
      successfulJobs: successfulJobs.length,
      failedJobs: jobs.filter(j => j.status === 'FAILED').length,
      averageDuration: durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      lastRun: successfulJobs[0]?.completedAt || undefined,
    };
  }
}