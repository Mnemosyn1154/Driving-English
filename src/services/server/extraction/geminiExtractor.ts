/**
 * Gemini AI-based Article Content Extraction Service
 * Fallback service for complex article extraction when Readability fails
 */

import { GeminiTranslator } from '../translation/geminiTranslator';
import { parse } from 'node-html-parser';

export interface GeminiExtractionResult {
  title: string;
  content: string;
  summary: string;
  author?: string;
  publishedDate?: string;
  confidence: number; // 0-1 사이의 신뢰도
}

export class GeminiExtractor {
  private geminiTranslator: GeminiTranslator;
  private maxRetries = 2;

  constructor() {
    this.geminiTranslator = new GeminiTranslator();
  }

  /**
   * Extract article content from HTML using Gemini AI
   */
  async extractFromHtml(html: string, url: string): Promise<GeminiExtractionResult> {
    try {
      console.log(`[GeminiExtractor] Starting extraction for URL: ${url}`);

      // Clean and preprocess HTML
      const cleanedHtml = this.preprocessHtml(html);
      
      if (cleanedHtml.length > 50000) {
        // If HTML is too large, truncate to focus on main content
        console.warn(`[GeminiExtractor] HTML too large (${cleanedHtml.length} chars), truncating`);
      }

      // Create extraction prompt
      const prompt = this.createExtractionPrompt(cleanedHtml, url);

      // Call Gemini API with retry logic
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`[GeminiExtractor] Attempt ${attempt}/${this.maxRetries}`);

          const response = await this.geminiTranslator.translate({
            id: `extract_${Date.now()}`,
            text: prompt,
            sourceLanguage: 'en',
            targetLanguage: 'en', // We want the response in the same language as the prompt
            type: 'article',
          });

          // Parse Gemini response
          const result = this.parseGeminiResponse(response.translatedText);

          // Validate extraction
          if (this.validateExtraction(result)) {
            console.log(`[GeminiExtractor] Successfully extracted article: "${result.title}" (confidence: ${result.confidence})`);
            return result;
          } else {
            throw new Error('Extracted content failed validation');
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`[GeminiExtractor] Attempt ${attempt} failed:`, error);
          
          if (attempt < this.maxRetries) {
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      throw new Error(`Failed to extract content after ${this.maxRetries} attempts: ${lastError?.message}`);
    } catch (error) {
      console.error('[GeminiExtractor] Error extracting content:', error);
      throw new Error(`Gemini extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preprocess HTML to remove unnecessary content and focus on main article
   */
  private preprocessHtml(html: string): string {
    const root = parse(html);

    // Remove unwanted elements that add noise
    const unwantedSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      'iframe',
      'embed',
      'object',
      '.advertisement',
      '.ads',
      '.social-share',
      '.newsletter',
      '.popup',
      '.modal',
      '.comments',
      '.sidebar',
      '[data-ad]',
      '[class*="ad-"]',
      '[id*="ad-"]',
      '[class*="social"]',
      '[class*="share"]',
      '[class*="popup"]',
      '[class*="newsletter"]',
    ];

    unwantedSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Focus on likely article content areas
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.article',
      '.post',
      '.entry',
      '[role="main"]',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content'
    ];

    // Try to find main content area
    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = root.querySelector(selector);
      if (element && element.innerHTML.length > 500) {
        mainContent = element;
        break;
      }
    }

    // If main content found, use only that part
    const finalHtml = mainContent ? mainContent.innerHTML : root.innerHTML;
    
    // Limit HTML size for API efficiency
    return finalHtml.length > 50000 ? finalHtml.substring(0, 50000) + '...' : finalHtml;
  }

  /**
   * Create structured prompt for Gemini extraction
   */
  private createExtractionPrompt(html: string, url: string): string {
    return `
You are an expert content extraction system. Your task is to extract article content from the provided HTML.

URL: ${url}

Instructions:
1. Extract the main article title, content, and summary
2. Identify the author if available
3. Find the publication date if present
4. Provide a confidence score (0.0-1.0) based on extraction quality
5. Return ONLY a valid JSON object with no additional text

Required JSON format:
{
  "title": "Main article title",
  "content": "Full article content in clean HTML format with paragraphs",
  "summary": "Brief summary of the article (2-3 sentences)",
  "author": "Author name if found, null if not",
  "publishedDate": "Publication date in ISO format if found, null if not",
  "confidence": 0.95
}

Guidelines:
- Focus on the main article content, ignore navigation, ads, sidebars
- Preserve paragraph structure in content but clean HTML (keep <p>, <h1-h6>, <strong>, <em>, <a>)
- Generate a concise summary if none exists
- Confidence should reflect content quality and completeness
- If title is unclear, use best guess from headings or meta tags
- Ensure content is substantial (at least 200 characters)

HTML to process:
${html}

Return JSON:`;
  }

  /**
   * Parse Gemini response and extract structured data
   */
  private parseGeminiResponse(response: string): GeminiExtractionResult {
    try {
      // Clean response to extract JSON
      let jsonStr = response.trim();
      
      // Remove any text before and after JSON
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON object found in response');
      }
      
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      
      // Parse JSON
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields
      if (!parsed.title || !parsed.content) {
        throw new Error('Missing required fields (title, content)');
      }

      // Ensure confidence is within valid range
      const confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5));

      const result: GeminiExtractionResult = {
        title: String(parsed.title).trim(),
        content: String(parsed.content).trim(),
        summary: String(parsed.summary || '').trim(),
        author: parsed.author ? String(parsed.author).trim() : undefined,
        publishedDate: parsed.publishedDate ? String(parsed.publishedDate).trim() : undefined,
        confidence,
      };

      return result;
    } catch (error) {
      console.error('[GeminiExtractor] Error parsing response:', error);
      console.error('[GeminiExtractor] Raw response:', response.substring(0, 500));
      
      // Try to extract basic information as fallback
      return this.createFallbackResult(response);
    }
  }

  /**
   * Create fallback result when JSON parsing fails
   */
  private createFallbackResult(response: string): GeminiExtractionResult {
    // Try to extract some content even if JSON parsing failed
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    
    const title = lines.find(line => 
      line.toLowerCase().includes('title') || 
      line.length > 10 && line.length < 200
    ) || 'Extracted Content';

    const content = lines
      .filter(line => line.length > 50)
      .join('\n\n')
      .substring(0, 5000);

    const summary = content.substring(0, 200) + '...';

    return {
      title: title.replace(/^[^:]*:?\s*/, '').trim(),
      content: content || 'Content extraction failed',
      summary: summary,
      confidence: 0.3, // Low confidence for fallback
    };
  }

  /**
   * Validate extracted content quality
   */
  private validateExtraction(result: GeminiExtractionResult): boolean {
    // Check minimum requirements
    if (!result.title || result.title.length < 5) {
      console.warn('[GeminiExtractor] Title too short or missing');
      return false;
    }

    if (!result.content || result.content.length < 200) {
      console.warn('[GeminiExtractor] Content too short or missing');
      return false;
    }

    if (result.confidence < 0.3) {
      console.warn('[GeminiExtractor] Confidence too low:', result.confidence);
      return false;
    }

    // Check for obvious extraction errors
    const suspiciousPatterns = [
      /javascript/i,
      /function\s*\(/,
      /<script/i,
      /cookie/i,
      /advertisement/i,
    ];

    const hasErrors = suspiciousPatterns.some(pattern => 
      pattern.test(result.title) || pattern.test(result.content)
    );

    if (hasErrors) {
      console.warn('[GeminiExtractor] Suspicious content detected');
      return false;
    }

    return true;
  }

  /**
   * Get extraction confidence level description
   */
  getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'very_low';
  }
}

// Export singleton instance
export const geminiExtractor = new GeminiExtractor();