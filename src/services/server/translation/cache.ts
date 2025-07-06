/**
 * Simple in-memory cache for translations
 */
export class TranslationCache {
  private cache: Map<string, string>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached translation
   */
  get(key: string): string | null {
    return this.cache.get(key) || null;
  }

  /**
   * Set cached translation
   */
  set(key: string, value: string): void {
    // Simple LRU: remove oldest when at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}