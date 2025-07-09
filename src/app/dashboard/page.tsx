'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { withAuth } from '@/components/Auth/withAuth';
import { Header } from '@/components/layout/Header/Header';
import { LearningStats } from '@/components/Dashboard/LearningStats/LearningStats';
import { MyRSSFeeds } from '@/components/Dashboard/MyRSSFeeds/MyRSSFeeds';
import { RecentArticles } from '@/components/Dashboard/RecentArticles/RecentArticles';
import { TodayRecommendations } from '@/components/Dashboard/TodayRecommendations/TodayRecommendations';
import { LearningGoals } from '@/components/Dashboard/LearningGoals/LearningGoals';
import { QuickSettings } from '@/components/Dashboard/QuickSettings/QuickSettings';
import { PersonalizationStatus } from '@/components/Dashboard/PersonalizationStatus/PersonalizationStatus';
import { OnboardingModal } from '@/components/Onboarding/OnboardingModal';
import styles from './dashboard.module.css';

function DashboardPage() {
  const { user, isSkipAuth } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // 첫 사용자인지 확인
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    const hasCategories = localStorage.getItem('newsPreferences');
    
    if (!onboardingCompleted && !hasCategories) {
      setShowOnboarding(true);
    }
  }, []);

  // No need for loading state - withAuth handles it
  // No need for auth check - withAuth handles it

  return (
    <>
      <Header />
      <div className={styles.dashboard}>
        {/* 헤더 */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1>안녕하세요, {user?.email?.split('@')[0] || (isSkipAuth ? '게스트' : '학습자')}님! 👋</h1>
              <p className={styles.subtitle}>오늘도 영어 실력을 향상시켜보세요</p>
            </div>
            <button
              className={styles.startLearningButton}
              onClick={() => window.location.href = '/learn'}
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

// Export with authentication
export default withAuth(DashboardPage, { allowSkipAuth: true });