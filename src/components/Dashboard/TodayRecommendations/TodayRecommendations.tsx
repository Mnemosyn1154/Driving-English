'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './TodayRecommendations.module.css';

interface Recommendation {
  id: string;
  title: string;
  source: string;
  category: string;
  estimatedTime: number;
  imageUrl?: string;
  summary: string;
}

export const TodayRecommendations: React.FC = () => {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: API에서 실제 추천 기사 가져오기
    // 임시 데이터
    setTimeout(() => {
      setRecommendations([
        {
          id: '1',
          title: 'The Future of Electric Vehicles: What to Expect in 2024',
          source: 'TechCrunch',
          category: 'technology',
          estimatedTime: 8,
          summary: 'Explore the latest innovations in electric vehicle technology and what major automakers are planning for the coming year.'
        },
        {
          id: '2',
          title: 'How AI is Transforming Healthcare Diagnostics',
          source: 'MIT Technology Review',
          category: 'health',
          estimatedTime: 12,
          summary: 'Discover how artificial intelligence is revolutionizing medical diagnostics and improving patient outcomes.'
        },
        {
          id: '3',
          title: 'Global Economic Outlook: Challenges and Opportunities',
          source: 'Financial Times',
          category: 'business',
          estimatedTime: 10,
          summary: 'An in-depth analysis of the current global economic situation and predictions for the future.'
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      technology: '#667eea',
      health: '#48bb78',
      business: '#ed8936',
      science: '#38b2ac',
      sports: '#e53e3e',
      entertainment: '#d69e2e',
      world: '#718096',
      politics: '#9f7aea'
    };
    return colors[category] || '#718096';
  };

  const handleStartLearning = (articleId: string) => {
    router.push(`/learn?articleId=${articleId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>🎯 오늘의 추천 기사</h2>
        <div className={styles.loading}>
          <div className={styles.skeleton}></div>
          <div className={styles.skeleton}></div>
          <div className={styles.skeleton}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🎯 오늘의 추천 기사</h2>
        <button className={styles.refreshButton} onClick={() => {}}>
          새로고침
        </button>
      </div>

      <div className={styles.recommendations}>
        {recommendations.map((article) => (
          <div key={article.id} className={styles.recommendationCard}>
            <div 
              className={styles.categoryBadge}
              style={{ backgroundColor: getCategoryColor(article.category) }}
            >
              {article.category}
            </div>
            
            <h3 className={styles.articleTitle}>{article.title}</h3>
            <p className={styles.summary}>{article.summary}</p>
            
            <div className={styles.cardFooter}>
              <div className={styles.metadata}>
                <span className={styles.source}>{article.source}</span>
                <span className={styles.dot}>•</span>
                <span className={styles.time}>⏱ {article.estimatedTime}분</span>
              </div>
              
              <button
                className={styles.startButton}
                onClick={() => handleStartLearning(article.id)}
              >
                학습 시작
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.tip}>
        💡 AI가 당신의 관심사와 학습 패턴을 분석하여 추천합니다
      </div>
    </div>
  );
};