/**
 * News Aggregator Service
 * Integrates RSS and NewsAPI sources with deduplication
 */

import { rssParser } from './rssParser';
import { newsApiClient } from './newsApiClient';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface AggregatorConfig {
  enableRss: boolean;
  enableNewsApi: boolean;
  deduplicationThreshold: number; // 0-1, similarity threshold for deduplication
  maxArticlesPerSource: number;
}

interface AggregationResult {
  totalFetched: number;
  totalProcessed: number;
  duplicatesFound: number;
  errors: string[];
  sourceBreakdown: {
    rss: { fetched: number; processed: number };
    newsApi: { fetched: number; processed: number };
  };
  newArticles?: string[]; // IDs of newly added articles
}

export class NewsAggregator {
  private config: AggregatorConfig;
  private processedUrlHashes: Set<string> = new Set();
  private newArticleIds: string[] = [];
  
  constructor(config?: Partial<AggregatorConfig>) {
    this.config = {
      enableRss: config?.enableRss ?? true,
      enableNewsApi: config?.enableNewsApi ?? true,
      deduplicationThreshold: config?.deduplicationThreshold ?? 0.8,
      maxArticlesPerSource: config?.maxArticlesPerSource ?? 50,
    };
  }

  /**
   * Aggregate news from all configured sources
   */
  async aggregateNews(categories: string[] = ['general']): Promise<AggregationResult> {
    // Reset new article IDs for this aggregation
    this.newArticleIds = [];
    
    const result: AggregationResult = {
      totalFetched: 0,
      totalProcessed: 0,
      duplicatesFound: 0,
      errors: [],
      sourceBreakdown: {
        rss: { fetched: 0, processed: 0 },
        newsApi: { fetched: 0, processed: 0 },
      },
    };

    // Load existing article URLs for deduplication
    await this.loadExistingArticles();

    // Fetch from RSS sources
    if (this.config.enableRss) {
      console.log('📰 Fetching from RSS sources...');
      const rssResult = await this.fetchFromRssSources(categories);
      result.sourceBreakdown.rss = rssResult;
      result.totalFetched += rssResult.fetched;
      result.totalProcessed += rssResult.processed;
    }

    // Fetch from NewsAPI
    if (this.config.enableNewsApi) {
      console.log('🌐 Fetching from NewsAPI...');
      const newsApiResult = await this.fetchFromNewsApi(categories);
      result.sourceBreakdown.newsApi = newsApiResult;
      result.totalFetched += newsApiResult.fetched;
      result.totalProcessed += newsApiResult.processed;
    }

    // Calculate duplicates found
    result.duplicatesFound = result.totalFetched - result.totalProcessed;
    
    // Add new article IDs to result
    result.newArticles = this.newArticleIds;

    return result;
  }

  /**
   * Load existing article URLs for deduplication
   */
  private async loadExistingArticles(): Promise<void> {
    const recentArticles = await prisma.article.findMany({
      select: { url: true, title: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    // Store URL hashes for quick lookup
    recentArticles.forEach(article => {
      this.processedUrlHashes.add(this.hashUrl(article.url));
    });

    console.log(`📊 Loaded ${recentArticles.length} existing articles for deduplication`);
  }

  /**
   * Fetch news from RSS sources
   */
  private async fetchFromRssSources(categories: string[]): Promise<{ fetched: number; processed: number }> {
    let fetched = 0;
    let processed = 0;

    // Get article count before processing
    const beforeCount = await prisma.article.count();

    // Get enabled RSS sources
    const rssSources = await prisma.newsSource.findMany({
      where: {
        type: 'RSS',
        enabled: true,
        category: { in: categories },
      },
    });

    for (const source of rssSources) {
      try {
        const { processed: sourceProcessed, errors } = await rssParser.processFeed(source.url);
        processed += sourceProcessed;
        
        // Estimate fetched count (RSS parser doesn't return total fetched)
        fetched += sourceProcessed + errors.length;
      } catch (error) {
        console.error(`Error processing RSS source ${source.name}:`, error);
      }
    }

    // Get new articles created
    if (processed > 0) {
      const afterCount = await prisma.article.count();
      const newCount = afterCount - beforeCount;
      
      if (newCount > 0) {
        const newArticles = await prisma.article.findMany({
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: newCount,
        });
        
        this.newArticleIds.push(...newArticles.map(a => a.id));
      }
    }

    return { fetched, processed };
  }

  /**
   * Fetch news from NewsAPI
   */
  private async fetchFromNewsApi(categories: string[]): Promise<{ fetched: number; processed: number }> {
    let fetched = 0;
    let processed = 0;

    // Get article count before processing
    const beforeCount = await prisma.article.count();

    for (const category of categories) {
      try {
        // Fetch headlines for category
        const articles = await newsApiClient.fetchTopHeadlines({
          category,
          pageSize: this.config.maxArticlesPerSource,
        });

        fetched += articles.length;

        // Process with deduplication
        for (const article of articles) {
          if (await this.shouldProcessArticle(article.url, article.title)) {
            const result = await newsApiClient.processAndSaveArticles([article], category);
            processed += result.processed;
          }
        }
      } catch (error) {
        console.error(`Error fetching NewsAPI category ${category}:`, error);
      }
    }

    // Get new articles created
    if (processed > 0) {
      const afterCount = await prisma.article.count();
      const newCount = afterCount - beforeCount;
      
      if (newCount > 0) {
        const newArticles = await prisma.article.findMany({
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: newCount,
        });
        
        this.newArticleIds.push(...newArticles.map(a => a.id));
      }
    }

    return { fetched, processed };
  }

  /**
   * Check if article should be processed (not a duplicate)
   */
  private async shouldProcessArticle(url: string, title: string): Promise<boolean> {
    // Check URL hash first (exact URL match)
    const urlHash = this.hashUrl(url);
    if (this.processedUrlHashes.has(urlHash)) {
      return false;
    }

    // Check for similar titles in recent articles
    const similarArticles = await prisma.article.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      select: { title: true, url: true },
    });

    for (const existing of similarArticles) {
      // Skip if exact URL match
      if (existing.url === url) {
        return false;
      }

      // Check title similarity
      const similarity = this.calculateSimilarity(title, existing.title);
      if (similarity >= this.config.deduplicationThreshold) {
        console.log(`🔁 Duplicate found: "${title}" similar to "${existing.title}" (${Math.round(similarity * 100)}%)`);
        return false;
      }
    }

    // Mark as processed for this session
    this.processedUrlHashes.add(urlHash);
    return true;
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1;

    // Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - distance / maxLength;

    return similarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Hash URL for quick comparison
   */
  private hashUrl(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * Get aggregation statistics
   */
  async getStatistics(): Promise<{
    totalArticles: number;
    articlesByCategory: { category: string; count: number }[];
    articlesBySource: { source: string; count: number }[];
    recentDuplicates: number;
  }> {
    const [totalArticles, articlesByCategory, articlesBySource] = await Promise.all([
      // Total articles
      prisma.article.count(),
      
      // Articles by category
      prisma.article.groupBy({
        by: ['category'],
        _count: true,
      }),
      
      // Articles by source
      prisma.article.groupBy({
        by: ['sourceId'],
        _count: true,
      }),
    ]);

    // Get source names
    const sources = await prisma.newsSource.findMany({
      where: {
        id: { in: articlesBySource.map(s => s.sourceId) },
      },
      select: { id: true, name: true },
    });

    const sourceMap = new Map(sources.map(s => [s.id, s.name]));

    return {
      totalArticles,
      articlesByCategory: articlesByCategory.map(item => ({
        category: item.category,
        count: item._count,
      })),
      articlesBySource: articlesBySource.map(item => ({
        source: sourceMap.get(item.sourceId) || 'Unknown',
        count: item._count,
      })),
      recentDuplicates: this.processedUrlHashes.size,
    };
  }
}

// Export singleton instance
export const newsAggregator = new NewsAggregator();