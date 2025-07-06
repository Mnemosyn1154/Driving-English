/**
 * Translation Cache Service
 * Caches translations to reduce API calls and improve performance
 */

import { TranslationCache as ITranslationCache } from '@/types/translation';

export class TranslationCache {
  private cache: Map<string, ITranslationCache>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlHours: number = 24) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlHours * 60 * 60 * 1000;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Get cached translation
   */
  async get(key: string): Promise<ITranslationCache | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    cached.hitCount++;
    
    return cached;
  }

  /**
   * Set cached translation
   */
  async set(
    key: string, 
    data: {
      originalText: string;
      translatedText: string;
      confidence?: number;
    }
  ): Promise<void> {
    // Check cache size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const cacheEntry: ITranslationCache = {
      key,
      originalText: data.originalText,
      translatedText: data.translatedText,
      language: 'ko', // Default target language
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttl),
      hitCount: 0,
    };

    this.cache.set(key, cacheEntry);
  }

  /**
   * Delete cached translation
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    averageHits: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    
    return {
      size: this.cache.size,
      hitRate: entries.length > 0 ? entries.filter(e => e.hitCount > 0).length / entries.length : 0,
      averageHits: entries.length > 0 ? totalHits / entries.length : 0,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict oldest entry when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Export cache for persistence
   */
  export(): ITranslationCache[] {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache from persistence
   */
  import(data: ITranslationCache[]): void {
    this.cache.clear();
    const now = new Date();

    for (const entry of data) {
      // Only import non-expired entries
      if (new Date(entry.expiresAt) > now) {
        this.cache.set(entry.key, {
          ...entry,
          createdAt: new Date(entry.createdAt),
          expiresAt: new Date(entry.expiresAt),
        });
      }
    }
  }
}