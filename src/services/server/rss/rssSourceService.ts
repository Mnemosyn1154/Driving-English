/**
 * RSS Source Service
 * Unified service for managing RSS sources
 */

import { prisma } from '../database/prisma';
import { ProviderFactory } from '../news/providers';
import Parser from 'rss-parser';
import { cacheService } from '../cache/CacheService';
import { CACHE_PREFIX, CACHE_TTL } from '../cache';

export interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  type: 'RSS' | 'USER_RSS';
  userId?: string | null;
  lastFetch?: Date | null;
  lastError?: string | null;
  updateInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidateResult {
  valid: boolean;
  feedInfo?: {
    title: string;
    description?: string;
    link?: string;
    language?: string;
    itemCount: number;
    categories?: string[];
  };
  error?: string;
}

export interface FetchResult {
  success: boolean;
  articlesCount: number;
  errors?: string[];
  duration: number;
}

export class RSSSourceService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'DrivingEnglish/1.0 (Learning Platform)',
      },
    });
  }

  /**
   * Get all RSS sources (system + user)
   */
  async getAllSources(options?: {
    userId?: string;
    category?: string;
    enabled?: boolean;
    type?: 'RSS' | 'USER_RSS' | 'ALL';
  }): Promise<RSSSource[]> {
    const sources: RSSSource[] = [];

    // Get system RSS sources
    if (!options?.type || options.type === 'RSS' || options.type === 'ALL') {
      const systemWhere: any = { type: 'RSS' };
      
      if (options?.category) {
        systemWhere.category = options.category;
      }
      
      if (options?.enabled !== undefined) {
        systemWhere.enabled = options.enabled;
      }

      const systemSources = await prisma.newsSource.findMany({
        where: systemWhere,
        orderBy: [{ name: 'asc' }],
      });

      sources.push(...systemSources.map(source => ({
        ...source,
        type: 'RSS' as const,
        userId: null,
      })));
    }

    // Get user RSS sources
    if (options?.userId && (!options?.type || options.type === 'USER_RSS' || options.type === 'ALL')) {
      const userWhere: any = { userId: options.userId };
      
      if (options?.category) {
        userWhere.category = options.category;
      }
      
      if (options?.enabled !== undefined) {
        userWhere.enabled = options.enabled;
      }

      const userFeeds = await prisma.userRssFeed.findMany({
        where: userWhere,
        orderBy: [{ name: 'asc' }],
      });

      sources.push(...userFeeds.map(feed => ({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        category: feed.category || 'general',
        enabled: feed.enabled,
        type: 'USER_RSS' as const,
        userId: feed.userId,
        lastFetch: null,
        lastError: null,
        updateInterval: 30,
        createdAt: feed.createdAt,
        updatedAt: feed.updatedAt,
      })));
    }

    return sources;
  }

  /**
   * Get RSS source by ID
   */
  async getSourceById(id: string, userId?: string): Promise<RSSSource | null> {
    // Try system sources first
    const systemSource = await prisma.newsSource.findFirst({
      where: { id, type: 'RSS' },
    });

    if (systemSource) {
      return {
        ...systemSource,
        type: 'RSS' as const,
        userId: null,
      };
    }

    // Try user sources if userId is provided
    if (userId) {
      const userFeed = await prisma.userRssFeed.findFirst({
        where: { id, userId },
      });

      if (userFeed) {
        return {
          id: userFeed.id,
          name: userFeed.name,
          url: userFeed.url,
          category: userFeed.category || 'general',
          enabled: userFeed.enabled,
          type: 'USER_RSS' as const,
          userId: userFeed.userId,
          lastFetch: null,
          lastError: null,
          updateInterval: 30,
          createdAt: userFeed.createdAt,
          updatedAt: userFeed.updatedAt,
        };
      }
    }

    return null;
  }

  /**
   * Create new RSS source
   */
  async createSource(data: {
    name: string;
    url: string;
    category: string;
    userId?: string;
    enabled?: boolean;
    updateInterval?: number;
  }): Promise<RSSSource> {
    // Validate URL format
    try {
      new URL(data.url);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (data.userId) {
      // Create user RSS feed
      const existingUserFeed = await prisma.userRssFeed.findFirst({
        where: { url: data.url, userId: data.userId },
      });

      if (existingUserFeed) {
        throw new Error('RSS source with this URL already exists');
      }

      const userFeed = await prisma.userRssFeed.create({
        data: {
          name: data.name,
          url: data.url,
          category: data.category,
          userId: data.userId,
          enabled: data.enabled ?? true,
        },
      });

      return {
        id: userFeed.id,
        name: userFeed.name,
        url: userFeed.url,
        category: userFeed.category || 'general',
        enabled: userFeed.enabled,
        type: 'USER_RSS' as const,
        userId: userFeed.userId,
        lastFetch: null,
        lastError: null,
        updateInterval: 30,
        createdAt: userFeed.createdAt,
        updatedAt: userFeed.updatedAt,
      };
    } else {
      // Create system RSS source
      const existingSystemSource = await prisma.newsSource.findFirst({
        where: { url: data.url, type: 'RSS' },
      });

      if (existingSystemSource) {
        throw new Error('RSS source with this URL already exists');
      }

      const source = await prisma.newsSource.create({
        data: {
          name: data.name,
          url: data.url,
          category: data.category,
          type: 'RSS',
          enabled: data.enabled ?? true,
          updateInterval: data.updateInterval ?? 30,
        },
      });

      // Clear provider cache to reload sources
      ProviderFactory.clearCache();

      return {
        ...source,
        type: 'RSS' as const,
        userId: null,
      };
    }
  }

  /**
   * Update RSS source
   */
  async updateSource(
    id: string,
    data: {
      name?: string;
      category?: string;
      enabled?: boolean;
      updateInterval?: number;
    },
    userId?: string
  ): Promise<RSSSource> {
    // Check ownership
    const existing = await this.getSourceById(id, userId);
    if (!existing) {
      throw new Error('RSS source not found');
    }

    if (existing.type === 'USER_RSS' && existing.userId !== userId) {
      throw new Error('Unauthorized to update this source');
    }

    if (existing.type === 'USER_RSS') {
      // Update user RSS feed
      const updated = await prisma.userRssFeed.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        url: updated.url,
        category: updated.category || 'general',
        enabled: updated.enabled,
        type: 'USER_RSS' as const,
        userId: updated.userId,
        lastFetch: null,
        lastError: null,
        updateInterval: 30,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } else {
      // Update system RSS source
      const updated = await prisma.newsSource.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.updateInterval !== undefined && { updateInterval: data.updateInterval }),
        },
      });

      // Clear provider cache
      ProviderFactory.clearCache();

      return {
        ...updated,
        type: 'RSS' as const,
        userId: null,
      };
    }
  }

  /**
   * Delete RSS source
   */
  async deleteSource(id: string, userId?: string): Promise<void> {
    // Check ownership
    const existing = await this.getSourceById(id, userId);
    if (!existing) {
      throw new Error('RSS source not found');
    }

    if (existing.type === 'USER_RSS' && existing.userId !== userId) {
      throw new Error('Unauthorized to delete this source');
    }

    if (existing.type === 'USER_RSS') {
      // Delete user RSS feed
      await prisma.userRssFeed.delete({
        where: { id },
      });
    } else {
      // Delete system RSS source
      // Delete associated articles (optional - might want to keep them)
      // await prisma.article.deleteMany({ where: { sourceId: id } });

      await prisma.newsSource.delete({
        where: { id },
      });

      // Clear provider cache
      ProviderFactory.clearCache();
    }
  }

  /**
   * Validate RSS feed URL
   */
  async validateFeed(url: string): Promise<ValidateResult> {
    const cacheKey = `validate:${url}`;
    
    // Check cache first
    const cached = await cacheService.get<ValidateResult>(cacheKey, {
      prefix: CACHE_PREFIX.STATS,
    });
    
    if (cached) {
      return cached;
    }

    try {
      const feed = await this.parser.parseURL(url);

      const result: ValidateResult = {
        valid: true,
        feedInfo: {
          title: feed.title || 'Untitled Feed',
          description: feed.description,
          link: feed.link,
          language: feed.language,
          itemCount: feed.items?.length || 0,
          categories: this.extractCategories(feed),
        },
      };

      // Cache the result
      await cacheService.set(cacheKey, result, {
        prefix: CACHE_PREFIX.STATS,
        ttl: 3600, // 1 hour
      });

      return result;
    } catch (error) {
      const result: ValidateResult = {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to parse RSS feed',
      };

      // Cache negative results for shorter time
      await cacheService.set(cacheKey, result, {
        prefix: CACHE_PREFIX.STATS,
        ttl: 300, // 5 minutes
      });

      return result;
    }
  }

  /**
   * Fetch articles from a specific RSS source
   */
  async fetchFromSource(sourceId: string): Promise<FetchResult> {
    const startTime = Date.now();
    
    try {
      const source = await prisma.newsSource.findUnique({
        where: { id: sourceId },
      });

      if (!source || !source.enabled) {
        throw new Error('Source not found or disabled');
      }

      // Use the RSS provider
      const provider = await ProviderFactory.getProvider(source.name);
      if (!provider) {
        throw new Error('Provider not found');
      }

      const result = await provider.fetchArticles({
        categories: [source.category],
        maxArticles: 50,
      });

      // Update last fetch time
      await prisma.newsSource.update({
        where: { id: sourceId },
        data: {
          lastFetch: new Date(),
          lastError: null,
        },
      });

      return {
        success: true,
        articlesCount: result.totalProcessed,
        errors: result.errors.length > 0 ? result.errors : undefined,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Update error state
      await prisma.newsSource.update({
        where: { id: sourceId },
        data: {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return {
        success: false,
        articlesCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch fetch from multiple sources
   */
  async batchFetch(sourceIds: string[]): Promise<{
    results: Array<{ sourceId: string; result: FetchResult }>;
    summary: {
      successful: number;
      failed: number;
      totalArticles: number;
      totalDuration: number;
    };
  }> {
    const results: Array<{ sourceId: string; result: FetchResult }> = [];
    const summary = {
      successful: 0,
      failed: 0,
      totalArticles: 0,
      totalDuration: 0,
    };

    // Process in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < sourceIds.length; i += concurrency) {
      const batch = sourceIds.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (sourceId) => {
          const result = await this.fetchFromSource(sourceId);
          return { sourceId, result };
        })
      );

      results.push(...batchResults);

      // Update summary
      batchResults.forEach(({ result }) => {
        if (result.success) {
          summary.successful++;
          summary.totalArticles += result.articlesCount;
        } else {
          summary.failed++;
        }
        summary.totalDuration += result.duration;
      });
    }

    return { results, summary };
  }

  /**
   * Get RSS source statistics
   */
  async getStatistics(sourceId?: string): Promise<{
    totalSources: number;
    enabledSources: number;
    totalArticles: number;
    recentArticles: number;
    sourceBreakdown?: Array<{
      sourceId: string;
      name: string;
      articleCount: number;
      lastFetch?: Date;
      enabled: boolean;
    }>;
  }> {
    if (sourceId) {
      // Single source statistics
      const [source, articleCount, recentCount] = await Promise.all([
        prisma.newsSource.findUnique({ where: { id: sourceId } }),
        prisma.article.count({ where: { sourceId } }),
        prisma.article.count({
          where: {
            sourceId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      return {
        totalSources: 1,
        enabledSources: source?.enabled ? 1 : 0,
        totalArticles: articleCount,
        recentArticles: recentCount,
      };
    }

    // All sources statistics
    const [sources, totalArticles, recentArticles] = await Promise.all([
      prisma.newsSource.findMany({
        where: { type: { in: ['RSS', 'USER_RSS'] } },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      }),
      prisma.article.count(),
      prisma.article.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      totalSources: sources.length,
      enabledSources: sources.filter(s => s.enabled).length,
      totalArticles,
      recentArticles,
      sourceBreakdown: sources.map(source => ({
        sourceId: source.id,
        name: source.name,
        articleCount: source._count.articles,
        lastFetch: source.lastFetch || undefined,
        enabled: source.enabled,
      })),
    };
  }

  /**
   * Extract categories from RSS feed
   */
  private extractCategories(feed: any): string[] {
    const categories = new Set<string>();

    // From feed level
    if (feed.categories) {
      feed.categories.forEach((cat: string) => categories.add(cat));
    }

    // From items
    if (feed.items) {
      feed.items.forEach((item: any) => {
        if (item.categories) {
          item.categories.forEach((cat: string) => categories.add(cat));
        }
      });
    }

    return Array.from(categories);
  }
}

// Export singleton instance
export const rssSourceService = new RSSSourceService();