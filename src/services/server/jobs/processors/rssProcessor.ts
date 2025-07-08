/**
 * RSS Feed Background Processor
 * Processes RSS feeds in the background
 */

import { Job } from 'bull';
import { rssParser } from '../../news/rssParser';
import { prisma } from '@/lib/prisma';
import { NEWS_SOURCES } from '@/config/news-sources';

export interface RSSJobData {
  feedUrl?: string;
  userId?: string;
  sourceId?: string;
}

/**
 * Process single RSS feed
 */
export async function processRSSFeed(job: Job<RSSJobData>) {
  const { feedUrl, userId, sourceId } = job.data;
  
  try {
    if (feedUrl) {
      // Process specific feed URL
      const result = await rssParser.processFeed(feedUrl, userId);
      
      await job.log(`Processed ${result.processed} articles from ${feedUrl}`);
      
      if (result.errors.length > 0) {
        await job.log(`Errors: ${result.errors.join(', ')}`);
      }
      
      return result;
    } else if (sourceId) {
      // Process feed from news source
      const source = await prisma.newsSource.findUnique({
        where: { id: sourceId }
      });
      
      if (!source) {
        throw new Error(`News source ${sourceId} not found`);
      }
      
      if (!source.enabled) {
        await job.log(`Source ${source.name} is disabled, skipping`);
        return { processed: 0, errors: [] };
      }
      
      const result = await rssParser.processFeed(source.url);
      
      await job.log(`Processed ${result.processed} articles from ${source.name}`);
      
      return result;
    } else {
      throw new Error('Either feedUrl or sourceId must be provided');
    }
  } catch (error) {
    await job.log(`Error processing RSS feed: ${error.message}`);
    throw error;
  }
}

/**
 * Process all RSS feeds from configured sources
 */
export async function processAllRSSFeeds(job: Job) {
  let totalProcessed = 0;
  const errors: string[] = [];
  
  try {
    // Get all enabled RSS sources from database
    const sources = await prisma.newsSource.findMany({
      where: {
        type: 'RSS',
        enabled: true
      }
    });
    
    await job.log(`Found ${sources.length} enabled RSS sources`);
    
    // Process each source
    for (const source of sources) {
      try {
        // Check if it's time to update this source
        const now = new Date();
        const lastFetch = source.lastFetch || new Date(0);
        const minutesSinceLastFetch = (now.getTime() - lastFetch.getTime()) / (1000 * 60);
        
        if (minutesSinceLastFetch < source.updateInterval) {
          await job.log(`Skipping ${source.name} - last fetched ${minutesSinceLastFetch.toFixed(0)} minutes ago`);
          continue;
        }
        
        await job.log(`Processing ${source.name}...`);
        const result = await rssParser.processFeed(source.url);
        totalProcessed += result.processed;
        
        if (result.errors.length > 0) {
          errors.push(...result.errors.map(e => `${source.name}: ${e}`));
        }
        
        await job.progress(Math.round((sources.indexOf(source) + 1) / sources.length * 100));
      } catch (error) {
        errors.push(`${source.name}: ${error.message}`);
        await job.log(`Error processing ${source.name}: ${error.message}`);
      }
    }
    
    await job.log(`Completed: ${totalProcessed} articles processed, ${errors.length} errors`);
    
    return {
      totalProcessed,
      sourcesProcessed: sources.length,
      errors
    };
  } catch (error) {
    await job.log(`Fatal error: ${error.message}`);
    throw error;
  }
}

/**
 * Process user's RSS feeds
 */
export async function processUserRSSFeeds(job: Job<{ userId: string }>) {
  const { userId } = job.data;
  
  try {
    await job.log(`Processing RSS feeds for user ${userId}`);
    
    const result = await rssParser.processUserFeeds(userId);
    
    await job.log(`Processed ${result.total} articles from user feeds`);
    
    if (result.errors.length > 0) {
      await job.log(`Errors: ${result.errors.join(', ')}`);
    }
    
    return result;
  } catch (error) {
    await job.log(`Error processing user feeds: ${error.message}`);
    throw error;
  }
}