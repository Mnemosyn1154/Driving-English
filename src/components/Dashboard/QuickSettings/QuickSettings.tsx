'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './QuickSettings.module.css';

export const QuickSettings: React.FC = () => {
  const router = useRouter();
  const [autoPlay, setAutoPlay] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleCategorySettings = () => {
    router.push('/settings?tab=categories');
  };

  const handleRSSSettings = () => {
    router.push('/settings?tab=rss');
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>⚙️ 빠른 설정</h2>

      <div className={styles.settingsList}>
        {/* 토글 설정 */}
        <div className={styles.toggleGroup}>
          <label className={styles.toggleItem}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>자동 재생</span>
              <span className={styles.toggleDescription}>기사 자동 재생</span>
            </div>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
          </label>

          <label className={styles.toggleItem}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>알림</span>
              <span className={styles.toggleDescription}>학습 리마인더</span>
            </div>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
            />
          </label>

          <label className={styles.toggleItem}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>다크 모드</span>
              <span className={styles.toggleDescription}>야간 모드</span>
            </div>
            <input
              type="checkbox"
              className={styles.toggle}
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
          </label>
        </div>

        {/* 바로가기 버튼 */}
        <div className={styles.shortcuts}>
          <button
            className={styles.shortcutButton}
            onClick={handleCategorySettings}
          >
            📚 카테고리 설정
          </button>
          <button
            className={styles.shortcutButton}
            onClick={handleRSSSettings}
          >
            📰 RSS 피드 관리
          </button>
        </div>
      </div>

      <button
        className={styles.allSettingsButton}
        onClick={() => router.push('/settings')}
      >
        모든 설정 보기
      </button>
    </div>
  );
};