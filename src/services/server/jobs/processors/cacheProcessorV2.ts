/**
 * Cache Processor V2
 * Unified cache cleanup processor using the new cache service
 */

import { Job } from 'bull';
import { CleanupCacheJobData, updateJobStatus, createJobRecord, JobType } from '../queue';
import { prisma } from '../../database/prisma';
import { cacheService, DomainCacheHelpers } from '../../cache/CacheService';
import { CACHE_PREFIX } from '../../cache';

interface CleanupResult {
  deletedCount: number;
  freedMemory?: number;
  errors: string[];
  details: {
    translations: number;
    audio: number;
    articles: number;
    stats: number;
    other: number;
  };
}

export async function processCacheCleanupJob(job: Job<CleanupCacheJobData>) {
  const { type, olderThanDays = 7 } = job.data;
  const jobRecordId = await createJobRecord(JobType.CLEANUP_CACHE, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Starting cache cleanup: type=${type}, olderThanDays=${olderThanDays}`);

    const result: CleanupResult = {
      deletedCount: 0,
      errors: [],
      details: {
        translations: 0,
        audio: 0,
        articles: 0,
        stats: 0,
        other: 0,
      },
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Clean up by type
    if (type === 'all' || type === 'translation') {
      const count = await cleanupTranslations(cutoffDate);
      result.details.translations = count;
      result.deletedCount += count;
    }

    if (type === 'all' || type === 'audio') {
      const count = await cleanupAudio(cutoffDate);
      result.details.audio = count;
      result.deletedCount += count;
    }

    if (type === 'all' || type === 'article') {
      const count = await cleanupArticles(cutoffDate);
      result.details.articles = count;
      result.deletedCount += count;
    }

    if (type === 'all' || type === 'stats') {
      const count = await cleanupStats();
      result.details.stats = count;
      result.deletedCount += count;
    }

    // Clean up old job records
    await cleanupJobRecords(cutoffDate);

    // Get cache statistics after cleanup
    const stats = await cacheService.getStats();
    console.log('Cache statistics after cleanup:', stats);

    // Update job status with detailed results
    await updateJobStatus(jobRecordId, 'SUCCESS', {
      ...result,
      cacheStats: stats,
    });

    console.log(`Cache cleanup completed. Total deleted: ${result.deletedCount} entries`);
    return result;

  } catch (error) {
    console.error('Cache cleanup job failed:', error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

/**
 * Clean up translation cache
 */
async function cleanupTranslations(cutoffDate: Date): Promise<number> {
  console.log('Cleaning up translation cache...');
  
  // Clean from database cache table if exists
  try {
    const expired = await prisma.cacheEntry.deleteMany({
      where: {
        type: 'TRANSLATION',
        expiresAt: { lt: new Date() },
      },
    });
    console.log(`Deleted ${expired.count} expired translation cache entries from database`);
  } catch (error) {
    // Table might not exist
    console.log('No cache table found in database');
  }

  // Clean from unified cache
  const deletedCount = await cacheService.deleteByPattern('*', CACHE_PREFIX.TRANSLATION);
  
  // Clear domain-specific cache
  await DomainCacheHelpers.clearTranslations();
  
  return deletedCount;
}

/**
 * Clean up audio cache
 */
async function cleanupAudio(cutoffDate: Date): Promise<number> {
  console.log('Cleaning up audio cache...');
  
  // Clean from database
  try {
    const expired = await prisma.cacheEntry.deleteMany({
      where: {
        type: 'AUDIO',
        expiresAt: { lt: new Date() },
      },
    });
    console.log(`Deleted ${expired.count} expired audio cache entries from database`);
  } catch (error) {
    console.log('No cache table found in database');
  }

  // Clean old audio files from storage (if needed)
  await cleanupOldAudioFiles(cutoffDate);

  // Clean from unified cache
  const deletedCount = await cacheService.deleteByPattern('*', CACHE_PREFIX.AUDIO);
  
  // Clear domain-specific cache
  await DomainCacheHelpers.clearAudioUrls();
  
  return deletedCount;
}

/**
 * Clean up article cache
 */
async function cleanupArticles(cutoffDate: Date): Promise<number> {
  console.log('Cleaning up article cache...');
  
  // Find old articles
  const oldArticles = await prisma.article.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      isProcessed: true,
    },
    select: { id: true },
    take: 100, // Process in batches
  });

  let deletedCount = 0;

  // Delete cache for each old article
  for (const article of oldArticles) {
    const count = await cacheService.deleteByPattern(`${article.id}*`, CACHE_PREFIX.ARTICLE);
    deletedCount += count;
  }

  // Optionally delete the articles themselves
  // await prisma.article.deleteMany({
  //   where: { id: { in: oldArticles.map(a => a.id) } }
  // });

  return deletedCount;
}

/**
 * Clean up statistics cache
 */
async function cleanupStats(): Promise<number> {
  console.log('Cleaning up statistics cache...');
  
  // Stats are usually short-lived, delete all
  const deletedCount = await cacheService.deleteByPattern('*', CACHE_PREFIX.STATS);
  
  return deletedCount;
}

/**
 * Clean up old job records
 */
async function cleanupJobRecords(cutoffDate: Date): Promise<void> {
  // Clean up failed jobs
  const failedJobs = await prisma.backgroundJob.deleteMany({
    where: {
      status: 'FAILED',
      createdAt: { lt: cutoffDate },
    },
  });
  console.log(`Cleaned up ${failedJobs.count} failed job records`);

  // Clean up old completed jobs (keep recent ones for debugging)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const completedJobs = await prisma.backgroundJob.deleteMany({
    where: {
      status: 'SUCCESS',
      completedAt: { lt: weekAgo },
    },
  });
  console.log(`Cleaned up ${completedJobs.count} completed job records`);
}

/**
 * Clean up old audio files from storage
 */
async function cleanupOldAudioFiles(cutoffDate: Date): Promise<void> {
  try {
    // Get sentences with old audio
    const oldSentences = await prisma.sentence.findMany({
      where: {
        OR: [
          { audioUrlEn: { not: null } },
          { audioUrlKo: { not: null } },
        ],
        article: {
          createdAt: { lt: cutoffDate },
        },
      },
      select: {
        id: true,
        audioUrlEn: true,
        audioUrlKo: true,
      },
      take: 100, // Process in batches
    });

    // This would need integration with storage service to actually delete files
    console.log(`Found ${oldSentences.length} sentences with old audio files`);
    
    // Optionally clear the URLs from database
    // await prisma.sentence.updateMany({
    //   where: { id: { in: oldSentences.map(s => s.id) } },
    //   data: { audioUrlEn: null, audioUrlKo: null }
    // });
  } catch (error) {
    console.error('Error cleaning up audio files:', error);
  }
}

/**
 * Manual cleanup function for immediate execution
 */
export async function performManualCleanup(options?: {
  type?: 'all' | 'translation' | 'audio' | 'article' | 'stats';
  force?: boolean;
}): Promise<CleanupResult> {
  const { type = 'all', force = false } = options || {};
  
  // Create a fake job for the processor
  const fakeJob = {
    data: {
      type,
      olderThanDays: force ? 0 : 7,
    },
  } as Job<CleanupCacheJobData>;

  return processCacheCleanupJob(fakeJob);
}

/**
 * Get cache health status
 */
export async function getCacheHealth(): Promise<{
  healthy: boolean;
  totalKeys: number;
  memoryUsage?: string;
  recommendations: string[];
}> {
  const stats = await cacheService.getStats();
  const recommendations: string[] = [];

  // Check if any cache type is too large
  for (const [type, count] of Object.entries(stats.patterns)) {
    if (count > 10000) {
      recommendations.push(`${type} cache has ${count} keys - consider cleanup`);
    }
  }

  // Check total keys
  if (stats.totalKeys > 50000) {
    recommendations.push('Total cache size is large - schedule regular cleanup');
  }

  return {
    healthy: recommendations.length === 0,
    totalKeys: stats.totalKeys,
    recommendations,
  };
}