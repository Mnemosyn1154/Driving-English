/**
 * News Parser Service
 * Extracts clean content and splits into sentences
 */

import { 
  Article, 
  Sentence, 
  DifficultyLevel,
  ArticleMetadata,
} from '@/types/news';
import { COMMON_ENGLISH_WORDS, DIFFICULTY_THRESHOLDS } from '@/config/news-sources';
import { v4 as uuidv4 } from 'uuid';

export class NewsParser {
  /**
   * Parse and clean article content
   */
  parseArticle(rawArticle: Partial<Article>): Article {
    if (!rawArticle.content || !rawArticle.title) {
      throw new Error('Article must have title and content');
    }

    // Clean content
    const cleanedContent = this.cleanContent(rawArticle.content);
    
    // Split into sentences
    const sentences = this.splitIntoSentences(cleanedContent);
    
    // Calculate word count
    const wordCount = this.calculateWordCount(cleanedContent);
    
    // Calculate difficulty
    const difficulty = this.calculateDifficulty(cleanedContent, sentences);
    
    // Estimate reading time (average 150 words per minute)
    const estimatedReadTime = Math.ceil((wordCount / 150) * 60);

    // Create article object
    const article: Article = {
      id: uuidv4(),
      title: this.cleanText(rawArticle.title),
      titleTranslation: undefined,
      summary: rawArticle.summary ? this.cleanText(rawArticle.summary) : this.generateSummary(cleanedContent),
      summaryTranslation: undefined,
      content: cleanedContent,
      sentences: sentences,
      metadata: rawArticle.metadata as ArticleMetadata,
      difficulty,
      wordCount,
      estimatedReadTime,
      isProcessed: true,
      processedAt: new Date(),
      createdAt: rawArticle.createdAt || new Date(),
      updatedAt: new Date(),
    };

    return article;
  }

  /**
   * Clean HTML and extract text content
   */
  private cleanContent(content: string): string {
    // Remove HTML tags
    let cleaned = content.replace(/<[^>]*>/g, ' ');
    
    // Remove special HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-zA-Z0-9]+;/g, ' ');
    
    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove common article suffixes
    cleaned = cleaned.replace(/\s*(Read more|Continue reading|Click here).*$/i, '');
    
    return cleaned;
  }

  /**
   * Clean individual text (for titles, summaries)
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\n+/g, ' ');
  }

  /**
   * Split content into sentences
   */
  private splitIntoSentences(content: string): Sentence[] {
    // Basic sentence splitting (can be improved with NLP library)
    const sentenceEndings = /([.!?]+)\s+/g;
    const rawSentences = content.split(sentenceEndings);
    
    const sentences: Sentence[] = [];
    let currentSentence = '';
    
    for (let i = 0; i < rawSentences.length; i++) {
      const part = rawSentences[i].trim();
      
      if (!part) continue;
      
      // Check if this is a sentence ending
      if (part.match(/^[.!?]+$/)) {
        currentSentence += part;
        if (currentSentence.length > 10) { // Minimum sentence length
          sentences.push({
            id: uuidv4(),
            text: currentSentence.trim(),
            order: sentences.length,
            difficulty: this.calculateSentenceDifficulty(currentSentence),
            keywords: this.extractKeywords(currentSentence),
          });
        }
        currentSentence = '';
      } else {
        currentSentence = part + ' ';
      }
    }
    
    // Add any remaining sentence
    if (currentSentence.trim().length > 10) {
      sentences.push({
        id: uuidv4(),
        text: currentSentence.trim(),
        order: sentences.length,
        difficulty: this.calculateSentenceDifficulty(currentSentence),
        keywords: this.extractKeywords(currentSentence),
      });
    }

    return sentences;
  }

  /**
   * Advanced sentence splitting with abbreviation handling
   */
  splitIntoSentencesAdvanced(content: string): Sentence[] {
    // Common abbreviations that don't end sentences
    const abbreviations = new Set([
      'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
      'Co', 'Corp', 'Inc', 'Ltd', 'LLC',
      'St', 'Ave', 'Rd', 'Blvd',
      'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
      'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
      'vs', 'etc', 'i.e', 'e.g', 'cf', 'al',
    ]);

    const sentences: Sentence[] = [];
    let currentSentence = '';
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentSentence += (currentSentence ? ' ' : '') + word;
      
      // Check if this word ends with sentence-ending punctuation
      if (word.match(/[.!?]$/)) {
        // Check if it's an abbreviation
        const wordWithoutPunctuation = word.slice(0, -1);
        const isAbbreviation = abbreviations.has(wordWithoutPunctuation);
        
        // Check if next word starts with capital letter (indicating new sentence)
        const nextWord = words[i + 1];
        const isEndOfSentence = !isAbbreviation || 
          (nextWord && /^[A-Z]/.test(nextWord) && !abbreviations.has(nextWord));
        
        if (isEndOfSentence) {
          // End current sentence
          if (currentSentence.trim().length > 10) {
            sentences.push({
              id: uuidv4(),
              text: currentSentence.trim(),
              order: sentences.length,
              difficulty: this.calculateSentenceDifficulty(currentSentence),
              keywords: this.extractKeywords(currentSentence),
            });
          }
          currentSentence = '';
        }
      }
    }
    
    // Add any remaining sentence
    if (currentSentence.trim().length > 10) {
      sentences.push({
        id: uuidv4(),
        text: currentSentence.trim(),
        order: sentences.length,
        difficulty: this.calculateSentenceDifficulty(currentSentence),
        keywords: this.extractKeywords(currentSentence),
      });
    }

    return sentences;
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate article difficulty
   */
  private calculateDifficulty(content: string, sentences: Sentence[]): DifficultyLevel {
    const wordCount = this.calculateWordCount(content);
    const words = content.toLowerCase().split(/\s+/);
    const avgSentenceLength = sentences.length > 0 
      ? sentences.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0) / sentences.length 
      : 0;
    
    // Calculate common word percentage
    const commonWordCount = words.filter(word => COMMON_ENGLISH_WORDS.has(word)).length;
    const commonWordPercentage = commonWordCount / words.length;
    
    // Check against thresholds
    if (
      wordCount <= DIFFICULTY_THRESHOLDS.beginner.maxWordCount &&
      avgSentenceLength <= DIFFICULTY_THRESHOLDS.beginner.maxSentenceLength &&
      commonWordPercentage >= DIFFICULTY_THRESHOLDS.beginner.commonWordPercentage
    ) {
      return 'beginner';
    }
    
    if (
      wordCount <= DIFFICULTY_THRESHOLDS.intermediate.maxWordCount &&
      avgSentenceLength <= DIFFICULTY_THRESHOLDS.intermediate.maxSentenceLength &&
      commonWordPercentage >= DIFFICULTY_THRESHOLDS.intermediate.commonWordPercentage
    ) {
      return 'intermediate';
    }
    
    return 'advanced';
  }

  /**
   * Calculate sentence difficulty
   */
  private calculateSentenceDifficulty(sentence: string): DifficultyLevel {
    const words = sentence.toLowerCase().split(/\s+/);
    const wordCount = words.length;
    
    // Calculate common word percentage
    const commonWordCount = words.filter(word => COMMON_ENGLISH_WORDS.has(word)).length;
    const commonWordPercentage = commonWordCount / words.length;
    
    if (
      wordCount <= DIFFICULTY_THRESHOLDS.beginner.maxSentenceLength &&
      commonWordPercentage >= DIFFICULTY_THRESHOLDS.beginner.commonWordPercentage
    ) {
      return 'beginner';
    }
    
    if (
      wordCount <= DIFFICULTY_THRESHOLDS.intermediate.maxSentenceLength &&
      commonWordPercentage >= DIFFICULTY_THRESHOLDS.intermediate.commonWordPercentage
    ) {
      return 'intermediate';
    }
    
    return 'advanced';
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const keywords: string[] = [];
    
    // Simple keyword extraction: non-common words that are longer than 4 characters
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z0-9]/g, '');
      if (
        cleanWord.length > 4 &&
        !COMMON_ENGLISH_WORDS.has(cleanWord) &&
        !keywords.includes(cleanWord)
      ) {
        keywords.push(cleanWord);
      }
    }
    
    return keywords.slice(0, 5); // Return top 5 keywords
  }

  /**
   * Generate summary from content
   */
  private generateSummary(content: string): string {
    const sentences = this.splitIntoSentences(content);
    
    if (sentences.length === 0) {
      return '';
    }
    
    // Simple summary: first 2 sentences
    const summaryLength = Math.min(2, sentences.length);
    const summarySentences = sentences.slice(0, summaryLength);
    
    return summarySentences.map(s => s.text).join(' ');
  }

  /**
   * Validate article has required fields
   */
  validateArticle(article: Partial<Article>): boolean {
    return !!(
      article.title &&
      article.content &&
      article.metadata &&
      article.metadata.source &&
      article.metadata.publishedAt
    );
  }
}