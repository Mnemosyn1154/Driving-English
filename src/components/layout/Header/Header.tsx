'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  // 헤더를 숨길 페이지들
  const hideHeaderPaths = ['/learn', '/driving'];
  if (hideHeaderPaths.includes(pathname)) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          Driving English
        </Link>

        <nav className={styles.nav}>
          {(user || localStorage.getItem('skipAuth') === 'true') && (
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
          {loading ? (
            <span className={styles.loading}>로딩중...</span>
          ) : user ? (
            <div className={styles.userMenu}>
              <span className={styles.userEmail}>{user.email}</span>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                로그아웃
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