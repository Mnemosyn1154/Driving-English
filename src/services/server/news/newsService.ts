import { prisma } from '../database/prisma';
import { cacheGet, cacheSet } from '../cache';
import { newsQueue, processingQueue } from '../jobs/queue';
import { Prisma } from '@prisma/client';
import { newsAggregatorV2 } from './newsAggregatorV2';
import { ProviderFactory } from './providers';

export interface NewsFilters {
  category?: string;
  difficulty?: number;
  minDifficulty?: number;
  maxDifficulty?: number;
  isProcessed?: boolean;
  search?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: 'publishedAt' | 'difficulty' | 'readingTime';
  order?: 'asc' | 'desc';
}

export class NewsService {
  /**
   * Get articles with filtering and pagination
   */
  async getArticles(
    filters: NewsFilters = {},
    pagination: PaginationOptions = {}
  ) {
    const {
      category,
      difficulty,
      minDifficulty,
      maxDifficulty,
      // isProcessed = true, // 성능 개선을 위해 기본값 제거
      isProcessed,
      search,
      tags,
      dateFrom,
      dateTo,
    } = filters;

    const {
      page = 1,
      limit = 20,
      orderBy = 'publishedAt',
      order = 'desc',
    } = pagination;

    // Build where clause
    const where: Prisma.ArticleWhereInput = {
      ...(isProcessed !== undefined && { isProcessed }),
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      ...(minDifficulty && { difficulty: { gte: minDifficulty } }),
      ...(maxDifficulty && { difficulty: { lte: maxDifficulty } }),
      ...(minDifficulty && maxDifficulty && {
        difficulty: { gte: minDifficulty, lte: maxDifficulty },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(tags && tags.length > 0 && {
        tags: { hasSome: tags },
      }),
      ...(dateFrom && { publishedAt: { gte: dateFrom } }),
      ...(dateTo && { publishedAt: { lte: dateTo } }),
      ...(dateFrom && dateTo && {
        publishedAt: { gte: dateFrom, lte: dateTo },
      }),
    };

    // Check cache
    const cacheKey = `articles:${JSON.stringify({ filters, pagination })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get total count
    const total = await prisma.article.count({ where });

    // Get articles
    const articles = await prisma.article.findMany({
      where,
      include: {
        source: {
          select: { name: true },
        },
        // sentences 제거 - 필요시에만 로드
      },
      orderBy: { [orderBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Format response
    const response = {
      articles: articles.map(article => ({
        ...article,
        sentenceCount: 0, // 임시로 0으로 설정
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, JSON.stringify(response), 300);

    return response;
  }

  /**
   * Get single article with sentences
   */
  async getArticle(articleId: string) {
    // Check cache
    const cacheKey = `article:${articleId}:full`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        source: true,
        sentences: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!article) {
      return null;
    }

    // Track access
    await prisma.cacheEntry.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        type: 'NEWS',
        size: JSON.stringify(article).length,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      },
      update: {
        hits: { increment: 1 },
        lastAccessed: new Date(),
      },
    });

    // Cache for 1 hour
    await cacheSet(cacheKey, JSON.stringify(article), 3600);

    return article;
  }

  /**
   * Get article recommendations for a user
   */
  async getRecommendations(userId: string, limit: number = 5) {
    // Get user preferences and progress
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        progress: {
          select: { articleId: true },
          where: { isCompleted: true },
        },
        preferences: true,
      },
    });

    if (!user) {
      // Return default recommendations
      return this.getArticles(
        { difficulty: 3, isProcessed: true },
        { limit, orderBy: 'publishedAt' }
      );
    }

    // Get completed article IDs
    const completedIds = user.progress.map(p => p.articleId);

    // Get user's preferred categories
    const preferredCategories = user.preferences
      .filter(p => p.key === 'preferred_category')
      .map(p => p.value);

    // Find articles matching user level that haven't been completed
    const recommendations = await prisma.article.findMany({
      where: {
        isProcessed: true,
        difficulty: {
          gte: Math.max(1, user.preferredLevel - 1),
          lte: Math.min(5, user.preferredLevel + 1),
        },
        id: { notIn: completedIds },
        ...(preferredCategories.length > 0 && {
          category: { in: preferredCategories },
        }),
      },
      orderBy: [
        { difficulty: 'asc' },
        { publishedAt: 'desc' },
      ],
      take: limit,
    });

    return {
      articles: recommendations,
      pagination: {
        page: 1,
        limit,
        total: recommendations.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };
  }

  /**
   * Trigger news refresh
   */
  async refreshNews(sourceId?: string) {
    if (sourceId) {
      await newsQueue.add('fetch-source', { sourceId });
      return { message: 'News refresh queued for source', sourceId };
    } else {
      await newsQueue.add('fetch-all-sources', {});
      return { message: 'News refresh queued for all sources' };
    }
  }

  /**
   * Process unprocessed articles
   */
  async processArticles(limit: number = 10) {
    const unprocessed = await prisma.article.findMany({
      where: {
        isProcessed: false,
        processingError: null,
      },
      orderBy: [
        { difficulty: 'asc' },
        { publishedAt: 'desc' },
      ],
      take: limit,
    });

    for (const article of unprocessed) {
      await processingQueue.add('process-article', {
        articleId: article.id,
      });
    }

    return {
      message: `Queued ${unprocessed.length} articles for processing`,
      articleIds: unprocessed.map(a => a.id),
    };
  }

  /**
   * Get article statistics
   */
  async getStatistics() {
    const [
      totalArticles,
      processedArticles,
      totalSentences,
      articlesByCategory,
      articlesByDifficulty,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { isProcessed: true } }),
      prisma.sentence.count(),
      prisma.article.groupBy({
        by: ['category'],
        _count: true,
      }),
      prisma.article.groupBy({
        by: ['difficulty'],
        _count: true,
        where: { isProcessed: true },
      }),
    ]);

    return {
      totalArticles,
      processedArticles,
      unprocessedArticles: totalArticles - processedArticles,
      totalSentences,
      articlesByCategory: articlesByCategory.map(c => ({
        category: c.category,
        count: c._count,
      })),
      articlesByDifficulty: articlesByDifficulty.map(d => ({
        difficulty: d.difficulty,
        count: d._count,
      })),
    };
  }

  /**
   * Get latest articles
   */
  async getLatestArticles(
    filters: NewsFilters = {},
    pagination: PaginationOptions = {}
  ) {
    // Force sort by publishedAt desc for latest articles
    return this.getArticles(
      filters,
      {
        ...pagination,
        orderBy: 'publishedAt',
        order: 'desc',
      }
    );
  }

  /**
   * Get personalized articles for a user
   */
  async getPersonalizedArticles(
    userId: string,
    deviceId: string | null,
    pagination: PaginationOptions = {}
  ) {
    // Get user preferences
    let preferences = {
      categories: [] as string[],
      keywords: [] as string[],
    };

    if (userId) {
      // Get from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferences: true,
          keywords: {
            orderBy: { weight: 'desc' },
            take: 10
          }
        }
      });

      if (user) {
        const categoriesPref = user.preferences.find(p => p.key === 'categories');
        if (categoriesPref) {
          preferences.categories = JSON.parse(categoriesPref.value);
        }
        
        preferences.keywords = user.keywords.map(k => k.keyword);
      }
    } else {
      // Default preferences for non-authenticated users
      preferences = {
        categories: ['technology', 'business', 'science'],
        keywords: []
      };
    }

    // Fetch articles based on preferences
    const where: Prisma.ArticleWhereInput = {
      isProcessed: true,
      ...(preferences.categories.length > 0 && {
        category: { in: preferences.categories }
      }),
      publishedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    };

    const articles = await prisma.article.findMany({
      where,
      include: {
        source: true,
        sentences: {
          take: 3,
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { publishedAt: 'desc' },
      skip: ((pagination.page || 1) - 1) * (pagination.limit || 20),
      take: pagination.limit || 20,
    });

    const total = await prisma.article.count({ where });

    // Score articles based on keywords
    const scoredArticles = articles.map(article => {
      let score = 0;
      
      // Keyword matching
      preferences.keywords.forEach(keyword => {
        if (article.title.toLowerCase().includes(keyword.toLowerCase()) ||
            article.summary.toLowerCase().includes(keyword.toLowerCase())) {
          score += 10;
        }
      });
      
      // Recency score
      const ageInDays = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - ageInDays);
      
      return { ...article, score };
    });

    // Sort by score
    scoredArticles.sort((a, b) => b.score - a.score);

    return {
      articles: scoredArticles.map(({ score, ...article }) => article),
      preferences,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total,
        totalPages: Math.ceil(total / (pagination.limit || 20)),
        hasNext: ((pagination.page || 1) * (pagination.limit || 20)) < total,
        hasPrevious: (pagination.page || 1) > 1,
      },
    };
  }

  /**
   * Aggregate news using the new provider pattern
   */
  async aggregateNews(options?: {
    categories?: string[];
    providers?: string[];
    force?: boolean;
  }) {
    return await newsAggregatorV2.aggregateNews(options);
  }

  /**
   * Get aggregation statistics
   */
  async getAggregationStatistics() {
    return await newsAggregatorV2.getStatistics();
  }

  /**
   * Get available news providers
   */
  async getProviders() {
    const providers = await ProviderFactory.getEnabledProviders();
    return providers.map(provider => ({
      name: provider.getName(),
      enabled: provider.isEnabled(),
      statistics: provider.getStatistics(),
    }));
  }

  /**
   * Refresh specific providers
   */
  async refreshProviders(providerNames?: string[]) {
    // Clear provider cache to reload configuration
    ProviderFactory.clearCache();
    
    // Run aggregation with specific providers
    return await this.aggregateNews({
      providers: providerNames,
      force: true,
    });
  }
}