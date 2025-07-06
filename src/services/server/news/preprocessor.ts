/**
 * News Preprocessor Service
 * Prepares articles for translation and audio generation
 */

import { 
  Article, 
  ProcessedArticle,
  DifficultyLevel,
  NewsFilter,
  NewsSortOptions,
  PaginatedResponse,
  PaginationOptions,
} from '@/types/news';
import { v4 as uuidv4 } from 'uuid';

export interface PreprocessorConfig {
  maxArticlesPerBatch: number;
  maxSentencesPerArticle: number;
  minSentencesPerArticle: number;
}

export class NewsPreprocessor {
  private config: PreprocessorConfig;

  constructor(config?: Partial<PreprocessorConfig>) {
    this.config = {
      maxArticlesPerBatch: config?.maxArticlesPerBatch || 10,
      maxSentencesPerArticle: config?.maxSentencesPerArticle || 50,
      minSentencesPerArticle: config?.minSentencesPerArticle || 3,
    };
  }

  /**
   * Preprocess a single article
   */
  preprocessArticle(article: Article): ProcessedArticle {
    // Filter sentences by length and quality
    const filteredSentences = this.filterSentences(article.sentences);
    
    // Limit number of sentences
    const limitedSentences = filteredSentences.slice(0, this.config.maxSentencesPerArticle);
    
    // Create processed article
    const processedArticle: ProcessedArticle = {
      ...article,
      sentences: limitedSentences,
      audioGenerated: false,
      processedAt: new Date(),
    };

    return processedArticle;
  }

  /**
   * Preprocess multiple articles in batch
   */
  preprocessBatch(articles: Article[]): ProcessedArticle[] {
    // Limit batch size
    const batch = articles.slice(0, this.config.maxArticlesPerBatch);
    
    return batch.map(article => this.preprocessArticle(article));
  }

  /**
   * Filter sentences based on quality criteria
   */
  private filterSentences(sentences: Sentence[]): Sentence[] {
    return sentences.filter(sentence => {
      // Remove very short sentences
      if (sentence.text.length < 20) return false;
      
      // Remove sentences that are likely captions or metadata
      if (sentence.text.match(/^(Photo:|Image:|Source:|Credit:|Copyright)/i)) return false;
      
      // Remove sentences with too many special characters
      const specialCharCount = (sentence.text.match(/[^a-zA-Z0-9\s.,!?'"()-]/g) || []).length;
      if (specialCharCount > sentence.text.length * 0.1) return false;
      
      // Remove sentences that are mostly numbers
      const numberCount = (sentence.text.match(/\d/g) || []).length;
      if (numberCount > sentence.text.length * 0.3) return false;
      
      return true;
    });
  }

  /**
   * Filter articles by criteria
   */
  filterArticles(articles: Article[], filter: NewsFilter): Article[] {
    return articles.filter(article => {
      // Filter by categories
      if (filter.categories && filter.categories.length > 0) {
        if (!filter.categories.includes(article.metadata.category)) {
          return false;
        }
      }

      // Filter by difficulty
      if (filter.difficulty && filter.difficulty.length > 0) {
        if (!filter.difficulty.includes(article.difficulty)) {
          return false;
        }
      }

      // Filter by sources
      if (filter.sources && filter.sources.length > 0) {
        if (!filter.sources.includes(article.metadata.source)) {
          return false;
        }
      }

      // Filter by date range
      if (filter.fromDate) {
        if (article.metadata.publishedAt < filter.fromDate) {
          return false;
        }
      }

      if (filter.toDate) {
        if (article.metadata.publishedAt > filter.toDate) {
          return false;
        }
      }

      // Filter by processing status
      if (filter.processed !== undefined) {
        if (article.isProcessed !== filter.processed) {
          return false;
        }
      }

      // Filter by audio availability
      if (filter.hasAudio !== undefined) {
        const hasAudio = (article as ProcessedArticle).audioGenerated === true;
        if (hasAudio !== filter.hasAudio) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort articles
   */
  sortArticles(articles: Article[], sortOptions: NewsSortOptions): Article[] {
    const sorted = [...articles];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortOptions.field) {
        case 'publishedAt':
          comparison = a.metadata.publishedAt.getTime() - b.metadata.publishedAt.getTime();
          break;
        case 'difficulty':
          const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
          comparison = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
          break;
        case 'wordCount':
          comparison = a.wordCount - b.wordCount;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortOptions.order === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }

  /**
   * Paginate articles
   */
  paginateArticles<T extends Article>(
    articles: T[],
    options: PaginationOptions
  ): PaginatedResponse<T> {
    const { page, limit } = options;
    const total = articles.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      data: articles.slice(start, end),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Group articles by difficulty
   */
  groupByDifficulty(articles: Article[]): Record<DifficultyLevel, Article[]> {
    return {
      beginner: articles.filter(a => a.difficulty === 'beginner'),
      intermediate: articles.filter(a => a.difficulty === 'intermediate'),
      advanced: articles.filter(a => a.difficulty === 'advanced'),
    };
  }

  /**
   * Group articles by category
   */
  groupByCategory(articles: Article[]): Record<string, Article[]> {
    const groups: Record<string, Article[]> = {};
    
    articles.forEach(article => {
      const category = article.metadata.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(article);
    });
    
    return groups;
  }

  /**
   * Check if article needs preprocessing
   */
  needsPreprocessing(article: Article): boolean {
    // Check if article has too many sentences
    if (article.sentences.length > this.config.maxSentencesPerArticle) {
      return true;
    }
    
    // Check if article has too few valid sentences
    const validSentences = this.filterSentences(article.sentences);
    if (validSentences.length < this.config.minSentencesPerArticle) {
      return false; // Not suitable for processing
    }
    
    return !article.isProcessed;
  }

  /**
   * Generate batch ID for tracking
   */
  generateBatchId(): string {
    return `batch_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Prepare articles for translation service
   */
  prepareForTranslation(articles: ProcessedArticle[]): Array<{
    articleId: string;
    texts: string[];
  }> {
    return articles.map(article => ({
      articleId: article.id,
      texts: [
        article.title,
        article.summary,
        ...article.sentences.map(s => s.text),
      ],
    }));
  }

  /**
   * Prepare articles for TTS service
   */
  prepareForTTS(articles: ProcessedArticle[]): Array<{
    articleId: string;
    sentenceId: string;
    text: string;
    language: 'en' | 'ko';
  }> {
    const ttsItems: Array<{
      articleId: string;
      sentenceId: string;
      text: string;
      language: 'en' | 'ko';
    }> = [];

    articles.forEach(article => {
      // English sentences
      article.sentences.forEach(sentence => {
        ttsItems.push({
          articleId: article.id,
          sentenceId: sentence.id,
          text: sentence.text,
          language: 'en',
        });
        
        // Korean translations (if available)
        if (sentence.translation) {
          ttsItems.push({
            articleId: article.id,
            sentenceId: sentence.id,
            text: sentence.translation,
            language: 'ko',
          });
        }
      });
    });

    return ttsItems;
  }

  /**
   * Calculate estimated processing time
   */
  estimateProcessingTime(articles: Article[]): {
    translationTime: number;
    ttsTime: number;
    totalTime: number;
  } {
    const totalSentences = articles.reduce((sum, article) => sum + article.sentences.length, 0);
    const totalWords = articles.reduce((sum, article) => sum + article.wordCount, 0);
    
    // Rough estimates (in seconds)
    const translationTime = totalSentences * 0.5; // 0.5 seconds per sentence
    const ttsTime = totalWords * 0.1; // 0.1 seconds per word
    
    return {
      translationTime,
      ttsTime,
      totalTime: translationTime + ttsTime,
    };
  }
}