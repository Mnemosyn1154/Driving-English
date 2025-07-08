'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase-client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabaseClient.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          console.error('Auth callback error:', error);
          router.push('/?error=auth_failed');
        } else {
          // 로그인 성공
          router.push('/');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        router.push('/?error=unexpected');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>인증 처리 중...</h2>
        <p>잠시만 기다려주세요.</p>
      </div>
    </div>
  );
}