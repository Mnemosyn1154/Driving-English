/**
 * NewsAPI Provider
 * Implements INewsProvider for NewsAPI.org integration
 */

import { BaseNewsProvider, FetchResult, NewsArticle, ProviderConfig } from './INewsProvider';
import { TextProcessor } from '@/utils/textProcessing';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/lib/env';

interface NewsApiProviderConfig extends ProviderConfig {
  baseUrl?: string;
  defaultCountry?: string;
  defaultLanguage?: string;
  sources?: string[];
}

interface NewsApiArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
  message?: string;
  code?: string;
}

export class NewsApiProvider extends BaseNewsProvider {
  private textProcessor: TextProcessor;
  protected config: NewsApiProviderConfig;
  private baseUrl: string;

  constructor(providerConfig: NewsApiProviderConfig) {
    super(providerConfig);
    this.textProcessor = new TextProcessor();
    this.baseUrl = providerConfig.baseUrl || 'https://newsapi.org/v2';
    
    // Use API key from environment if not provided
    if (!this.config.apiKey) {
      this.config.apiKey = config.api.newsApiKey;
    }
  }

  async validateConfig(): Promise<boolean> {
    const baseValid = await super.validateConfig();
    return baseValid && !!this.config.apiKey;
  }

  async fetchArticles(options?: {
    categories?: string[];
    maxArticles?: number;
    since?: Date;
    query?: string;
  }): Promise<FetchResult> {
    const result: FetchResult = {
      articles: [],
      totalFetched: 0,
      totalProcessed: 0,
      errors: [],
      metadata: {
        provider: 'NewsAPI',
        fetchTime: new Date().toISOString(),
      },
    };

    if (!this.config.apiKey) {
      result.errors.push('NewsAPI key not configured');
      return result;
    }

    const maxArticles = options?.maxArticles || this.config.maxArticlesPerFetch || 50;
    const categories = options?.categories || this.config.categories || ['general'];
    const pageSize = Math.min(maxArticles, 100); // NewsAPI max is 100

    try {
      // Fetch for each category
      for (const category of categories) {
        if (result.articles.length >= maxArticles) break;

        const response = await this.fetchCategoryArticles({
          category,
          pageSize,
          query: options?.query,
        });

        if (response.status === 'ok') {
          result.totalFetched += response.articles.length;
          
          const processedArticles = await this.processArticles(
            response.articles,
            category,
            maxArticles - result.articles.length
          );
          
          result.articles.push(...processedArticles);
          result.totalProcessed += processedArticles.length;
        } else {
          result.errors.push(`NewsAPI error for category ${category}: ${response.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      const errorMsg = `NewsAPI fetch failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    this.updateStatistics(result);
    return result;
  }

  private async fetchCategoryArticles(params: {
    category: string;
    pageSize: number;
    query?: string;
  }): Promise<NewsApiResponse> {
    const { category, pageSize, query } = params;
    
    // Build URL with parameters
    const url = new URL(`${this.baseUrl}/top-headlines`);
    url.searchParams.append('apiKey', this.config.apiKey!);
    url.searchParams.append('pageSize', pageSize.toString());
    url.searchParams.append('language', this.config.defaultLanguage || 'en');
    
    if (category !== 'general') {
      url.searchParams.append('category', category);
    }
    
    if (this.config.defaultCountry) {
      url.searchParams.append('country', this.config.defaultCountry);
    }
    
    if (query) {
      url.searchParams.append('q', query);
    }

    // Make request with retry logic
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'DrivingEnglish/1.0',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === 2) throw error;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      }
    }

    throw new Error('Failed after 3 attempts');
  }

  private async processArticles(
    articles: NewsApiArticle[],
    category: string,
    maxCount: number
  ): Promise<NewsArticle[]> {
    const processed: NewsArticle[] = [];

    for (const article of articles) {
      if (processed.length >= maxCount) break;

      try {
        // Validate required fields
        if (!article.title || !article.url) continue;

        // Skip removed articles
        if (article.title === '[Removed]' || article.content === '[Removed]') continue;

        // Extract and clean content
        let content = article.content || article.description || '';
        
        // NewsAPI truncates content with [+X chars]
        if (content.includes('[+')) {
          content = content.replace(/\[\+\d+ chars\]/, '...');
        }
        
        content = this.textProcessor.cleanHtml(content);

        // Skip if no meaningful content
        if (!content || content.length < 50) continue;

        // Extract summary
        const summary = article.description 
          ? this.textProcessor.cleanHtml(article.description)
          : this.textProcessor.extractFirstSentences(content, 2);

        // Calculate metrics
        const wordCount = this.textProcessor.countWords(content);
        const readingTime = this.textProcessor.calculateReadingTime(wordCount);

        const processedArticle: NewsArticle = {
          id: uuidv4(),
          title: article.title,
          url: article.url,
          summary: summary || content.substring(0, 200) + '...',
          content,
          publishedAt: new Date(article.publishedAt),
          category,
          tags: this.extractTags(article, category),
          wordCount,
          readingTime,
          author: article.author,
          imageUrl: article.urlToImage,
          sourceName: article.source.name,
          metadata: {
            sourceId: article.source.id,
            provider: 'NewsAPI',
          },
        };

        processed.push(processedArticle);
      } catch (error) {
        console.error('Error processing NewsAPI article:', error);
      }
    }

    return processed;
  }

  private extractTags(article: NewsApiArticle, category: string): string[] {
    const tags: Set<string> = new Set();
    
    // Add category
    tags.add(category);
    
    // Add source name as tag
    if (article.source.name) {
      tags.add(article.source.name.toLowerCase());
    }

    // Extract keywords from title and description
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    
    // Common news keywords to extract as tags
    const keywordPatterns = [
      /\b(breaking|exclusive|update|analysis|report)\b/g,
      /\b(covid|pandemic|vaccine)\b/g,
      /\b(technology|tech|ai|crypto|blockchain)\b/g,
      /\b(economy|market|stock|finance)\b/g,
      /\b(climate|environment|sustainability)\b/g,
    ];

    for (const pattern of keywordPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => tags.add(match));
      }
    }

    return Array.from(tags).slice(0, 10);
  }

  async getStatistics(): Promise<{
    totalArticlesFetched: number;
    lastFetchTime?: Date;
    averageArticlesPerFetch?: number;
    errorRate?: number;
  }> {
    const stats = await super.getStatistics();
    
    // Add NewsAPI-specific stats if needed
    return {
      ...stats,
      provider: 'NewsAPI',
    } as any;
  }
}