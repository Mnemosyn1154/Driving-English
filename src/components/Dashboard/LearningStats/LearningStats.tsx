'use client';

import React, { useState, useEffect } from 'react';
import styles from './LearningStats.module.css';

interface Stats {
  todayMinutes: number;
  weekMinutes: number;
  streak: number;
  totalArticles: number;
  weeklyData: Array<{
    day: string;
    minutes: number;
  }>;
}

export const LearningStats: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    todayMinutes: 0,
    weekMinutes: 0,
    streak: 0,
    totalArticles: 0,
    weeklyData: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/stats/learning');
        if (!response.ok) {
          throw new Error('Failed to fetch learning stats');
        }
        
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching learning stats:', error);
        setError('학습 통계를 불러오는데 실패했습니다.');
        
        // 에러 시 기본값 설정
        setStats({
          todayMinutes: 0,
          weekMinutes: 0,
          streak: 0,
          totalArticles: 0,
          weeklyData: [
            { day: '월', minutes: 0 },
            { day: '화', minutes: 0 },
            { day: '수', minutes: 0 },
            { day: '목', minutes: 0 },
            { day: '금', minutes: 0 },
            { day: '토', minutes: 0 },
            { day: '일', minutes: 0 },
          ]
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const maxMinutes = Math.max(...stats.weeklyData.map(d => d.minutes));

  if (isLoading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>📊 학습 통계</h2>
        <div className={styles.loading}>통계를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>📊 학습 통계</h2>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

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
          {stats.weeklyData.map((data, index) => (
            <div key={index} className={styles.chartBar}>
              <div 
                className={styles.bar}
                style={{ 
                  height: maxMinutes > 0 ? `${(data.minutes / maxMinutes) * 100}%` : '0%',
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