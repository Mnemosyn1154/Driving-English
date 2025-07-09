// 통합 캐시 인터페이스
// 환경 설정에 따라 Redis, Supabase 또는 메모리 캐시 사용

const USE_MEMORY_CACHE = process.env.USE_MEMORY_CACHE === 'true';
const USE_SUPABASE_CACHE = !USE_MEMORY_CACHE && (process.env.USE_SUPABASE_CACHE === 'true' || !process.env.REDIS_URL);

// Lazy loading of cache module
let cacheModule: any = null;
let loadingPromise: Promise<any> | null = null;

async function loadCacheModule() {
  if (cacheModule) return cacheModule;
  
  if (!loadingPromise) {
    loadingPromise = (async () => {
      if (USE_MEMORY_CACHE) {
        cacheModule = await import('./memoryCache');
        console.log('Using Memory cache (development mode)');
      } else if (USE_SUPABASE_CACHE) {
        cacheModule = await import('./supabaseCache');
        console.log('Using Supabase cache');
      } else {
        cacheModule = await import('./redis');
        console.log('Using Redis cache');
      }
      return cacheModule;
    })();
  }
  
  return loadingPromise;
}

// Export proxy functions that lazy-load the cache module
export const cacheGet = async (key: string) => {
  const module = await loadCacheModule();
  return module.cacheGet(key);
};

export const cacheSet = async (key: string, value: string, expirationSeconds?: number) => {
  const module = await loadCacheModule();
  return module.cacheSet(key, value, expirationSeconds);
};

export const cacheDelete = async (key: string) => {
  const module = await loadCacheModule();
  return module.cacheDelete(key);
};

export const cacheExists = async (key: string) => {
  const module = await loadCacheModule();
  return module.cacheExists(key);
};

export const cacheGetByPattern = async (pattern: string) => {
  const module = await loadCacheModule();
  return module.cacheGetByPattern(pattern);
};

export const cacheDeleteByPattern = async (pattern: string) => {
  const module = await loadCacheModule();
  return module.cacheDeleteByPattern(pattern);
};

// Redis 전용 함수들 (Supabase 사용 시 no-op)
export const getRedisClient = async () => {
  const module = await loadCacheModule();
  return module.getRedisClient ? module.getRedisClient() : null;
};

export const closeRedisClient = async () => {
  const module = await loadCacheModule();
  return module.closeRedisClient ? module.closeRedisClient() : undefined;
};

// 캐시 타입별 키 프리픽스
export const CACHE_PREFIX = {
  TRANSLATION: 'trans:',
  AUDIO: 'audio:',
  ARTICLE: 'article:',
  USER: 'user:',
  STATS: 'stats:'
} as const;

// 캐시 TTL 설정 (초 단위)
export const CACHE_TTL = {
  TRANSLATION: 7 * 24 * 60 * 60, // 7일
  AUDIO: 7 * 24 * 60 * 60,       // 7일
  ARTICLE: 3 * 24 * 60 * 60,     // 3일
  USER: 60 * 60,                 // 1시간
  STATS: 5 * 60                  // 5분
} as const;