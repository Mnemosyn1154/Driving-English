/**
 * Text Processing Utilities
 * Handles sentence splitting and text analysis
 */

export interface SentenceData {
  text: string;
  order: number;
  wordCount: number;
}

export class TextProcessor {
  /**
   * Split text into sentences
   */
  static splitIntoSentences(text: string): SentenceData[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Clean the text first
    const cleanedText = this.cleanText(text);
    
    // Enhanced sentence splitting regex
    // Matches sentence endings followed by whitespace and capital letter or end of string
    const sentenceRegex = /([.!?]+)[\s]*(?=[A-Z]|$)/g;
    
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(cleanedText)) !== null) {
      const sentenceEnd = match.index + match[0].length;
      const sentence = cleanedText.slice(lastIndex, sentenceEnd).trim();
      
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      
      lastIndex = sentenceEnd;
    }

    // Add remaining text if any
    if (lastIndex < cleanedText.length) {
      const remaining = cleanedText.slice(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push(remaining);
      }
    }

    // Filter and process sentences
    const validSentences = sentences
      .map(sentence => sentence.trim())
      .filter(sentence => this.isValidSentence(sentence))
      .map((sentence, index) => ({
        text: sentence,
        order: index + 1,
        wordCount: this.countWords(sentence),
      }));

    return validSentences;
  }

  /**
   * Clean text by removing unwanted elements
   */
  private static cleanText(text: string): string {
    return text
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remove email addresses
      .replace(/\S+@\S+\.\S+/g, '')
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Remove weird characters but keep punctuation
      .replace(/[^\w\s.,!?;:()'""-]/g, ' ')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if a sentence is valid for processing
   */
  private static isValidSentence(sentence: string): boolean {
    // Minimum length
    if (sentence.length < 15) return false;

    // Maximum length (probably not a sentence if too long)
    if (sentence.length > 500) return false;

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(sentence)) return false;

    // Skip sentences that are likely metadata
    const metadataPatterns = [
      /^(Photo|Image|Source|Credit|Copyright|Via|Read more|Continue reading)/i,
      /^(Click here|Subscribe|Follow|Share)/i,
      /^(Published|Updated|Posted|By:)/i,
      /^\d+\s*(minutes?|hours?|days?)\s+ago/i,
      /^(Tags?|Categories?|Filed under)/i,
    ];

    for (const pattern of metadataPatterns) {
      if (pattern.test(sentence)) return false;
    }

    // Skip sentences with too many numbers (likely data/stats)
    const numberCount = (sentence.match(/\d/g) || []).length;
    if (numberCount > sentence.length * 0.3) return false;

    // Skip sentences with too many special characters
    const specialCount = (sentence.match(/[^a-zA-Z0-9\s.,!?;:()'""-]/g) || []).length;
    if (specialCount > sentence.length * 0.1) return false;

    return true;
  }

  /**
   * Count words in text
   */
  static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Create summary from text
   */
  static createSummary(text: string, maxLength: number = 300): string {
    const sentences = this.splitIntoSentences(text);
    
    if (sentences.length === 0) {
      return text.substring(0, maxLength);
    }

    let summary = '';
    for (const sentence of sentences) {
      if (summary.length + sentence.text.length <= maxLength) {
        summary += (summary ? ' ' : '') + sentence.text;
      } else {
        break;
      }
    }

    return summary || text.substring(0, maxLength);
  }

  /**
   * Extract key phrases from text
   */
  static extractKeyPhrases(text: string, limit: number = 10): string[] {
    // Simple implementation - can be enhanced with NLP libraries
    const words = text.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Filter out common words
    const commonWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come',
      'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take',
      'than', 'them', 'well', 'were', 'what', 'your'
    ]);

    return Object.entries(wordFreq)
      .filter(([word]) => !commonWords.has(word))
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([word]) => word);
  }

  /**
   * Calculate reading time based on word count
   */
  static calculateReadingTime(wordCount: number, wordsPerMinute: number = 200): number {
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Clean HTML content specifically for news articles
   */
  static cleanNewsContent(html: string): string {
    return html
      // Remove script and style tags completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove specific news-related tags
      .replace(/<(figure|figcaption|aside|nav|header|footer)[^>]*>.*?<\/\1>/gi, '')
      // Remove images and media
      .replace(/<img[^>]*>/gi, '')
      .replace(/<video[^>]*>.*?<\/video>/gi, '')
      .replace(/<audio[^>]*>.*?<\/audio>/gi, '')
      // Remove links but keep text
      .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
      // Replace paragraphs and breaks with spaces
      .replace(/<\/(p|div|br|h[1-6])>/gi, ' ')
      // Remove all remaining HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-zA-Z0-9]+;/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}