'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export interface WithAuthOptions {
  allowSkipAuth?: boolean;
  redirectTo?: string;
  showLoader?: boolean;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const {
    allowSkipAuth = true,
    redirectTo = '/',
    showLoader = true
  } = options;

  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, loading, isSkipAuth } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // Still loading, wait
      if (loading) return;

      // Not authenticated and skipAuth not allowed
      if (!isAuthenticated || (isSkipAuth && !allowSkipAuth)) {
        router.push(redirectTo);
      }
    }, [isAuthenticated, loading, isSkipAuth, router]);

    // Show loading state
    if (loading && showLoader) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontSize: '18px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #e0e0e0',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <p>로딩 중...</p>
          </div>
        </div>
      );
    }

    // Not authenticated, don't render
    if (!isAuthenticated || (isSkipAuth && !allowSkipAuth)) {
      return null;
    }

    // Authenticated, render component
    return <Component {...props} />;
  };
}