import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Some features may not work.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // Server-side에서는 세션 유지 불필요
  },
  db: {
    schema: 'public'
  }
})

// Supabase Storage 버킷 이름
export const STORAGE_BUCKET = {
  AUDIO: 'audio-files',
  ARTICLES: 'article-images'
} as const

// Supabase 헬퍼 함수들
export const supabaseHelpers = {
  // 오디오 파일 업로드
  async uploadAudio(fileName: string, audioBuffer: Buffer): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET.AUDIO)
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })
    
    if (error) {
      console.error('Audio upload error:', error)
      return null
    }
    
    // Public URL 반환
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET.AUDIO)
      .getPublicUrl(fileName)
    
    return publicUrl
  },

  // 오디오 파일 URL 가져오기
  getAudioUrl(fileName: string): string {
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET.AUDIO)
      .getPublicUrl(fileName)
    
    return publicUrl
  },

  // 캐시 테이블을 사용한 간단한 캐싱
  async getCache(key: string): Promise<any> {
    const { data, error } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .single()
    
    if (error || !data) return null
    
    // 만료 시간 체크
    if (new Date(data.expires_at) < new Date()) {
      await supabase.from('cache').delete().eq('key', key)
      return null
    }
    
    return JSON.parse(data.value)
  },

  async setCache(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    
    await supabase
      .from('cache')
      .upsert({
        key,
        value: JSON.stringify(value),
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
  },

  // 실시간 구독 (뉴스 업데이트 알림 등)
  subscribeToArticles(callback: (payload: any) => void) {
    return supabase
      .channel('articles-channel')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'Article' }, 
        callback
      )
      .subscribe()
  }
}