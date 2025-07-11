/**
 * News Providers Module
 * Exports all provider-related types and classes
 */

export * from './INewsProvider';
export * from './RssProvider';
export * from './NewsApiProvider';
export * from './ProviderFactory';

// Re-export commonly used types
export type { 
  NewsArticle,
  ProviderConfig,
  FetchResult,
  INewsProvider,
} from './INewsProvider';

export type { ProviderType } from './ProviderFactory';