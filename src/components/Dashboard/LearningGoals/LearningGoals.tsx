'use client';

import React, { useState, useEffect } from 'react';
import styles from './LearningGoals.module.css';

interface Goal {
  type: 'daily' | 'weekly';
  label: string;
  current: number;
  target: number;
  unit: string;
}

export const LearningGoals: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // TODO: API에서 실제 목표 가져오기
    // 임시 데이터
    setGoals([
      {
        type: 'daily',
        label: '일일 학습 시간',
        current: 25,
        target: 30,
        unit: '분'
      },
      {
        type: 'daily',
        label: '읽을 기사 수',
        current: 2,
        target: 3,
        unit: '개'
      },
      {
        type: 'weekly',
        label: '주간 학습 시간',
        current: 180,
        target: 200,
        unit: '분'
      }
    ]);
  }, []);

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#4caf50';
    if (percentage >= 70) return '#ff9800';
    return '#f44336';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🏆 학습 목표</h2>
        <button
          className={styles.editButton}
          onClick={() => setEditing(!editing)}
        >
          {editing ? '완료' : '수정'}
        </button>
      </div>

      <div className={styles.goalsList}>
        {goals.map((goal, index) => {
          const percentage = getProgressPercentage(goal.current, goal.target);
          const color = getProgressColor(percentage);
          
          return (
            <div key={index} className={styles.goalItem}>
              <div className={styles.goalHeader}>
                <span className={styles.goalLabel}>{goal.label}</span>
                <span className={styles.goalType}>
                  {goal.type === 'daily' ? '오늘' : '이번 주'}
                </span>
              </div>
              
              <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
                <span className={styles.progressText}>
                  {goal.current} / {goal.target} {goal.unit}
                </span>
              </div>
              
              {percentage >= 100 && (
                <div className={styles.achievement}>
                  ✨ 목표 달성!
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.motivationalQuote}>
        <p>"매일 조금씩 꾸준히 하면 큰 변화가 생깁니다"</p>
        <span>- 오늘도 화이팅! 💪</span>
      </div>
    </div>
  );
};