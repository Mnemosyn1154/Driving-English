import { TranslationCache } from '@/services/server/translation/cache';

describe('TranslationCache', () => {
  let cache: TranslationCache;

  beforeEach(() => {
    cache = new TranslationCache();
  });

  describe('basic operations', () => {
    it('should store and retrieve translations', () => {
      const key = 'Hello world';
      const value = '안녕하세요 세계';
      
      cache.set(key, value);
      expect(cache.get(key)).toBe(value);
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should clear cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('LRU behavior', () => {
    it('should respect max size limit', () => {
      const smallCache = new TranslationCache(3);
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      
      expect(smallCache.size()).toBe(3);
      
      // Adding a 4th item should evict the oldest (key1)
      smallCache.set('key4', 'value4');
      
      expect(smallCache.size()).toBe(3);
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(smallCache.get('key4')).toBe('value4');
    });
  });
});