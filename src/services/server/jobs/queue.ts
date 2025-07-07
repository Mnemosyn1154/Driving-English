import Bull from 'bull';
import { prisma } from '../database/prisma';

// Job types
export enum JobType {
  FETCH_NEWS = 'FETCH_NEWS',
  PROCESS_ARTICLE = 'PROCESS_ARTICLE',
  CLEANUP_CACHE = 'CLEANUP_CACHE',
  PREGENERATE_AUDIO = 'PREGENERATE_AUDIO',
}

// Job interfaces
export interface FetchNewsJobData {
  sourceId?: string;
  category?: string;
}

export interface ProcessArticleJobData {
  articleId: string;
  priority?: boolean;
}

export interface CleanupCacheJobData {
  type: 'translation' | 'audio' | 'all';
  olderThanDays?: number;
}

export interface PregenerateAudioJobData {
  articleId: string;
  sentences?: number[]; // Specific sentence indices
}

// Create queues
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const newsQueue = new Bull<FetchNewsJobData>('news-fetching', redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const processingQueue = new Bull<ProcessArticleJobData>('article-processing', redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
});

export const maintenanceQueue = new Bull<CleanupCacheJobData>('maintenance', redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 1,
  },
});

export const audioQueue = new Bull<PregenerateAudioJobData>('audio-generation', redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 30000,
    },
  },
});

// Helper to track jobs in database
export async function createJobRecord(
  type: JobType,
  payload: any,
  scheduledFor: Date = new Date()
): Promise<string> {
  const job = await prisma.backgroundJob.create({
    data: {
      type,
      status: 'PENDING',
      payload,
      scheduledFor,
    },
  });
  return job.id;
}

export async function updateJobStatus(
  jobId: string,
  status: 'RUNNING' | 'SUCCESS' | 'FAILED',
  error?: string
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'RUNNING') {
    updateData.startedAt = new Date();
    updateData.attempts = { increment: 1 };
  } else if (status === 'SUCCESS') {
    updateData.completedAt = new Date();
  } else if (status === 'FAILED') {
    updateData.error = error;
    updateData.completedAt = new Date();
  }

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: updateData,
  });
}

// Schedule recurring jobs
export async function scheduleRecurringJobs(): Promise<void> {
  // Fetch news every 30 minutes
  await newsQueue.add(
    'fetch-all-sources',
    {},
    {
      repeat: {
        cron: '*/30 * * * *', // Every 30 minutes
      },
      jobId: 'recurring-news-fetch',
    }
  );

  // Clean up cache daily at 3 AM
  await maintenanceQueue.add(
    'daily-cleanup',
    { type: 'all', olderThanDays: 7 },
    {
      repeat: {
        cron: '0 3 * * *', // Daily at 3 AM
      },
      jobId: 'recurring-cache-cleanup',
    }
  );

  // Process unprocessed articles every hour
  await processingQueue.add(
    'process-pending',
    {},
    {
      repeat: {
        cron: '0 * * * *', // Every hour
      },
      jobId: 'recurring-article-processing',
    }
  );
}

// Get job statistics
export async function getJobStats() {
  const [newsStats, processingStats, maintenanceStats, audioStats] = await Promise.all([
    newsQueue.getJobCounts(),
    processingQueue.getJobCounts(),
    maintenanceQueue.getJobCounts(),
    audioQueue.getJobCounts(),
  ]);

  return {
    news: newsStats,
    processing: processingStats,
    maintenance: maintenanceStats,
    audio: audioStats,
  };
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    newsQueue.close(),
    processingQueue.close(),
    maintenanceQueue.close(),
    audioQueue.close(),
  ]);
}