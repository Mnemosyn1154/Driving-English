/**
 * Bull Queue Configuration
 * Background job processing for news collection
 */

import Bull from 'bull';
import { createInMemoryQueue } from './queue-memory';

// Check if Redis is available
const useRedis = process.env.REDIS_URL || process.env.REDIS_HOST;

// Redis connection configuration
const redisConfig = process.env.REDIS_URL ? {
  connection: process.env.REDIS_URL
} : {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Define job types
export enum JobType {
  FETCH_NEWS = 'fetch-news',
  PROCESS_ARTICLE = 'process-article',
  CLEANUP_CACHE = 'cleanup-cache',
  AGGREGATE_NEWS = 'aggregate-news',
}

// Create queues (use in-memory for development if Redis not available)
export const newsQueue = useRedis 
  ? new Bull('news-queue', redisConfig)
  : createInMemoryQueue('news-queue');

export const processingQueue = useRedis
  ? new Bull('processing-queue', redisConfig)
  : createInMemoryQueue('processing-queue');

if (!useRedis) {
  console.warn('⚠️  Redis not configured - using in-memory queue (development only)');
}

// Queue options
export const defaultJobOptions: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5 seconds
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50, // Keep last 50 failed jobs
};

// Cron expressions
export const CRON_EXPRESSIONS = {
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  DAILY_AT_MIDNIGHT: '0 0 * * *',
  TWICE_DAILY: '0 0,12 * * *',
};

// Export all queues
export const queues = {
  news: newsQueue,
  processing: processingQueue,
};