// 간단한 인메모리 캐시 구현
// 개발 환경에서 빠른 응답을 위한 임시 캐시

class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private maxSize = 100; // 최대 캐시 항목 수

  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 만료 체크
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 제거 (간단한 FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 싱글톤 인스턴스
export const memoryCache = new MemoryCache();

// Redis 호환 인터페이스
export async function cacheGet(key: string): Promise<string | null> {
  const value = memoryCache.get(key);
  return value ? JSON.stringify(value) : null;
}

export async function cacheSet(
  key: string,
  value: string,
  expirationSeconds?: number
): Promise<void> {
  try {
    const parsedValue = JSON.parse(value);
    memoryCache.set(key, parsedValue, expirationSeconds);
  } catch {
    memoryCache.set(key, value, expirationSeconds);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  memoryCache.delete(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  return memoryCache.get(key) !== null;
}

// Pattern 기반 작업은 지원하지 않음 (간단한 구현)
export async function cacheGetByPattern(pattern: string): Promise<string[]> {
  console.warn('Memory cache does not support pattern-based operations');
  return [];
}

export async function cacheDeleteByPattern(pattern: string): Promise<void> {
  console.warn('Memory cache does not support pattern-based operations');
}