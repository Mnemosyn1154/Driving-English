/**
 * News Fetcher Service
 * Fetches news from RSS feeds and APIs
 */

import Parser from 'rss-parser';
import fetch from 'node-fetch';
import { 
  NewsSource, 
  Article, 
  NewsFetchResult, 
  NewsApiResponse,
  RssFeedItem,
  ArticleMetadata,
  NewsCategory,
} from '@/types/news';
import { NEWS_SOURCES, NEWS_API_CONFIG } from '@/config/news-sources';

export class NewsFetcher {
  private rssParser: Parser;
  private sources: NewsSource[];

  constructor(sources: NewsSource[] = NEWS_SOURCES) {
    this.rssParser = new Parser({
      headers: {
        'User-Agent': 'DrivingEnglish/1.0',
      },
      timeout: 30000, // 30 seconds
      customFields: {
        item: [
          ['media:content', 'media:content', { keepArray: true }],
          ['media:thumbnail', 'media:thumbnail'],
          ['enclosure', 'enclosure'],
        ],
      },
    });
    
    this.sources = sources.filter(source => source.enabled);
  }

  /**
   * Fetch news from all enabled sources
   */
  async fetchAllNews(): Promise<NewsFetchResult[]> {
    const results = await Promise.allSettled(
      this.sources.map(source => this.fetchFromSource(source))
    );

    return results
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Failed to fetch from ${this.sources[index].name}:`, result.reason);
          return {
            source: this.sources[index].id,
            articlesCount: 0,
            articles: [],
            fetchedAt: new Date(),
            errors: [result.reason.message],
          };
        }
      })
      .filter(result => result.articlesCount > 0);
  }

  /**
   * Fetch news from a specific source
   */
  async fetchFromSource(source: NewsSource): Promise<NewsFetchResult> {
    try {
      let articles: Partial<Article>[] = [];

      if (source.type === 'rss') {
        articles = await this.fetchFromRss(source);
      } else if (source.type === 'api') {
        articles = await this.fetchFromApi(source);
      }

      // Update last fetch time
      source.lastFetch = new Date();

      return {
        source: source.id,
        articlesCount: articles.length,
        articles,
        fetchedAt: new Date(),
      };
    } catch (error: any) {
      console.error(`Error fetching from ${source.name}:`, error);
      return {
        source: source.id,
        articlesCount: 0,
        articles: [],
        fetchedAt: new Date(),
        errors: [error.message],
      };
    }
  }

  /**
   * Fetch from RSS feed
   */
  private async fetchFromRss(source: NewsSource): Promise<Partial<Article>[]> {
    const feed = await this.rssParser.parseURL(source.url);
    
    return feed.items.map((item: RssFeedItem) => {
      const metadata: ArticleMetadata = {
        source: source.name,
        author: item.creator || undefined,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        category: source.category,
        originalUrl: item.link || '',
        imageUrl: this.extractImageUrl(item),
        tags: item.categories || [],
      };

      return {
        title: item.title || 'Untitled',
        summary: item.contentSnippet || item.content || '',
        content: item.content || item.contentSnippet || '',
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        isProcessed: false,
        wordCount: 0, // Will be calculated during processing
        estimatedReadTime: 0, // Will be calculated during processing
      };
    });
  }

  /**
   * Fetch from News API
   */
  private async fetchFromApi(source: NewsSource): Promise<Partial<Article>[]> {
    if (!NEWS_API_CONFIG.apiKey) {
      throw new Error('News API key not configured');
    }

    const params = new URLSearchParams({
      apiKey: NEWS_API_CONFIG.apiKey,
      country: NEWS_API_CONFIG.defaultCountry,
      category: source.category,
      pageSize: String(NEWS_API_CONFIG.defaultPageSize),
    });

    const response = await fetch(`${source.url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`News API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NewsApiResponse;

    if (data.status !== 'ok') {
      throw new Error('News API returned error status');
    }

    return data.articles.map(article => {
      const metadata: ArticleMetadata = {
        source: article.source.name,
        author: article.author || undefined,
        publishedAt: new Date(article.publishedAt),
        category: source.category,
        originalUrl: article.url,
        imageUrl: article.urlToImage || undefined,
      };

      return {
        title: article.title,
        summary: article.description,
        content: article.content || article.description,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        isProcessed: false,
        wordCount: 0,
        estimatedReadTime: 0,
      };
    });
  }

  /**
   * Extract image URL from RSS item
   */
  private extractImageUrl(item: RssFeedItem): string | undefined {
    // Try different ways to get image
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }

    // Check media:thumbnail
    if ((item as any)['media:thumbnail']?.url) {
      return (item as any)['media:thumbnail'].url;
    }

    // Check media:content
    const mediaContent = (item as any)['media:content'];
    if (Array.isArray(mediaContent)) {
      const image = mediaContent.find(media => 
        media.$.type?.startsWith('image/') || media.$.medium === 'image'
      );
      if (image?.$?.url) {
        return image.$.url;
      }
    }

    // Try to extract from content
    const imgMatch = item.content?.match(/<img[^>]+src="([^"]+)"/);
    if (imgMatch) {
      return imgMatch[1];
    }

    return undefined;
  }

  /**
   * Fetch news by category
   */
  async fetchByCategory(category: NewsCategory): Promise<NewsFetchResult[]> {
    const categorySources = this.sources.filter(source => source.category === category);
    
    const results = await Promise.allSettled(
      categorySources.map(source => this.fetchFromSource(source))
    );

    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<NewsFetchResult>).value);
  }

  /**
   * Get available sources
   */
  getAvailableSources(): NewsSource[] {
    return this.sources;
  }

  /**
   * Check if a source needs update
   */
  needsUpdate(source: NewsSource): boolean {
    if (!source.lastFetch) {
      return true;
    }

    const now = Date.now();
    const lastFetch = source.lastFetch.getTime();
    const updateInterval = source.updateInterval * 60 * 1000; // Convert minutes to milliseconds

    return (now - lastFetch) >= updateInterval;
  }

  /**
   * Fetch news that need updates
   */
  async fetchUpdates(): Promise<NewsFetchResult[]> {
    const sourcesToUpdate = this.sources.filter(source => this.needsUpdate(source));
    
    if (sourcesToUpdate.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      sourcesToUpdate.map(source => this.fetchFromSource(source))
    );

    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<NewsFetchResult>).value);
  }
}