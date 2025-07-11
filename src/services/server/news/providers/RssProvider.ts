/**
 * RSS Feed Provider
 * Implements INewsProvider for RSS feed sources
 */

import Parser from 'rss-parser';
import { BaseNewsProvider, FetchResult, NewsArticle, ProviderConfig } from './INewsProvider';
import { prisma } from '@/lib/prisma';
import { TextProcessor } from '@/utils/textProcessing';
import { v4 as uuidv4 } from 'uuid';

interface RssProviderConfig extends ProviderConfig {
  feedUrls: string[];
  categoryMapping?: Record<string, string[]>; // RSS category to our category mapping
}

export class RssProvider extends BaseNewsProvider {
  private parser: Parser;
  private textProcessor: TextProcessor;
  protected config: RssProviderConfig;

  // Category keywords for classification
  private categoryKeywords = {
    technology: ['tech', 'software', 'hardware', 'computer', 'internet', 'ai', 'machine learning', 'crypto', 'blockchain', 'startup', 'innovation'],
    business: ['business', 'economy', 'finance', 'market', 'stock', 'company', 'corporate', 'trade', 'investment', 'startup'],
    science: ['science', 'research', 'study', 'discovery', 'physics', 'chemistry', 'biology', 'space', 'climate', 'environment'],
    health: ['health', 'medical', 'medicine', 'doctor', 'hospital', 'disease', 'treatment', 'wellness', 'fitness', 'nutrition'],
    sports: ['sports', 'game', 'match', 'player', 'team', 'league', 'football', 'basketball', 'soccer', 'tennis'],
    entertainment: ['entertainment', 'movie', 'film', 'music', 'celebrity', 'show', 'tv', 'series', 'artist', 'concert'],
    politics: ['politics', 'government', 'election', 'president', 'minister', 'policy', 'law', 'congress', 'parliament'],
    world: ['international', 'global', 'world', 'country', 'nation', 'foreign', 'diplomatic'],
  };

  constructor(config: RssProviderConfig) {
    super(config);
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'DrivingEnglish/1.0 (Learning Platform)',
      },
    });
    this.textProcessor = new TextProcessor();
  }

  async validateConfig(): Promise<boolean> {
    const baseValid = await super.validateConfig();
    return baseValid && 
           Array.isArray(this.config.feedUrls) && 
           this.config.feedUrls.length > 0;
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
    };

    const maxArticles = options?.maxArticles || this.config.maxArticlesPerFetch || 50;
    const targetCategories = options?.categories || this.config.categories || ['general'];
    const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    // Get RSS sources from database or use config URLs
    const feedUrls = await this.getFeedUrls(targetCategories);

    for (const feedUrl of feedUrls) {
      if (result.articles.length >= maxArticles) break;

      try {
        const feed = await this.parser.parseURL(feedUrl);
        const feedArticles = await this.processFeed(feed, feedUrl, targetCategories, since);
        
        result.totalFetched += feed.items?.length || 0;
        result.articles.push(...feedArticles);
        result.totalProcessed += feedArticles.length;

        // Limit to maxArticles
        if (result.articles.length > maxArticles) {
          result.articles = result.articles.slice(0, maxArticles);
        }
      } catch (error) {
        const errorMsg = `Failed to parse RSS feed ${feedUrl}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    this.updateStatistics(result);
    return result;
  }

  private async getFeedUrls(categories: string[]): Promise<string[]> {
    // Try to get from database first
    const dbSources = await prisma.newsSource.findMany({
      where: {
        type: 'RSS',
        enabled: true,
        category: { in: categories },
      },
      select: { url: true },
    });

    if (dbSources.length > 0) {
      return dbSources.map(s => s.url);
    }

    // Fallback to config URLs
    return this.config.feedUrls;
  }

  private async processFeed(
    feed: any,
    feedUrl: string,
    targetCategories: string[],
    since: Date
  ): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    for (const item of feed.items || []) {
      try {
        // Skip if too old
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        if (pubDate < since) continue;

        // Extract and validate required fields
        const title = item.title?.trim();
        const url = item.link?.trim();
        if (!title || !url || !this.isValidUrl(url)) continue;

        // Check if English content
        if (!this.textProcessor.isEnglish(title)) continue;

        // Extract content
        const content = this.extractContent(item);
        const summary = this.extractSummary(item, content);

        // Categorize article
        const category = this.categorizeArticle(item, targetCategories);

        // Calculate metrics
        const sentences = this.textProcessor.splitIntoSentences(content);
        const wordCount = this.textProcessor.countWords(content);
        const readingTime = this.textProcessor.calculateReadingTime(wordCount);

        const article: NewsArticle = {
          id: uuidv4(),
          title,
          url,
          summary,
          content,
          publishedAt: pubDate,
          category,
          tags: this.extractTags(item),
          wordCount,
          readingTime,
          author: item.creator || item.author || null,
          sourceName: feed.title || 'RSS Feed',
          sourceUrl: feedUrl,
          metadata: {
            guid: item.guid || item.id || url,
            feedTitle: feed.title,
            feedUrl: feedUrl,
          },
        };

        articles.push(article);
      } catch (error) {
        console.error(`Error processing RSS item:`, error);
      }
    }

    return articles;
  }

  private extractContent(item: any): string {
    // Try different content fields
    const content = item.content || 
                   item['content:encoded'] || 
                   item.contentSnippet || 
                   item.description || 
                   item.summary || 
                   '';
    
    // Clean HTML and normalize
    return this.textProcessor.cleanHtml(content);
  }

  private extractSummary(item: any, content: string): string {
    // Try to get summary from feed
    let summary = item.contentSnippet || item.description || '';
    summary = this.textProcessor.cleanHtml(summary);

    // If no summary or too short, extract from content
    if (!summary || summary.length < 50) {
      summary = this.textProcessor.extractFirstSentences(content, 2);
    }

    // Ensure summary is not too long
    if (summary.length > 500) {
      summary = summary.substring(0, 497) + '...';
    }

    return summary;
  }

  private categorizeArticle(item: any, targetCategories: string[]): string {
    // Check item categories first
    if (item.categories && Array.isArray(item.categories)) {
      for (const itemCat of item.categories) {
        const normalized = itemCat.toLowerCase();
        
        // Check category mapping
        if (this.config.categoryMapping) {
          for (const [ourCat, rssCats] of Object.entries(this.config.categoryMapping)) {
            if (rssCats.includes(normalized) && targetCategories.includes(ourCat)) {
              return ourCat;
            }
          }
        }

        // Check direct match
        if (targetCategories.includes(normalized)) {
          return normalized;
        }
      }
    }

    // Use keyword-based categorization
    const text = `${item.title} ${item.description || ''}`.toLowerCase();
    
    for (const category of targetCategories) {
      const keywords = this.categoryKeywords[category as keyof typeof this.categoryKeywords];
      if (keywords) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            return category;
          }
        }
      }
    }

    // Default category
    return targetCategories.includes('general') ? 'general' : targetCategories[0];
  }

  private extractTags(item: any): string[] {
    const tags: Set<string> = new Set();

    // From categories
    if (item.categories && Array.isArray(item.categories)) {
      item.categories.forEach((cat: string) => {
        tags.add(cat.toLowerCase().trim());
      });
    }

    // From keywords
    if (item.keywords) {
      const keywords = Array.isArray(item.keywords) ? item.keywords : item.keywords.split(',');
      keywords.forEach((kw: string) => {
        tags.add(kw.toLowerCase().trim());
      });
    }

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}