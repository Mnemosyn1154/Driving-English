/**
 * Audio Cache Service
 * Caches generated audio files to reduce TTS API calls
 */

import { AudioCache as IAudioCache } from '@/types/translation';

export class AudioCache {
  private cache: Map<string, IAudioCache>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 500, ttlDays: number = 7) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlDays * 24 * 60 * 60 * 1000;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Get cached audio
   */
  async get(key: string): Promise<IAudioCache | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    // Update access count
    cached.accessCount++;
    
    return cached;
  }

  /**
   * Set cached audio
   */
  async set(
    key: string,
    data: {
      text: string;
      language: string;
      audioUrl: string;
      duration: number;
      format: string;
    }
  ): Promise<void> {
    // Check cache size
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    const cacheEntry: IAudioCache = {
      key,
      text: data.text,
      language: data.language,
      audioUrl: data.audioUrl,
      duration: data.duration,
      format: data.format,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttl),
      accessCount: 0,
    };

    this.cache.set(key, cacheEntry);
  }

  /**
   * Delete cached audio
   */
  async delete(key: string): Promise<void> {
    const cached = this.cache.get(key);
    if (cached) {
      // TODO: Delete actual audio file from storage
      this.cache.delete(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // TODO: Delete all audio files from storage
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    totalDuration: number;
    averageAccess: number;
    popularItems: Array<{ key: string; accessCount: number }>;
  } {
    const entries = Array.from(this.cache.values());
    const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    
    const popularItems = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => ({
        key: entry.key,
        accessCount: entry.accessCount,
      }));
    
    return {
      size: this.cache.size,
      totalDuration,
      averageAccess: entries.length > 0 ? totalAccess / entries.length : 0,
      popularItems,
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

    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Evict least used entry when cache is full
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null;
    let lowestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lowestAccess) {
        lowestAccess = entry.accessCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.delete(leastUsedKey);
    }
  }

  /**
   * Preload frequently used audio
   */
  async preload(items: Array<{
    key: string;
    text: string;
    language: string;
    audioUrl: string;
    duration: number;
  }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, {
        text: item.text,
        language: item.language,
        audioUrl: item.audioUrl,
        duration: item.duration,
        format: 'mp3',
      });
    }
  }

  /**
   * Get cache keys by pattern
   */
  getKeysByPattern(pattern: RegExp): string[] {
    const keys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  /**
   * Export cache metadata for persistence
   */
  exportMetadata(): Array<{
    key: string;
    text: string;
    language: string;
    audioUrl: string;
    duration: number;
    accessCount: number;
  }> {
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      text: entry.text,
      language: entry.language,
      audioUrl: entry.audioUrl,
      duration: entry.duration,
      accessCount: entry.accessCount,
    }));
  }
}