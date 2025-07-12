/**
 * Article Content Extraction Service
 * Uses Mozilla Readability and JSDOM for content extraction
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { parse } from 'node-html-parser';

export interface ExtractionResult {
  title: string;
  content: string;
  excerpt: string;
  byline?: string;
  length: number;
  readTime: number;
  publishedTime?: string;
  siteName?: string;
  lang?: string;
  dir?: string;
}

export interface ExtractionOptions {
  url: string;
  timeout?: number;
  userAgent?: string;
}

export class ArticleExtractor {
  private readonly defaultUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private readonly defaultTimeout = 30000; // 30 seconds

  /**
   * Extract article content from URL
   */
  async extractFromUrl(options: ExtractionOptions): Promise<ExtractionResult> {
    const { url, timeout = this.defaultTimeout, userAgent = this.defaultUserAgent } = options;

    try {
      console.log(`[ArticleExtractor] Fetching content from: ${url}`);

      // Fetch HTML content
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      if (!html || html.trim().length === 0) {
        throw new Error('Empty HTML content received');
      }

      return await this.extractFromHtml(html, url);
    } catch (error) {
      console.error(`[ArticleExtractor] Error fetching from URL: ${url}`, error);
      throw new Error(`Failed to extract content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract article content from HTML string
   */
  async extractFromHtml(html: string, url: string): Promise<ExtractionResult> {
    try {
      console.log(`[ArticleExtractor] Processing HTML content (${html.length} chars)`);

      // Create JSDOM instance
      const dom = new JSDOM(html, { url });
      const doc = dom.window.document;

      // Use Readability to extract article content
      const reader = new Readability(doc, {
        debug: false,
        maxElemsToParse: 0, // No limit
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: ['caption', 'credit'],
        keepClasses: false,
      });

      const article = reader.parse();

      if (!article) {
        throw new Error('Failed to parse article content with Readability');
      }

      // Extract additional metadata
      const metadata = this.extractMetadata(doc, article);

      // Sanitize and process content
      const sanitizedContent = this.sanitizeContent(article.content);
      const plainTextContent = this.htmlToText(sanitizedContent);

      // Calculate reading time
      const readTime = this.calculateReadTime(plainTextContent);

      const result: ExtractionResult = {
        title: article.title || metadata.title || 'Untitled',
        content: sanitizedContent,
        excerpt: article.excerpt || this.generateExcerpt(plainTextContent),
        byline: article.byline || metadata.byline,
        length: article.length || plainTextContent.length,
        readTime,
        publishedTime: metadata.publishedTime,
        siteName: article.siteName || metadata.siteName,
        lang: metadata.lang,
        dir: article.dir || 'ltr',
      };

      console.log(`[ArticleExtractor] Successfully extracted article: "${result.title}" (${result.length} chars, ${result.readTime} min read)`);
      
      return result;
    } catch (error) {
      console.error('[ArticleExtractor] Error processing HTML:', error);
      throw new Error(`Failed to extract content from HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract additional metadata from document
   */
  private extractMetadata(doc: Document, article: any) {
    const metadata: any = {};

    // Try to get title from meta tags if article title is empty
    if (!article.title) {
      const titleMeta = doc.querySelector('meta[property="og:title"]') || 
                       doc.querySelector('meta[name="twitter:title"]') ||
                       doc.querySelector('title');
      metadata.title = titleMeta?.getAttribute('content') || titleMeta?.textContent || '';
    }

    // Extract byline/author
    const authorMeta = doc.querySelector('meta[name="author"]') || 
                      doc.querySelector('meta[property="article:author"]') ||
                      doc.querySelector('[rel="author"]') ||
                      doc.querySelector('.author, .byline, .by-author');
    metadata.byline = authorMeta?.getAttribute('content') || authorMeta?.textContent?.trim();

    // Extract published time
    const timeMeta = doc.querySelector('meta[property="article:published_time"]') ||
                    doc.querySelector('meta[name="publishdate"]') ||
                    doc.querySelector('time[datetime]') ||
                    doc.querySelector('.published, .publish-date, .date');
    metadata.publishedTime = timeMeta?.getAttribute('content') || 
                            timeMeta?.getAttribute('datetime') ||
                            timeMeta?.textContent?.trim();

    // Extract site name
    const siteNameMeta = doc.querySelector('meta[property="og:site_name"]') ||
                        doc.querySelector('meta[name="application-name"]');
    metadata.siteName = siteNameMeta?.getAttribute('content');

    // Extract language
    metadata.lang = doc.documentElement.getAttribute('lang') || 
                   doc.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content');

    return metadata;
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeContent(content: string): string {
    if (!content) return '';

    // Parse HTML and clean up
    const root = parse(content);

    // Remove unwanted elements
    const unwantedSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.advertisement',
      '.ads',
      '.social-share',
      '.related-articles',
      '.comments',
      '.newsletter-signup',
      '[data-ad]',
      '[class*="ad-"]',
      '[id*="ad-"]'
    ];

    unwantedSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Clean up attributes (keep only essential ones)
    root.querySelectorAll('*').forEach(el => {
      const allowedAttrs = ['href', 'src', 'alt', 'title'];
      const attrs = Object.keys(el.attributes);
      attrs.forEach(attr => {
        if (!allowedAttrs.includes(attr)) {
          el.removeAttribute(attr);
        }
      });
    });

    // Convert to string and clean up whitespace
    let cleaned = root.toString();
    
    // Remove multiple consecutive line breaks
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
    return cleaned.trim();
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    if (!html) return '';

    const root = parse(html);
    
    // Replace block elements with newlines
    root.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6').forEach(el => {
      if (el.tagName.toLowerCase() === 'br') {
        el.replaceWith('\n');
      } else {
        const text = el.text;
        el.replaceWith(text + '\n');
      }
    });

    return root.text
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(text: string, maxLength: number = 200): string {
    if (!text) return '';

    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Try to cut at a sentence boundary
    const sentences = cleaned.split(/[.!?]+/);
    let excerpt = '';
    
    for (const sentence of sentences) {
      const potential = excerpt + sentence + '.';
      if (potential.length > maxLength) {
        break;
      }
      excerpt = potential;
    }

    // If no sentence boundary found, cut at word boundary
    if (!excerpt) {
      const words = cleaned.split(' ');
      excerpt = words.slice(0, Math.floor(maxLength / 6)).join(' ');
      excerpt += '...';
    }

    return excerpt.trim();
  }

  /**
   * Calculate estimated reading time
   */
  private calculateReadTime(text: string): number {
    if (!text) return 0;

    // Average reading speed: 200-250 words per minute
    // We'll use 225 words per minute as a middle ground
    const wordsPerMinute = 225;
    const words = text.trim().split(/\s+/).length;
    const readTime = Math.ceil(words / wordsPerMinute);

    return Math.max(1, readTime); // Minimum 1 minute
  }

  /**
   * Validate extraction result
   */
  private validateResult(result: ExtractionResult): boolean {
    return (
      result.title.length > 0 &&
      result.content.length > 100 && // Minimum content length
      result.length > 0
    );
  }
}

// Export singleton instance
export const articleExtractor = new ArticleExtractor();