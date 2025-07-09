'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Layout/Header/Header';
import { LearningStats } from '@/components/Dashboard/LearningStats/LearningStats';
import { MyRSSFeeds } from '@/components/Dashboard/MyRSSFeeds/MyRSSFeeds';
import { RecentArticles } from '@/components/Dashboard/RecentArticles/RecentArticles';
import { TodayRecommendations } from '@/components/Dashboard/TodayRecommendations/TodayRecommendations';
import { LearningGoals } from '@/components/Dashboard/LearningGoals/LearningGoals';
import { QuickSettings } from '@/components/Dashboard/QuickSettings/QuickSettings';
import { PersonalizationStatus } from '@/components/Dashboard/PersonalizationStatus/PersonalizationStatus';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // 로그인하지 않은 경우 홈으로 리다이렉트
    if (!loading && !user && localStorage.getItem('skipAuth') !== 'true') {
      router.push('/');
    }
    
    // 첫 사용자인지 확인
    if (!loading && (user || localStorage.getItem('skipAuth') === 'true')) {
      const onboardingCompleted = localStorage.getItem('onboardingCompleted');
      const hasCategories = localStorage.getItem('newsPreferences');
      
      if (!onboardingCompleted && !hasCategories) {
        setShowOnboarding(true);
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>대시보드를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className={styles.dashboard}>
        {/* 헤더 */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1>안녕하세요, {user?.email?.split('@')[0] || '학습자'}님! 👋</h1>
              <p className={styles.subtitle}>오늘도 영어 실력을 향상시켜보세요</p>
            </div>
            <button
              className={styles.startLearningButton}
              onClick={() => router.push('/learn')}
            >
              🎧 학습 시작하기
            </button>
          </div>
        </header>

      {/* 대시보드 그리드 */}
      <div className={styles.grid}>
        {/* 왼쪽 열 */}
        <div className={styles.leftColumn}>
          <PersonalizationStatus />
          <LearningStats />
          <RecentArticles />
        </div>

        {/* 중앙 열 */}
        <div className={styles.centerColumn}>
          <TodayRecommendations />
          <MyRSSFeeds />
        </div>

        {/* 오른쪽 열 */}
        <div className={styles.rightColumn}>
          <LearningGoals />
          <QuickSettings />
        </div>
        </div>
      </div>
      
      {/* 온보딩 모달 */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)}
      />
    </>
  );
}