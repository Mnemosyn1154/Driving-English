/**
 * News Sources Configuration
 * Updated with validated RSS feeds - 2025-07-10
 */

import { NewsSource } from '@/types/news';

// Re-export validated sources as the main source
export { NEWS_SOURCES, VALIDATED_NEWS_SOURCES } from './validated-news-sources';
export { BROKEN_FEEDS } from './validated-news-sources';

// Legacy sources kept for reference
export const LEGACY_NEWS_SOURCES: NewsSource[] = [
  // BBC News
  {
    id: 'bbc-world',
    name: 'BBC World News',
    type: 'rss',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    language: 'en',
    enabled: true,
    updateInterval: 30, // 30 minutes
  },
  {
    id: 'bbc-business',
    name: 'BBC Business News',
    type: 'rss',
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'business',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },
  {
    id: 'bbc-technology',
    name: 'BBC Technology News',
    type: 'rss',
    url: 'http://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'technology',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },

  // CNN
  {
    id: 'cnn-world',
    name: 'CNN World News',
    type: 'rss',
    url: 'http://rss.cnn.com/rss/edition_world.rss',
    category: 'world',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },
  {
    id: 'cnn-business',
    name: 'CNN Business',
    type: 'rss',
    url: 'http://rss.cnn.com/rss/money_latest.rss',
    category: 'business',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },

  // Reuters
  {
    id: 'reuters-world',
    name: 'Reuters World News',
    type: 'rss',
    url: 'http://feeds.reuters.com/reuters/worldNews',
    category: 'world',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },
  {
    id: 'reuters-business',
    name: 'Reuters Business News',
    type: 'rss',
    url: 'http://feeds.reuters.com/reuters/businessNews',
    category: 'business',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },
  {
    id: 'reuters-technology',
    name: 'Reuters Technology News',
    type: 'rss',
    url: 'http://feeds.reuters.com/reuters/technologyNews',
    category: 'technology',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },

  // The Guardian
  {
    id: 'guardian-world',
    name: 'The Guardian World News',
    type: 'rss',
    url: 'https://www.theguardian.com/world/rss',
    category: 'world',
    language: 'en',
    enabled: true,
    updateInterval: 30,
  },

  // TechCrunch
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    category: 'technology',
    language: 'en',
    enabled: true,
    updateInterval: 60, // Less frequent updates
  },

  // The Verge
  {
    id: 'verge',
    name: 'The Verge',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    language: 'en',
    enabled: true,
    updateInterval: 60,
  },

  // Nature News (Science)
  {
    id: 'nature-news',
    name: 'Nature News',
    type: 'rss',
    url: 'http://feeds.nature.com/nature/rss/current',
    category: 'science',
    language: 'en',
    enabled: true,
    updateInterval: 120, // 2 hours
  },

  // NewsAPI.org (requires API key)
  {
    id: 'newsapi-top',
    name: 'NewsAPI Top Headlines',
    type: 'api',
    url: 'https://newsapi.org/v2/top-headlines',
    category: 'world',
    language: 'en',
    enabled: false, // Disabled by default (requires API key)
    updateInterval: 60,
  },
];

// Category display names
export const CATEGORY_NAMES: Record<string, string> = {
  world: 'World News',
  business: 'Business',
  technology: 'Technology',
  science: 'Science',
  health: 'Health',
  entertainment: 'Entertainment',
  sports: 'Sports',
};


// News API configuration
export const NEWS_API_CONFIG = {
  apiKey: process.env.NEWS_API_KEY || '',
  baseUrl: 'https://newsapi.org/v2',
  defaultCountry: 'us',
  defaultPageSize: 20,
  maxPageSize: 100,
};