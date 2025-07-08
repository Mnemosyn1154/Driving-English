import { createClient } from '@supabase/supabase-js'

// 클라이언트 사이드 전용 Supabase 클라이언트
// NEXT_PUBLIC_ 접두사가 붙은 환경변수만 브라우저에서 접근 가능

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 환경변수 체크
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set properly');
}

// 클라이언트만 생성하도록 조건 추가
let supabaseClient: any = null;

if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // 보안 강화를 위한 PKCE flow
      storage: window.localStorage,
    }
  });
}

export { supabaseClient };

// Auth 헬퍼 함수들
export const authHelpers = {
  // 이메일/비밀번호 회원가입
  async signUpWithEmail(email: string, password: string, metadata?: any) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata, // 추가 사용자 정보
      }
    })
    return { data, error }
  },

  // 이메일/비밀번호 로그인
  async signInWithEmail(email: string, password: string) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // OAuth 로그인 (구글, 깃허브 등)
  async signInWithOAuth(provider: 'google' | 'github') {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    // window 객체는 함수 호출 시점에 접근
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3003/auth/callback';
    
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    })
    return { data, error }
  },

  // 로그아웃
  async signOut() {
    if (!supabaseClient) {
      return { error: new Error('Supabase client not initialized') };
    }
    const { error } = await supabaseClient.auth.signOut()
    return { error }
  },

  // 현재 사용자 가져오기
  async getCurrentUser() {
    if (!supabaseClient) {
      return null;
    }
    const { data: { user } } = await supabaseClient.auth.getUser()
    return user
  },

  // 세션 가져오기
  async getSession() {
    if (!supabaseClient) {
      return null;
    }
    const { data: { session } } = await supabaseClient.auth.getSession()
    return session
  },

  // 비밀번호 재설정 이메일 전송
  async resetPassword(email: string) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    // window 객체는 함수 호출 시점에 접근
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth/reset-password`
      : 'http://localhost:3003/auth/reset-password';
      
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    return { data, error }
  },

  // 사용자 정보 업데이트
  async updateUser(updates: any) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }
    const { data, error } = await supabaseClient.auth.updateUser(updates)
    return { data, error }
  },

  // Auth 상태 변경 리스너
  onAuthStateChange(callback: (event: any, session: any) => void) {
    if (!supabaseClient) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabaseClient.auth.onAuthStateChange(callback)
  }
}