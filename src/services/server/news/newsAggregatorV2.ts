/**
 * News Aggregator Service V2
 * Refactored to use provider pattern
 */

import { INewsProvider, NewsArticle, FetchResult } from './providers/INewsProvider';
import { ProviderFactory, ProviderType } from './providers/ProviderFactory';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface AggregatorConfig {
  enabledProviders?: ProviderType[];
  deduplicationThreshold: number;
  maxArticlesPerSource: number;
  cacheDuration: number; // hours
}

interface AggregationResult {
  totalFetched: number;
  totalProcessed: number;
  totalSaved: number;
  duplicatesFound: number;
  errors: string[];
  providerBreakdown: Record<string, {
    fetched: number;
    processed: number;
    saved: number;
    errors: number;
  }>;
  newArticleIds: string[];
}

export class NewsAggregatorV2 {
  private config: AggregatorConfig;
  private processedUrlHashes: Set<string> = new Set();
  private titleHashes: Set<string> = new Set();

  constructor(config?: Partial<AggregatorConfig>) {
    this.config = {
      enabledProviders: config?.enabledProviders || ['RSS', 'NEWSAPI'],
      deduplicationThreshold: config?.deduplicationThreshold || 0.8,
      maxArticlesPerSource: config?.maxArticlesPerSource || 50,
      cacheDuration: config?.cacheDuration || 24,
    };
  }

  /**
   * Aggregate news from all enabled providers
   */
  async aggregateNews(options?: {
    categories?: string[];
    providers?: string[];
    force?: boolean;
  }): Promise<AggregationResult> {
    const result: AggregationResult = {
      totalFetched: 0,
      totalProcessed: 0,
      totalSaved: 0,
      duplicatesFound: 0,
      errors: [],
      providerBreakdown: {},
      newArticleIds: [],
    };

    // Load existing articles for deduplication
    if (!options?.force) {
      await this.loadExistingArticles();
    }

    // Get providers to use
    const providers = await this.getProviders(options?.providers);
    
    console.log(`🔄 Aggregating news from ${providers.length} providers...`);

    // Fetch from each provider
    for (const provider of providers) {
      const providerName = provider.getName();
      console.log(`📰 Fetching from ${providerName}...`);

      try {
        const fetchResult = await provider.fetchArticles({
          categories: options?.categories,
          maxArticles: this.config.maxArticlesPerSource,
        });

        // Process and save articles
        const saveResult = await this.processProviderResult(provider, fetchResult);

        // Update statistics
        result.totalFetched += fetchResult.totalFetched;
        result.totalProcessed += fetchResult.totalProcessed;
        result.totalSaved += saveResult.saved;
        result.duplicatesFound += saveResult.duplicates;
        result.errors.push(...fetchResult.errors);
        result.newArticleIds.push(...saveResult.newIds);

        result.providerBreakdown[providerName] = {
          fetched: fetchResult.totalFetched,
          processed: fetchResult.totalProcessed,
          saved: saveResult.saved,
          errors: fetchResult.errors.length,
        };

      } catch (error) {
        const errorMsg = `Provider ${providerName} failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        
        result.providerBreakdown[providerName] = {
          fetched: 0,
          processed: 0,
          saved: 0,
          errors: 1,
        };
      }
    }

    console.log(`✅ Aggregation complete: ${result.totalSaved} new articles saved`);
    return result;
  }

  /**
   * Get providers to use for aggregation
   */
  private async getProviders(providerNames?: string[]): Promise<INewsProvider[]> {
    if (providerNames && providerNames.length > 0) {
      // Get specific providers
      const providers: INewsProvider[] = [];
      
      for (const name of providerNames) {
        const provider = await ProviderFactory.getProvider(name);
        if (provider && provider.isEnabled()) {
          providers.push(provider);
        }
      }
      
      return providers;
    }

    // Get all enabled providers of configured types
    const providers: INewsProvider[] = [];
    
    for (const type of this.config.enabledProviders || []) {
      const typeProviders = await ProviderFactory.getProvidersByType(type);
      providers.push(...typeProviders);
    }

    return providers;
  }

  /**
   * Process and save articles from a provider
   */
  private async processProviderResult(
    provider: INewsProvider,
    fetchResult: FetchResult
  ): Promise<{
    saved: number;
    duplicates: number;
    newIds: string[];
  }> {
    let saved = 0;
    let duplicates = 0;
    const newIds: string[] = [];

    for (const article of fetchResult.articles) {
      try {
        // Check for duplicates
        if (await this.isDuplicate(article)) {
          duplicates++;
          continue;
        }

        // Save to database
        const savedArticle = await this.saveArticle(article, provider.getName());
        if (savedArticle) {
          saved++;
          newIds.push(savedArticle.id);
          
          // Add to deduplication cache
          this.processedUrlHashes.add(this.hashUrl(article.url));
          this.titleHashes.add(this.hashText(article.title));
        }
      } catch (error) {
        console.error(`Failed to save article: ${error}`);
      }
    }

    return { saved, duplicates, newIds };
  }

  /**
   * Check if article is a duplicate
   */
  private async isDuplicate(article: NewsArticle): Promise<boolean> {
    // Check URL hash
    const urlHash = this.hashUrl(article.url);
    if (this.processedUrlHashes.has(urlHash)) {
      return true;
    }

    // Check title hash for exact matches
    const titleHash = this.hashText(article.title);
    if (this.titleHashes.has(titleHash)) {
      return true;
    }

    // Check database for URL
    const existingByUrl = await prisma.article.findFirst({
      where: { url: article.url },
    });
    
    if (existingByUrl) {
      return true;
    }

    // Check for similar titles (fuzzy matching)
    const recentArticles = await prisma.article.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - this.config.cacheDuration * 60 * 60 * 1000),
        },
      },
      select: { title: true },
    });

    for (const existing of recentArticles) {
      const similarity = this.calculateSimilarity(article.title, existing.title);
      if (similarity >= this.config.deduplicationThreshold) {
        console.log(`🔁 Duplicate found: "${article.title}" ~= "${existing.title}" (${Math.round(similarity * 100)}%)`);
        return true;
      }
    }

    return false;
  }

  /**
   * Save article to database
   */
  private async saveArticle(article: NewsArticle, providerName: string): Promise<{ id: string } | null> {
    try {
      // Get or create news source
      const source = await prisma.newsSource.findFirst({
        where: { name: providerName },
      });

      if (!source) {
        console.error(`Source not found: ${providerName}`);
        return null;
      }

      // Create article
      const savedArticle = await prisma.article.create({
        data: {
          id: article.id,
          title: article.title,
          url: article.url,
          summary: article.summary,
          content: article.content,
          publishedAt: article.publishedAt,
          category: article.category,
          tags: article.tags,
          difficulty: 'intermediate', // Default, can be calculated
          sourceId: source.id,
          metadata: article.metadata || {},
        },
      });

      // Create sentences (if content is substantial)
      if (article.content && article.content.length > 100) {
        await this.createSentences(savedArticle.id, article.content);
      }

      return { id: savedArticle.id };
    } catch (error) {
      console.error(`Failed to save article: ${error}`);
      return null;
    }
  }

  /**
   * Create sentence records for an article
   */
  private async createSentences(articleId: string, content: string): Promise<void> {
    try {
      // Import TextProcessor dynamically to avoid circular dependencies
      const { TextProcessor } = await import('@/utils/textProcessing');
      const processor = new TextProcessor();
      
      const sentences = processor.splitIntoSentences(content);
      
      // Create sentence records in batches
      const sentenceData = sentences.map((text, index) => ({
        articleId,
        text,
        position: index,
        wordCount: processor.countWords(text),
      }));

      await prisma.sentence.createMany({
        data: sentenceData,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error(`Failed to create sentences: ${error}`);
    }
  }

  /**
   * Load existing articles for deduplication
   */
  private async loadExistingArticles(): Promise<void> {
    const recentArticles = await prisma.article.findMany({
      select: { url: true, title: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - this.config.cacheDuration * 60 * 60 * 1000),
        },
      },
    });

    // Clear and reload caches
    this.processedUrlHashes.clear();
    this.titleHashes.clear();

    recentArticles.forEach(article => {
      this.processedUrlHashes.add(this.hashUrl(article.url));
      this.titleHashes.add(this.hashText(article.title));
    });

    console.log(`📊 Loaded ${recentArticles.length} articles for deduplication`);
  }

  /**
   * Calculate text similarity (Jaccard similarity for speed)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Hash URL for deduplication
   */
  private hashUrl(url: string): string {
    // Normalize URL before hashing
    try {
      const normalized = new URL(url);
      normalized.search = ''; // Remove query params
      normalized.hash = ''; // Remove fragment
      return crypto.createHash('md5').update(normalized.toString()).digest('hex');
    } catch {
      return crypto.createHash('md5').update(url).digest('hex');
    }
  }

  /**
   * Hash text for deduplication
   */
  private hashText(text: string): string {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Get aggregation statistics
   */
  async getStatistics(): Promise<{
    totalArticles: number;
    articlesByCategory: { category: string; count: number }[];
    articlesByProvider: { provider: string; count: number }[];
    lastAggregation?: Date;
    providerStats: Record<string, any>;
  }> {
    const [totalArticles, articlesByCategory] = await Promise.all([
      prisma.article.count(),
      prisma.article.groupBy({
        by: ['category'],
        _count: true,
      }),
    ]);

    // Get provider statistics
    const providers = await ProviderFactory.getEnabledProviders();
    const providerStats: Record<string, any> = {};

    for (const provider of providers) {
      providerStats[provider.getName()] = await provider.getStatistics();
    }

    return {
      totalArticles,
      articlesByCategory: articlesByCategory.map(item => ({
        category: item.category,
        count: item._count,
      })),
      articlesByProvider: [], // TODO: Implement if needed
      providerStats,
    };
  }
}

// Export singleton instance
export const newsAggregatorV2 = new NewsAggregatorV2();