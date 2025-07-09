'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header/Header';
import { NewsSelector } from '@/components/NewsSelector/NewsSelector';
import styles from './settings.module.css';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    // URL 파라미터에서 탭 정보 가져오기
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    // 로그인하지 않은 경우 홈으로 리다이렉트
    if (!loading && !user && localStorage.getItem('skipAuth') !== 'true') {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>설정을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <h2>설정</h2>
          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeTab === 'general' ? styles.active : ''}`}
              onClick={() => setActiveTab('general')}
            >
              일반 설정
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'categories' ? styles.active : ''}`}
              onClick={() => setActiveTab('categories')}
            >
              카테고리 및 키워드
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'rss' ? styles.active : ''}`}
              onClick={() => setActiveTab('rss')}
            >
              RSS 피드
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'account' ? styles.active : ''}`}
              onClick={() => setActiveTab('account')}
            >
              계정
            </button>
          </nav>
        </div>

        <div className={styles.content}>
          {activeTab === 'general' && (
            <div className={styles.section}>
              <h3>일반 설정</h3>
              <div className={styles.settingGroup}>
                <label className={styles.setting}>
                  <div>
                    <h4>자동 재생</h4>
                    <p>기사를 자동으로 재생합니다</p>
                  </div>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className={styles.setting}>
                  <div>
                    <h4>알림</h4>
                    <p>학습 리마인더를 받습니다</p>
                  </div>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className={styles.setting}>
                  <div>
                    <h4>다크 모드</h4>
                    <p>어두운 테마를 사용합니다</p>
                  </div>
                  <input type="checkbox" />
                </label>
              </div>
            </div>
          )}

          {(activeTab === 'categories' || activeTab === 'rss') && (
            <NewsSelector onClose={() => router.push('/dashboard')} />
          )}

          {activeTab === 'account' && (
            <div className={styles.section}>
              <h3>계정 정보</h3>
              <div className={styles.accountInfo}>
                <p><strong>이메일:</strong> {user?.email || '로그인하지 않음'}</p>
                <p><strong>가입일:</strong> {user ? new Date().toLocaleDateString('ko-KR') : '-'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}