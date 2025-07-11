import { Job } from 'bull';
import { FetchNewsJobData, updateJobStatus, createJobRecord, JobType, processingQueue } from '../queue';
import { prisma } from '../../database/prisma';
import { newsAggregatorV2 } from '../../news/newsAggregatorV2';
import { cacheSet } from '../../cache';

export async function processNewsFetchJob(job: Job<FetchNewsJobData>) {
  const { sourceId, category } = job.data;
  const jobRecordId = await createJobRecord(JobType.FETCH_NEWS, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Processing news fetch job: ${job.id}`);

    // Prepare options for aggregator
    const options: any = {};
    
    if (category) {
      options.categories = [category];
    }
    
    if (sourceId) {
      // Get source name for provider filter
      const source = await prisma.newsSource.findUnique({
        where: { id: sourceId },
      });
      if (source) {
        options.providers = [source.name];
      }
    }

    // Use the new aggregator
    const result = await newsAggregatorV2.aggregateNews(options);
    
    console.log(`News fetch completed: ${result.totalSaved} new articles saved`);
    
    // Queue new articles for processing
    if (result.newArticleIds.length > 0) {
      for (const articleId of result.newArticleIds) {
        await processingQueue.add('process-article', {
          articleId,
          priority: 'normal',
        });
      }
    }

    // Update job status with results
    await updateJobStatus(jobRecordId, 'SUCCESS', {
      totalFetched: result.totalFetched,
      totalProcessed: result.totalProcessed,
      totalSaved: result.totalSaved,
      duplicatesFound: result.duplicatesFound,
      providerBreakdown: result.providerBreakdown,
    });

    // Cache statistics
    await cacheSet('news:statistics', await newsAggregatorV2.getStatistics(), 3600);

  } catch (error) {
    console.error('News fetch job failed:', error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

// Process pending articles
export async function processPendingArticles() {
  const pendingArticles = await prisma.article.findMany({
    where: {
      isProcessed: false,
      processingError: null,
    },
    orderBy: [
      { difficulty: 'asc' }, // Process easier articles first
      { publishedAt: 'desc' }, // Then by newest
    ],
    take: 10, // Process 10 at a time
  });

  for (const article of pendingArticles) {
    await processingQueue.add('process-article', {
      articleId: article.id,
    });
  }

  return pendingArticles.length;
}