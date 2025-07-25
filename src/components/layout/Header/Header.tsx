'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PWAVoiceStatus } from '@/components/PWAVoiceStatus';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut, isAuthenticated, isSkipAuth, clearSkipAuth } = useAuth();

  // 헤더를 숨길 페이지들
  const hideHeaderPaths = ['/learn', '/driving'];
  if (hideHeaderPaths.includes(pathname)) {
    return null;
  }

  const handleSignOut = async () => {
    if (isSkipAuth) {
      clearSkipAuth();
      router.push('/');
    } else {
      await signOut();
      router.push('/');
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          Driving English
        </Link>

        <nav className={styles.nav}>
          {isAuthenticated && (
            <>
              <Link
                href="/dashboard"
                className={`${styles.navLink} ${pathname === '/dashboard' ? styles.active : ''}`}
              >
                대시보드
              </Link>
              <Link
                href="/settings"
                className={`${styles.navLink} ${pathname === '/settings' ? styles.active : ''}`}
              >
                설정
              </Link>
            </>
          )}
        </nav>

        <div className={styles.actions}>
          {/* PWA Voice Status - 네비게이션 바에 통합 */}
          <PWAVoiceStatus variant="navbar" className={styles.voiceStatus} />
          
          {loading ? (
            <span className={styles.loading}>로딩중...</span>
          ) : isAuthenticated ? (
            <div className={styles.userMenu}>
              <span className={styles.userEmail}>
                {isSkipAuth ? '게스트 모드' : user?.email}
              </span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                {isSkipAuth ? '종료' : '로그아웃'}
              </button>
            </div>
          ) : (
            <Link href="/" className={styles.signInButton}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};