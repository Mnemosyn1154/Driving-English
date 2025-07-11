/**
 * Unified Cache Service
 * Provides a consistent caching interface with type safety and advanced features
 */

import { 
  cacheGet, 
  cacheSet, 
  cacheDelete, 
  cacheExists, 
  cacheGetByPattern,
  cacheDeleteByPattern,
  CACHE_PREFIX,
  CACHE_TTL
} from './index';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  compress?: boolean;
  tags?: string[];
}

export interface CachedData<T = any> {
  data: T;
  metadata?: {
    createdAt: number;
    expiresAt?: number;
    tags?: string[];
    version?: string;
  };
}

export class CacheService {
  private static instance: CacheService;
  private readonly defaultTTL = 300; // 5 minutes
  private readonly version = '1.0';

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get a value from cache with type safety
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.prefix);
    
    try {
      const cached = await cacheGet(fullKey);
      if (!cached) return null;

      const parsed: CachedData<T> = JSON.parse(cached);
      
      // Check if data has metadata
      if (parsed.metadata) {
        // Version check
        if (parsed.metadata.version !== this.version) {
          await this.delete(key, options);
          return null;
        }

        // Expiry check (redundant but safe)
        if (parsed.metadata.expiresAt && Date.now() > parsed.metadata.expiresAt) {
          await this.delete(key, options);
          return null;
        }
      }

      return parsed.data;
    } catch (error) {
      console.error(`Cache get error for key ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with metadata
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl || this.defaultTTL;

    try {
      const cachedData: CachedData<T> = {
        data: value,
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + (ttl * 1000),
          tags: options?.tags,
          version: this.version
        }
      };

      const serialized = JSON.stringify(cachedData);
      await cacheSet(fullKey, serialized, ttl);

      // If tags are provided, maintain a tag index
      if (options?.tags && options.tags.length > 0) {
        await this.addToTagIndex(fullKey, options.tags);
      }

      return true;
    } catch (error) {
      console.error(`Cache set error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      await cacheDelete(fullKey);
      await this.removeFromTagIndex(fullKey);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    return cacheExists(fullKey);
  }

  /**
   * Get or set a value (memoization pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();
    
    // Cache it
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Delete all keys matching a pattern
   */
  async deleteByPattern(pattern: string, prefix?: string): Promise<number> {
    const fullPattern = prefix ? `${prefix}${pattern}` : pattern;
    
    try {
      const keys = await cacheGetByPattern(fullPattern);
      if (keys.length > 0) {
        await cacheDeleteByPattern(fullPattern);
      }
      return keys.length;
    } catch (error) {
      console.error(`Cache delete by pattern error:`, error);
      return 0;
    }
  }

  /**
   * Delete all keys with a specific tag
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      const tagKey = this.buildTagKey(tag);
      const keysJson = await cacheGet(tagKey);
      
      if (!keysJson) return 0;

      const keys: string[] = JSON.parse(keysJson);
      
      for (const key of keys) {
        await cacheDelete(key);
      }
      
      await cacheDelete(tagKey);
      return keys.length;
    } catch (error) {
      console.error(`Cache delete by tag error:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<void> {
    // Clear each prefix
    for (const prefix of Object.values(CACHE_PREFIX)) {
      await this.deleteByPattern('*', prefix);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    patterns: { [key: string]: number };
    totalKeys: number;
  }> {
    const stats: { patterns: { [key: string]: number }; totalKeys: number } = {
      patterns: {},
      totalKeys: 0
    };

    try {
      for (const [name, prefix] of Object.entries(CACHE_PREFIX)) {
        const keys = await cacheGetByPattern(`${prefix}*`);
        stats.patterns[name] = keys.length;
        stats.totalKeys += keys.length;
      }
    } catch (error) {
      console.error('Error getting cache stats:', error);
    }

    return stats;
  }

  /**
   * Build a full cache key
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}${key}` : key;
  }

  /**
   * Build a tag index key
   */
  private buildTagKey(tag: string): string {
    return `${CACHE_PREFIX.STATS}tag:${tag}`;
  }

  /**
   * Add key to tag index
   */
  private async addToTagIndex(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      
      try {
        const existingJson = await cacheGet(tagKey);
        const existing: string[] = existingJson ? JSON.parse(existingJson) : [];
        
        if (!existing.includes(key)) {
          existing.push(key);
          await cacheSet(tagKey, JSON.stringify(existing), CACHE_TTL.STATS);
        }
      } catch (error) {
        console.error(`Error adding to tag index:`, error);
      }
    }
  }

  /**
   * Remove key from all tag indexes
   */
  private async removeFromTagIndex(key: string): Promise<void> {
    // Get all tag keys
    const tagKeys = await cacheGetByPattern(`${CACHE_PREFIX.STATS}tag:*`);
    
    for (const tagKey of tagKeys) {
      try {
        const keysJson = await cacheGet(tagKey);
        if (!keysJson) continue;

        const keys: string[] = JSON.parse(keysJson);
        const filtered = keys.filter(k => k !== key);
        
        if (filtered.length !== keys.length) {
          if (filtered.length === 0) {
            await cacheDelete(tagKey);
          } else {
            await cacheSet(tagKey, JSON.stringify(filtered), CACHE_TTL.STATS);
          }
        }
      } catch (error) {
        console.error(`Error removing from tag index:`, error);
      }
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Domain-specific cache helpers
export class DomainCacheHelpers {
  /**
   * Cache a translation
   */
  static async cacheTranslation(
    text: string,
    translation: string,
    language: string = 'ko'
  ): Promise<void> {
    const key = `${text}:${language}`;
    await cacheService.set(key, translation, {
      prefix: CACHE_PREFIX.TRANSLATION,
      ttl: CACHE_TTL.TRANSLATION,
      tags: ['translation', language]
    });
  }

  /**
   * Get cached translation
   */
  static async getCachedTranslation(
    text: string,
    language: string = 'ko'
  ): Promise<string | null> {
    const key = `${text}:${language}`;
    return cacheService.get<string>(key, {
      prefix: CACHE_PREFIX.TRANSLATION
    });
  }

  /**
   * Cache audio URL
   */
  static async cacheAudioUrl(
    text: string,
    url: string,
    language: string = 'en'
  ): Promise<void> {
    const key = `${text}:${language}`;
    await cacheService.set(key, url, {
      prefix: CACHE_PREFIX.AUDIO,
      ttl: CACHE_TTL.AUDIO,
      tags: ['audio', language]
    });
  }

  /**
   * Get cached audio URL
   */
  static async getCachedAudioUrl(
    text: string,
    language: string = 'en'
  ): Promise<string | null> {
    return cacheService.get<string>(`${text}:${language}`, {
      prefix: CACHE_PREFIX.AUDIO
    });
  }

  /**
   * Cache article data
   */
  static async cacheArticle(
    articleId: string,
    data: any,
    tags?: string[]
  ): Promise<void> {
    await cacheService.set(articleId, data, {
      prefix: CACHE_PREFIX.ARTICLE,
      ttl: CACHE_TTL.ARTICLE,
      tags: ['article', ...(tags || [])]
    });
  }

  /**
   * Get cached article
   */
  static async getCachedArticle(articleId: string): Promise<any | null> {
    return cacheService.get(articleId, {
      prefix: CACHE_PREFIX.ARTICLE
    });
  }

  /**
   * Clear all translations
   */
  static async clearTranslations(): Promise<void> {
    await cacheService.deleteByPattern('*', CACHE_PREFIX.TRANSLATION);
  }

  /**
   * Clear all audio URLs
   */
  static async clearAudioUrls(): Promise<void> {
    await cacheService.deleteByPattern('*', CACHE_PREFIX.AUDIO);
  }
}