'use client';

import React, { useState, useEffect } from 'react';
import styles from './LearningStats.module.css';

interface Stats {
  todayMinutes: number;
  weekMinutes: number;
  streak: number;
  totalArticles: number;
}

export const LearningStats: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    todayMinutes: 0,
    weekMinutes: 0,
    streak: 0,
    totalArticles: 0
  });

  useEffect(() => {
    // TODO: API에서 실제 통계 가져오기
    // 임시 데이터
    setStats({
      todayMinutes: 25,
      weekMinutes: 180,
      streak: 7,
      totalArticles: 42
    });
  }, []);

  const weeklyData = [
    { day: '월', minutes: 30 },
    { day: '화', minutes: 45 },
    { day: '수', minutes: 20 },
    { day: '목', minutes: 35 },
    { day: '금', minutes: 25 },
    { day: '토', minutes: 15 },
    { day: '일', minutes: 25 },
  ];

  const maxMinutes = Math.max(...weeklyData.map(d => d.minutes));

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📊 학습 통계</h2>
      
      {/* 주요 지표 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.todayMinutes}분</span>
          <span className={styles.statLabel}>오늘 학습</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.streak}일</span>
          <span className={styles.statLabel}>연속 학습</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalArticles}개</span>
          <span className={styles.statLabel}>읽은 기사</span>
        </div>
      </div>

      {/* 주간 그래프 */}
      <div className={styles.weeklyChart}>
        <h3>이번 주 학습 시간</h3>
        <div className={styles.chart}>
          {weeklyData.map((data, index) => (
            <div key={index} className={styles.chartBar}>
              <div 
                className={styles.bar}
                style={{ 
                  height: `${(data.minutes / maxMinutes) * 100}%`,
                  background: index === 6 ? '#667eea' : '#e0e0e0'
                }}
              >
                <span className={styles.barValue}>{data.minutes}</span>
              </div>
              <span className={styles.barLabel}>{data.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};