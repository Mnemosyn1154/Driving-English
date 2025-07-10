/**
 * News System Type Definitions
 */

// News source types
export type NewsSourceType = 'rss' | 'api' | 'manual';
export type NewsCategory = 'world' | 'business' | 'technology' | 'science' | 'health' | 'entertainment' | 'sports';
export type Language = 'en' | 'ko';

// News source configuration
export interface NewsSource {
  id: string;
  name: string;
  type: NewsSourceType;
  url: string;
  category: NewsCategory;
  language: Language;
  enabled: boolean;
  updateInterval: number; // in minutes
  lastFetch?: Date;
}

// Article metadata
export interface ArticleMetadata {
  source: string;
  author?: string;
  publishedAt: Date;
  category: NewsCategory;
  tags?: string[];
  imageUrl?: string;
  originalUrl: string;
}

// Sentence structure for line-by-line reading
export interface Sentence {
  id: string;
  text: string;
  order: number;
  translation?: string;
  audioUrl?: {
    english?: string;
    korean?: string;
  };
  keywords?: string[];
}

// Main article structure
export interface Article {
  id: string;
  title: string;
  titleTranslation?: string;
  summary: string;
  summaryTranslation?: string;
  content: string;
  sentences: Sentence[];
  metadata: ArticleMetadata;
  wordCount: number;
  estimatedReadTime: number; // in seconds
  isProcessed: boolean;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Preprocessed article ready for audio
export interface ProcessedArticle extends Article {
  audioGenerated: boolean;
  audioGeneratedAt?: Date;
  totalAudioDuration?: number; // in seconds
  storageUrls?: {
    englishAudio?: string;
    koreanAudio?: string;
    combinedAudio?: string;
  };
}

// News fetch result
export interface NewsFetchResult {
  source: string;
  articlesCount: number;
  articles: Partial<Article>[];
  fetchedAt: Date;
  errors?: string[];
}

// News API response types
export interface NewsApiArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string;
}

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

// RSS feed types
export interface RssFeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  categories?: string[];
  isoDate?: string;
  enclosure?: {
    url: string;
    type?: string;
    length?: string;
  };
}

export interface RssFeed {
  title?: string;
  description?: string;
  link?: string;
  language?: string;
  items: RssFeedItem[];
}

// Cache types
export interface CachedArticle {
  article: Article;
  cachedAt: Date;
  expiresAt: Date;
}

// Filter and sort options
export interface NewsFilter {
  categories?: NewsCategory[];
  sources?: string[];
  fromDate?: Date;
  toDate?: Date;
  processed?: boolean;
  hasAudio?: boolean;
}

export interface NewsSortOptions {
  field: 'publishedAt' | 'wordCount' | 'title';
  order: 'asc' | 'desc';
}

// Pagination
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface NewsError {
  code: string;
  message: string;
  source?: string;
  details?: any;
}