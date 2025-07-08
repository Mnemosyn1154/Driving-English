/**
 * RSS Feed Parser Service
 * Parses RSS feeds and extracts English news articles
 */

import Parser from 'rss-parser';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { URL } from 'url';

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  creator?: string;
  guid?: string;
}

interface ParsedArticle {
  title: string;
  url: string;
  summary: string;
  content: string;
  publishedAt: Date;
  category: string;
  tags: string[];
  wordCount: number;
  readingTime: number;
}

export class RSSParserService {
  private parser: Parser;
  
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


  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Driving English News Bot/1.0',
      },
    });
  }

  /**
   * Process RSS feed and save articles to database
   */
  async processFeed(feedUrl: string, userId?: string): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Validate URL
      if (!this.isValidUrl(feedUrl)) {
        throw new Error('Invalid RSS feed URL');
      }

      // Parse RSS feed
      const feed = await this.parser.parseURL(feedUrl);
      
      if (!feed.items || feed.items.length === 0) {
        throw new Error('No items found in RSS feed');
      }

      // Get or create news source
      const source = await this.getOrCreateSource(feedUrl, feed.title || 'Unknown Source');

      // Process each item
      for (const item of feed.items) {
        try {
          const article = this.parseRSSItem(item, source.name);
          
          if (article) {
            // Check if article already exists
            const exists = await prisma.article.findUnique({
              where: { url: article.url }
            });

            if (!exists) {
              // Save article to database
              await prisma.article.create({
                data: {
                  id: uuidv4(),
                  sourceId: source.id,
                  title: article.title,
                  summary: article.summary,
                  content: article.content,
                  url: article.url,
                  publishedAt: article.publishedAt,
                  difficulty: 3, // Default medium difficulty
                  wordCount: article.wordCount,
                  readingTime: article.readingTime,
                  category: article.category,
                  tags: article.tags,
                  isProcessed: false, // Will be processed later for translation
                }
              });
              processed++;
            }
          }
        } catch (itemError) {
          errors.push(`Error processing item "${item.title}": ${itemError.message}`);
        }
      }

      // Update source last fetch time
      await prisma.newsSource.update({
        where: { id: source.id },
        data: { lastFetch: new Date() }
      });

      // If userId provided, save as user's RSS feed
      if (userId) {
        await prisma.userRssFeed.upsert({
          where: {
            userId_url: { userId, url: feedUrl }
          },
          update: {
            name: feed.title || source.name,
            enabled: true,
          },
          create: {
            userId,
            name: feed.title || source.name,
            url: feedUrl,
            category: source.category,
            enabled: true,
          }
        });
      }

    } catch (error) {
      errors.push(`Feed error: ${error.message}`);
    }

    return { processed, errors };
  }

  /**
   * Parse single RSS item
   */
  private parseRSSItem(item: RSSItem, sourceName: string): ParsedArticle | null {
    if (!item.title || !item.link) {
      return null;
    }

    // Clean and extract content
    const content = this.cleanHtml(item.content || item.contentSnippet || '');
    const summary = this.cleanHtml(item.contentSnippet || content.substring(0, 200));
    
    if (!content || content.length < 100) {
      return null; // Skip items with too little content
    }

    // Calculate metrics
    const wordCount = this.calculateWordCount(content);
    const readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute
    
    // Determine category
    const category = this.classifyCategory(item.title + ' ' + content, item.categories);
    
    // Extract tags
    const tags = this.extractTags(content, item.categories);

    return {
      title: this.cleanHtml(item.title),
      url: item.link,
      summary: summary.substring(0, 500),
      content,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      category,
      tags,
      wordCount,
      readingTime,
    };
  }

  /**
   * Get or create news source
   */
  private async getOrCreateSource(feedUrl: string, feedTitle: string) {
    const existingSource = await prisma.newsSource.findFirst({
      where: { url: feedUrl }
    });

    if (existingSource) {
      return existingSource;
    }

    // Extract domain name for source name
    const url = new URL(feedUrl);
    const sourceName = feedTitle || url.hostname.replace('www.', '');

    return prisma.newsSource.create({
      data: {
        id: uuidv4(),
        name: sourceName,
        type: 'RSS',
        url: feedUrl,
        category: 'general',
        updateInterval: 60, // 60 minutes default
        enabled: true,
      }
    });
  }

  /**
   * Validate URL format
   */
  private isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Remove HTML tags and clean text
   */
  private cleanHtml(text: string): string {
    if (!text) return '';
    
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-zA-Z0-9]+;/g, ' ');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    return cleaned;
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Classify article category based on content
   */
  private classifyCategory(text: string, rssCategories?: string[]): string {
    const lowerText = text.toLowerCase();
    const scores: Record<string, number> = {};
    
    // Check RSS categories first
    if (rssCategories && rssCategories.length > 0) {
      const rssCategoryStr = rssCategories.join(' ').toLowerCase();
      for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
        for (const keyword of keywords) {
          if (rssCategoryStr.includes(keyword)) {
            scores[category] = (scores[category] || 0) + 2; // Higher weight for RSS categories
          }
        }
      }
    }
    
    // Check content
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          scores[category] = (scores[category] || 0) + matches.length;
        }
      }
    }
    
    // Find category with highest score
    let bestCategory = 'general';
    let highestScore = 0;
    
    for (const [category, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  /**
   * Extract tags from content
   */
  private extractTags(text: string, rssCategories?: string[]): string[] {
    const tags: Set<string> = new Set();
    
    // Add RSS categories as tags
    if (rssCategories) {
      rssCategories.forEach(cat => {
        if (cat && cat.length < 20) {
          tags.add(cat.toLowerCase());
        }
      });
    }
    
    // Extract proper nouns (simple implementation)
    const words = text.split(/\s+/);
    const properNouns = words.filter(word => 
      word.length > 3 && 
      word[0] === word[0].toUpperCase() && 
      /^[A-Za-z]+$/.test(word)
    );
    
    // Add most frequent proper nouns as tags
    const nounCounts: Record<string, number> = {};
    properNouns.forEach(noun => {
      nounCounts[noun] = (nounCounts[noun] || 0) + 1;
    });
    
    Object.entries(nounCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([noun]) => tags.add(noun.toLowerCase()));
    
    return Array.from(tags).slice(0, 10);
  }

  /**
   * Process multiple RSS feeds
   */
  async processMultipleFeeds(feedUrls: string[], userId?: string): Promise<{ total: number; errors: string[] }> {
    let totalProcessed = 0;
    const allErrors: string[] = [];

    for (const feedUrl of feedUrls) {
      const { processed, errors } = await this.processFeed(feedUrl, userId);
      totalProcessed += processed;
      allErrors.push(...errors);
    }

    return { total: totalProcessed, errors: allErrors };
  }

  /**
   * Get user's RSS feeds and process them
   */
  async processUserFeeds(userId: string): Promise<{ total: number; errors: string[] }> {
    const userFeeds = await prisma.userRssFeed.findMany({
      where: { userId, enabled: true },
      select: { url: true }
    });

    const feedUrls = userFeeds.map(feed => feed.url);
    return this.processMultipleFeeds(feedUrls, userId);
  }
}

// Export singleton instance
export const rssParser = new RSSParserService();