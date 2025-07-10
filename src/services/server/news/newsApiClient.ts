/**
 * NewsAPI Client Service
 * Integrates with NewsAPI.org for fetching international news
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { TextProcessor } from '@/utils/textProcessing';

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

interface NewsApiParams {
  q?: string;              // Keywords or phrases to search for
  category?: string;       // business, entertainment, general, health, science, sports, technology
  country?: string;        // 2-letter ISO 3166-1 country code
  sources?: string;        // Comma-separated string of news sources or blogs
  language?: string;       // Language to get articles in (default: en)
  sortBy?: string;         // relevancy, popularity, publishedAt
  pageSize?: number;       // Number of results to return (max 100)
  page?: number;          // Page number for pagination
}

export class NewsApiClient {
  private apiKey: string;
  private baseUrl: string = 'https://newsapi.org/v2';
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new Error('NEWS_API_KEY is not configured');
    }
    this.apiKey = apiKey;
  }

  /**
   * Fetch top headlines from NewsAPI
   */
  async fetchTopHeadlines(params: NewsApiParams = {}): Promise<NewsApiArticle[]> {
    const endpoint = `${this.baseUrl}/top-headlines`;
    
    // Default parameters
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      language: params.language || 'en',
      pageSize: String(params.pageSize || 20),
      ...Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v != null && v !== '')
      )
    });

    try {
      const response = await this.fetchWithRetry(`${endpoint}?${queryParams}`);
      const data: NewsApiResponse = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
      }

      return data.articles;
    } catch (error) {
      console.error('Error fetching top headlines:', error);
      throw error;
    }
  }

  /**
   * Search for articles using NewsAPI
   */
  async searchEverything(params: NewsApiParams = {}): Promise<NewsApiArticle[]> {
    const endpoint = `${this.baseUrl}/everything`;
    
    // Default parameters
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      language: params.language || 'en',
      sortBy: params.sortBy || 'publishedAt',
      pageSize: String(params.pageSize || 20),
      ...Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v != null && v !== '')
      )
    });

    try {
      const response = await this.fetchWithRetry(`${endpoint}?${queryParams}`);
      const data: NewsApiResponse = await response.json();

      if (data.status !== 'ok') {
        throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`);
      }

      return data.articles;
    } catch (error) {
      console.error('Error searching articles:', error);
      throw error;
    }
  }

  /**
   * Fetch news by category
   */
  async fetchByCategory(category: string, country: string = 'us'): Promise<NewsApiArticle[]> {
    return this.fetchTopHeadlines({ category, country });
  }

  /**
   * Search news by keywords
   */
  async searchByKeywords(keywords: string, sortBy: string = 'relevancy'): Promise<NewsApiArticle[]> {
    return this.searchEverything({ q: keywords, sortBy });
  }

  /**
   * Process and save NewsAPI articles to database
   */
  async processAndSaveArticles(
    articles: NewsApiArticle[], 
    category: string = 'general'
  ): Promise<{ processed: number; errors: string[] }> {
    let processed = 0;
    const errors: string[] = [];

    // Get or create NewsAPI source
    const source = await this.getOrCreateNewsApiSource();

    for (const article of articles) {
      try {
        // Skip articles without essential information
        if (!article.title || !article.url || !article.description) {
          continue;
        }

        // Check if article already exists
        const exists = await prisma.article.findUnique({
          where: { url: article.url }
        });

        if (exists) {
          continue;
        }

        // Extract and clean content
        const content = this.extractContent(article);
        const wordCount = this.calculateWordCount(content);
        const readingTime = Math.ceil(wordCount / 200) * 60; // seconds

        // Generate article ID
        const articleId = uuidv4();
        
        // Save article to database
        await prisma.article.create({
          data: {
            id: articleId,
            sourceId: source.id,
            title: article.title,
            summary: article.description || '',
            content: content,
            url: article.url,
            imageUrl: article.urlToImage,
            publishedAt: new Date(article.publishedAt),
            wordCount: wordCount,
            readingTime: readingTime,
            category: category,
            tags: this.extractTags(article),
            isProcessed: false,
          }
        });

        // Split content into sentences and save them
        const sentences = TextProcessor.splitIntoSentences(content);
        if (sentences.length > 0) {
          await prisma.sentence.createMany({
            data: sentences.map(sentence => ({
              id: uuidv4(),
              articleId: articleId,
              order: sentence.order,
              text: sentence.text,
              wordCount: sentence.wordCount,
            }))
          });
        }

        processed++;
      } catch (error) {
        errors.push(`Error processing article "${article.title}": ${error.message}`);
      }
    }

    // Update source last fetch time
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetch: new Date() }
    });

    return { processed, errors };
  }

  /**
   * Get or create NewsAPI source in database
   */
  private async getOrCreateNewsApiSource() {
    const sourceName = 'NewsAPI';
    
    let source = await prisma.newsSource.findFirst({
      where: { name: sourceName }
    });

    if (!source) {
      source = await prisma.newsSource.create({
        data: {
          id: uuidv4(),
          name: sourceName,
          type: 'API',
          url: 'https://newsapi.org',
          category: 'general',
          updateInterval: 60, // 60 minutes
          enabled: true,
        }
      });
    }

    return source;
  }

  /**
   * Extract content from NewsAPI article
   */
  private extractContent(article: NewsApiArticle): string {
    // NewsAPI content is often truncated with [+X chars]
    let content = article.content || article.description || '';
    
    // Remove the [+X chars] suffix
    content = content.replace(/\[\+\d+ chars\]$/, '').trim();
    
    // If content is too short, use description
    if (content.length < 100 && article.description) {
      content = article.description;
    }

    return content;
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Extract tags from article
   */
  private extractTags(article: NewsApiArticle): string[] {
    const tags: Set<string> = new Set();

    // Add source name as tag
    if (article.source.name) {
      tags.add(article.source.name.toLowerCase());
    }

    // Extract keywords from title
    const titleWords = article.title.split(/\s+/)
      .filter(word => word.length > 4)
      .map(word => word.toLowerCase());
    
    titleWords.slice(0, 3).forEach(word => tags.add(word));

    return Array.from(tags).slice(0, 5);
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, retries: number = 0): Promise<Response> {
    try {
      const response = await fetch(url);
      
      // Handle rate limiting
      if (response.status === 429 && retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries); // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retries + 1);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries);
        console.log(`Error fetching. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const newsApiClient = new NewsApiClient();