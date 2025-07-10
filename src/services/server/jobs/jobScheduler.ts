/**
 * Job Scheduler Service
 * Manages background job scheduling and processing
 */

import { newsQueue, processingQueue, CRON_EXPRESSIONS, defaultJobOptions, JobType } from '@/lib/queue';
import { NewsCollectionJob } from './newsCollectionJob';
import { TranslationJob } from './translationJob';
import { TTSJob } from './ttsJob';
import Bull from 'bull';

export class JobScheduler {
  private static instance: JobScheduler;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  /**
   * Initialize job scheduler and processors
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Job scheduler already initialized');
      return;
    }

    console.log('🚀 Initializing job scheduler...');

    try {
      // Set up job processors
      this.setupProcessors();

      // Set up recurring jobs
      await this.setupRecurringJobs();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ Job scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize job scheduler:', error);
      throw error;
    }
  }

  /**
   * Set up job processors
   */
  private setupProcessors(): void {
    // News collection processor
    newsQueue.process(JobType.FETCH_NEWS, 1, async (job) => {
      return NewsCollectionJob.process(job);
    });

    // Translation processor
    processingQueue.process(TranslationJob.jobName, 3, async (job) => {
      return TranslationJob.process(job);
    });

    // TTS processor
    processingQueue.process(TTSJob.jobName, 2, async (job) => {
      return TTSJob.process(job);
    });

    // Handle failures
    newsQueue.on('failed', async (job, error) => {
      await NewsCollectionJob.handleFailure(job, error);
    });

    console.log('📋 Job processors configured');
  }

  /**
   * Set up recurring jobs
   */
  private async setupRecurringJobs(): Promise<void> {
    // Remove existing recurring jobs
    const existingJobs = await newsQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await newsQueue.removeRepeatableByKey(job.key);
    }

    // Schedule news collection every 30 minutes
    await newsQueue.add(
      JobType.FETCH_NEWS,
      {
        categories: ['general', 'technology', 'business', 'science'],
        forceRefresh: false,
      },
      {
        ...defaultJobOptions,
        repeat: {
          cron: CRON_EXPRESSIONS.EVERY_30_MINUTES,
        },
      }
    );

    // Schedule cache cleanup daily
    await processingQueue.add(
      JobType.CLEANUP_CACHE,
      {},
      {
        ...defaultJobOptions,
        repeat: {
          cron: CRON_EXPRESSIONS.DAILY_AT_MIDNIGHT,
        },
      }
    );

    console.log('⏰ Recurring jobs scheduled');
  }

  /**
   * Set up event listeners for monitoring
   */
  private setupEventListeners(): void {
    // News queue events
    newsQueue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed:`, {
        type: job.name,
        processed: result.totalProcessed,
        duration: result.duration,
      });
    });

    newsQueue.on('failed', (job, error) => {
      console.error(`❌ Job ${job.id} failed:`, {
        type: job.name,
        attempts: job.attemptsMade,
        error: error.message,
      });
    });

    newsQueue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} stalled`);
    });

    // Processing queue events
    processingQueue.on('completed', (job) => {
      console.log(`✅ Processing job ${job.id} completed`);
    });

    processingQueue.on('failed', (job, error) => {
      console.error(`❌ Processing job ${job.id} failed:`, error.message);
    });
  }

  /**
   * Trigger immediate news collection
   */
  async triggerNewsCollection(
    categories?: string[],
    forceRefresh: boolean = true
  ): Promise<Bull.Job> {
    console.log('🔄 Triggering immediate news collection...');
    
    const job = await newsQueue.add(
      JobType.FETCH_NEWS,
      {
        categories: categories || ['general', 'technology', 'business', 'science'],
        forceRefresh,
      },
      defaultJobOptions
    );

    return job;
  }

  /**
   * Trigger translation for articles
   */
  async triggerTranslation(
    articleIds?: string[],
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<Bull.Job | Bull.Job[]> {
    console.log('🔄 Triggering translation job...');
    
    if (articleIds && articleIds.length > 0) {
      return TranslationJob.scheduleBatchTranslation(articleIds, priority);
    }

    // Translate all unprocessed articles
    const job = await processingQueue.add(
      TranslationJob.jobName,
      { priority },
      defaultJobOptions
    );

    return job;
  }

  /**
   * Trigger TTS generation for articles
   */
  async triggerTTS(
    articleIds?: string[],
    priority: 'high' | 'normal' | 'low' = 'normal',
    regenerate: boolean = false
  ): Promise<Bull.Job | Bull.Job[]> {
    console.log('🔄 Triggering TTS generation job...');
    
    if (articleIds && articleIds.length > 0) {
      return TTSJob.scheduleBatchTTS(articleIds, priority);
    }

    // Generate TTS for all translated articles
    const job = await processingQueue.add(
      TTSJob.jobName,
      { priority, regenerate },
      defaultJobOptions
    );

    return job;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    news: Bull.JobCounts;
    processing: Bull.JobCounts;
  }> {
    const [newsStats, processingStats] = await Promise.all([
      newsQueue.getJobCounts(),
      processingQueue.getJobCounts(),
    ]);

    return {
      news: newsStats,
      processing: processingStats,
    };
  }

  /**
   * Get scheduled jobs
   */
  async getScheduledJobs(): Promise<{
    recurring: Bull.RepeatableJob[];
    delayed: Bull.Job[];
  }> {
    const [recurring, delayed] = await Promise.all([
      newsQueue.getRepeatableJobs(),
      newsQueue.getDelayed(),
    ]);

    return { recurring, delayed };
  }

  /**
   * Clean up completed/failed jobs
   */
  async cleanupJobs(): Promise<void> {
    console.log('🧹 Cleaning up old jobs...');

    await Promise.all([
      newsQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
      newsQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      processingQueue.clean(24 * 60 * 60 * 1000, 'completed'),
      processingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'),
    ]);

    console.log('✅ Job cleanup completed');
  }

  /**
   * Gracefully shutdown scheduler
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down job scheduler...');

    await Promise.all([
      newsQueue.close(),
      processingQueue.close(),
    ]);

    this.isInitialized = false;
    console.log('✅ Job scheduler shut down');
  }
}

// Export singleton instance
export const jobScheduler = JobScheduler.getInstance();