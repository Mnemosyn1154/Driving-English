import { Job } from 'bull';
import { CleanupCacheJobData, updateJobStatus, createJobRecord, JobType } from '../queue';
import { prisma } from '../../database/prisma';
import { cacheDeleteByPattern, getRedisClient } from '../../cache/redis';

export async function processCacheCleanupJob(job: Job<CleanupCacheJobData>) {
  const { type, olderThanDays = 7 } = job.data;
  const jobRecordId = await createJobRecord(JobType.CLEANUP_CACHE, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Starting cache cleanup: type=${type}, olderThanDays=${olderThanDays}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    // Clean up database cache entries
    if (type === 'all' || type === 'translation') {
      const expiredTranslations = await prisma.cacheEntry.deleteMany({
        where: {
          type: 'TRANSLATION',
          expiresAt: { lt: new Date() },
        },
      });
      deletedCount += expiredTranslations.count;

      // Clean up Redis translation cache
      await cacheDeleteByPattern('translation:*');
      console.log(`Cleaned up ${expiredTranslations.count} translation cache entries`);
    }

    if (type === 'all' || type === 'audio') {
      const expiredAudio = await prisma.cacheEntry.deleteMany({
        where: {
          type: 'AUDIO',
          expiresAt: { lt: new Date() },
        },
      });
      deletedCount += expiredAudio.count;

      // Clean up Redis audio cache
      await cacheDeleteByPattern('audio:url:*');
      console.log(`Cleaned up ${expiredAudio.count} audio cache entries`);
    }

    // Clean up old articles (optional, based on business rules)
    const oldArticles = await prisma.article.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        isProcessed: true,
      },
      select: { id: true },
    });

    if (oldArticles.length > 0) {
      console.log(`Found ${oldArticles.length} old articles to clean up`);
      
      // Delete related cache entries
      for (const article of oldArticles) {
        await cacheDeleteByPattern(`article:${article.id}:*`);
      }
    }

    // Clean up failed jobs
    const failedJobs = await prisma.backgroundJob.deleteMany({
      where: {
        status: 'FAILED',
        createdAt: { lt: cutoffDate },
      },
    });
    console.log(`Cleaned up ${failedJobs.count} failed job records`);

    // Clean up completed jobs
    const completedJobs = await prisma.backgroundJob.deleteMany({
      where: {
        status: 'SUCCESS',
        completedAt: { lt: cutoffDate },
      },
    });
    console.log(`Cleaned up ${completedJobs.count} completed job records`);

    // Get Redis memory info
    const redis = await getRedisClient();
    const memoryInfo = await redis.info('memory');
    const memoryUsed = memoryInfo.match(/used_memory_human:(\S+)/)?.[1] || 'unknown';
    console.log(`Redis memory usage: ${memoryUsed}`);

    // Run Redis memory optimization
    await redis.sendCommand(['MEMORY', 'DOCTOR']);

    console.log(`Cache cleanup completed. Total deleted: ${deletedCount} entries`);
    await updateJobStatus(jobRecordId, 'SUCCESS');

  } catch (error) {
    console.error('Cache cleanup job failed:', error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

// Manual cleanup function for immediate execution
export async function cleanupExpiredCache(): Promise<number> {
  const expired = await prisma.cacheEntry.findMany({
    where: {
      expiresAt: { lt: new Date() },
    },
    select: { key: true, type: true },
  });

  let cleanedCount = 0;
  for (const entry of expired) {
    try {
      // Delete from Redis
      await cacheDeleteByPattern(entry.key);
      
      // Delete from database
      await prisma.cacheEntry.delete({
        where: { key: entry.key },
      });
      
      cleanedCount++;
    } catch (error) {
      console.error(`Error cleaning up cache entry ${entry.key}:`, error);
    }
  }

  return cleanedCount;
}