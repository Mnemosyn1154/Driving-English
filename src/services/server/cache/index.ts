// 통합 캐시 인터페이스
// 환경 설정에 따라 Redis 또는 Supabase 캐시 사용

const USE_SUPABASE_CACHE = !process.env.REDIS_URL || process.env.USE_SUPABASE_CACHE === 'true';

// Dynamic import based on configuration
let cacheModule: any;

if (USE_SUPABASE_CACHE) {
  cacheModule = await import('./supabaseCache');
  console.log('Using Supabase cache');
} else {
  cacheModule = await import('./redis');
  console.log('Using Redis cache');
}

export const {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheExists,
  cacheGetByPattern,
  cacheDeleteByPattern
} = cacheModule;

// Redis 전용 함수들 (Supabase 사용 시 no-op)
export const getRedisClient = cacheModule.getRedisClient || (() => Promise.resolve(null));
export const closeRedisClient = cacheModule.closeRedisClient || (() => Promise.resolve());

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