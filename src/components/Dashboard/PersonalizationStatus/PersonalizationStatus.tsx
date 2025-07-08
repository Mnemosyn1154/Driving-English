'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './PersonalizationStatus.module.css';

export const PersonalizationStatus: React.FC = () => {
  const router = useRouter();
  const [status, setStatus] = useState({
    hasCategories: false,
    hasKeywords: false,
    hasRssFeeds: false,
    completionPercentage: 0
  });

  useEffect(() => {
    checkPersonalizationStatus();
  }, []);

  const checkPersonalizationStatus = async () => {
    // 로컬 스토리지에서 설정 확인
    const preferences = localStorage.getItem('newsPreferences');
    let hasCategories = false;
    let hasKeywords = false;

    if (preferences) {
      const prefs = JSON.parse(preferences);
      hasCategories = prefs.categories && prefs.categories.length > 0;
      hasKeywords = prefs.keywords && prefs.keywords.length > 0;
    }

    // RSS 피드 확인
    let hasRssFeeds = false;
    try {
      const deviceId = localStorage.getItem('deviceId');
      const params = new URLSearchParams();
      if (deviceId) params.append('deviceId', deviceId);
      
      const response = await fetch(`/api/rss?${params}`);
      if (response.ok) {
        const data = await response.json();
        hasRssFeeds = data.feeds && data.feeds.length > 0;
      }
    } catch (error) {
      console.error('Failed to check RSS feeds:', error);
    }

    // 완성도 계산
    const completionPercentage = 
      (hasCategories ? 40 : 0) + 
      (hasKeywords ? 30 : 0) + 
      (hasRssFeeds ? 30 : 0);

    setStatus({
      hasCategories,
      hasKeywords,
      hasRssFeeds,
      completionPercentage
    });
  };

  const getStatusMessage = () => {
    if (status.completionPercentage === 100) {
      return '개인화 설정이 완료되었습니다! 🎉';
    } else if (status.completionPercentage >= 70) {
      return '거의 다 왔어요! 조금만 더 설정해주세요 💪';
    } else if (status.completionPercentage >= 30) {
      return '좋은 시작이에요! 계속 설정해주세요 👍';
    } else {
      return '개인화 설정을 시작해보세요 🚀';
    }
  };

  const getProgressColor = () => {
    if (status.completionPercentage >= 70) return '#4CAF50';
    if (status.completionPercentage >= 30) return '#FF9800';
    return '#667eea';
  };

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>개인화 설정</h3>
      
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ 
              width: `${status.completionPercentage}%`,
              backgroundColor: getProgressColor()
            }}
          />
        </div>
        <span className={styles.percentage}>{status.completionPercentage}%</span>
      </div>

      <p className={styles.message}>{getStatusMessage()}</p>

      <div className={styles.checklist}>
        <div className={`${styles.checkItem} ${status.hasCategories ? styles.completed : ''}`}>
          <span className={styles.checkIcon}>
            {status.hasCategories ? '✓' : '○'}
          </span>
          <span className={styles.checkLabel}>카테고리 선택</span>
        </div>
        
        <div className={`${styles.checkItem} ${status.hasKeywords ? styles.completed : ''}`}>
          <span className={styles.checkIcon}>
            {status.hasKeywords ? '✓' : '○'}
          </span>
          <span className={styles.checkLabel}>키워드 설정</span>
        </div>
        
        <div className={`${styles.checkItem} ${status.hasRssFeeds ? styles.completed : ''}`}>
          <span className={styles.checkIcon}>
            {status.hasRssFeeds ? '✓' : '○'}
          </span>
          <span className={styles.checkLabel}>RSS 피드 추가</span>
        </div>
      </div>

      {status.completionPercentage < 100 && (
        <button 
          className={styles.setupButton}
          onClick={() => router.push('/settings?tab=categories')}
        >
          설정 완료하기 →
        </button>
      )}
    </div>
  );
};