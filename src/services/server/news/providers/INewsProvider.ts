/**
 * News Provider Interface
 * Abstract interface for all news providers
 */

export interface NewsArticle {
  id?: string;
  title: string;
  url: string;
  summary: string;
  content: string;
  publishedAt: Date;
  category: string;
  tags: string[];
  wordCount: number;
  readingTime: number;
  author?: string;
  imageUrl?: string;
  sourceName: string;
  sourceUrl?: string;
  metadata?: Record<string, any>;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  maxArticlesPerFetch?: number;
  categories?: string[];
  language?: string;
  country?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface FetchResult {
  articles: NewsArticle[];
  totalFetched: number;
  totalProcessed: number;
  errors: string[];
  metadata?: Record<string, any>;
}

export interface INewsProvider {
  /**
   * Provider name
   */
  getName(): string;

  /**
   * Check if provider is enabled
   */
  isEnabled(): boolean;

  /**
   * Fetch articles from the provider
   */
  fetchArticles(options?: {
    categories?: string[];
    maxArticles?: number;
    since?: Date;
    query?: string;
  }): Promise<FetchResult>;

  /**
   * Validate provider configuration
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider statistics
   */
  getStatistics(): Promise<{
    totalArticlesFetched: number;
    lastFetchTime?: Date;
    averageArticlesPerFetch?: number;
    errorRate?: number;
  }>;
}

/**
 * Base abstract class for news providers
 */
export abstract class BaseNewsProvider implements INewsProvider {
  protected config: ProviderConfig;
  protected fetchCount: number = 0;
  protected lastFetchTime?: Date;
  protected totalArticlesFetched: number = 0;
  protected errorCount: number = 0;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  getName(): string {
    return this.config.name;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  abstract fetchArticles(options?: {
    categories?: string[];
    maxArticles?: number;
    since?: Date;
    query?: string;
  }): Promise<FetchResult>;

  async validateConfig(): Promise<boolean> {
    // Base validation - can be overridden by specific providers
    return !!(this.config.name && typeof this.config.enabled === 'boolean');
  }

  async getStatistics(): Promise<{
    totalArticlesFetched: number;
    lastFetchTime?: Date;
    averageArticlesPerFetch?: number;
    errorRate?: number;
  }> {
    return {
      totalArticlesFetched: this.totalArticlesFetched,
      lastFetchTime: this.lastFetchTime,
      averageArticlesPerFetch: this.fetchCount > 0 ? this.totalArticlesFetched / this.fetchCount : 0,
      errorRate: this.fetchCount > 0 ? this.errorCount / this.fetchCount : 0,
    };
  }

  /**
   * Update statistics after fetch
   */
  protected updateStatistics(result: FetchResult) {
    this.fetchCount++;
    this.lastFetchTime = new Date();
    this.totalArticlesFetched += result.totalProcessed;
    if (result.errors.length > 0) {
      this.errorCount++;
    }
  }
}