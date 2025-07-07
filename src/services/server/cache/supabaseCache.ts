import { supabase, supabaseHelpers } from '@/lib/supabase';

// Supabase 기반 캐시 구현
// Redis와 동일한 인터페이스 제공

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const value = await supabaseHelpers.getCache(key);
    return value ? JSON.stringify(value) : null;
  } catch (error) {
    console.error('Supabase cache get error:', error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  expirationSeconds?: number
): Promise<void> {
  try {
    const parsedValue = JSON.parse(value);
    await supabaseHelpers.setCache(key, parsedValue, expirationSeconds);
  } catch (error) {
    // JSON이 아닌 경우 문자열로 저장
    await supabaseHelpers.setCache(key, value, expirationSeconds);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await supabase
      .from('cache')
      .delete()
      .eq('key', key);
  } catch (error) {
    console.error('Supabase cache delete error:', error);
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('cache')
      .select('key')
      .eq('key', key)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
}

// Pattern-based operations
export async function cacheGetByPattern(pattern: string): Promise<string[]> {
  try {
    // SQL LIKE 패턴으로 변환 (간단한 구현)
    const sqlPattern = pattern.replace(/\*/g, '%');
    
    const { data, error } = await supabase
      .from('cache')
      .select('key')
      .like('key', sqlPattern);
    
    if (error) throw error;
    
    return data?.map(item => item.key) || [];
  } catch (error) {
    console.error('Supabase cache pattern get error:', error);
    return [];
  }
}

export async function cacheDeleteByPattern(pattern: string): Promise<void> {
  try {
    const sqlPattern = pattern.replace(/\*/g, '%');
    
    await supabase
      .from('cache')
      .delete()
      .like('key', sqlPattern);
  } catch (error) {
    console.error('Supabase cache pattern delete error:', error);
  }
}

// 만료된 캐시 정리 (주기적으로 실행)
export async function cleanupExpiredCache(): Promise<void> {
  try {
    await supabase
      .from('cache')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (error) {
    console.error('Supabase cache cleanup error:', error);
  }
}