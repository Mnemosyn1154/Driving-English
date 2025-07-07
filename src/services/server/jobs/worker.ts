import { newsQueue, processingQueue, maintenanceQueue, audioQueue } from './queue';
import { processNewsFetchJob, processPendingArticles } from './processors/newsProcessor';
import { processArticleJob } from './processors/articleProcessor';
import { processAudioGenerationJob } from './processors/audioProcessor';
import { processCacheCleanupJob } from './processors/cacheProcessor';

// News queue processor
newsQueue.process('fetch-all-sources', async (job) => {
  await processNewsFetchJob(job);
});

newsQueue.process('fetch-source', async (job) => {
  await processNewsFetchJob(job);
});

// Article processing queue
processingQueue.process('process-article', async (job) => {
  await processArticleJob(job);
});

processingQueue.process('process-pending', async () => {
  const count = await processPendingArticles();
  console.log(`Queued ${count} pending articles for processing`);
});

// Audio generation queue
audioQueue.process('generate-audio', async (job) => {
  await processAudioGenerationJob(job);
});

// Maintenance queue
maintenanceQueue.process('daily-cleanup', async (job) => {
  await processCacheCleanupJob(job);
});

maintenanceQueue.process('cleanup-cache', async (job) => {
  await processCacheCleanupJob(job);
});

// Error handlers
newsQueue.on('failed', (job, err) => {
  console.error(`News fetch job ${job.id} failed:`, err);
});

processingQueue.on('failed', (job, err) => {
  console.error(`Article processing job ${job.id} failed:`, err);
});

audioQueue.on('failed', (job, err) => {
  console.error(`Audio generation job ${job.id} failed:`, err);
});

maintenanceQueue.on('failed', (job, err) => {
  console.error(`Maintenance job ${job.id} failed:`, err);
});

// Progress handlers
newsQueue.on('completed', (job) => {
  console.log(`News fetch job ${job.id} completed`);
});

processingQueue.on('completed', (job) => {
  console.log(`Article processing job ${job.id} completed`);
});

audioQueue.on('completed', (job) => {
  console.log(`Audio generation job ${job.id} completed`);
});

maintenanceQueue.on('completed', (job) => {
  console.log(`Maintenance job ${job.id} completed`);
});

// Export for use in Next.js API routes
export {
  newsQueue,
  processingQueue,
  maintenanceQueue,
  audioQueue,
};