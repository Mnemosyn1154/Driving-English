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

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news/articles?type=recommendations&limit=3');
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      
      const data = await response.json();
      
      // API 응답을 컴포넌트에 맞게 변환
      const formattedRecommendations = data.articles.map((article: any) => ({
        id: article.id,
        title: article.title,
        source: article.source?.name || 'Unknown',
        category: article.category || 'general',
        estimatedTime: Math.ceil(article.readingTime) || 5, // 이미 분 단위
        summary: article.summary || 'No summary available'
      }));
      
      setRecommendations(formattedRecommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      // 에러 시 빈 배열 설정
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
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
        <button className={styles.refreshButton} onClick={() => {
          setRecommendations([]);
          setLoading(true);
          fetchRecommendations();
        }}>
          새로고침
        </button>
      </div>

      <div className={styles.recommendations}>
        {recommendations.length === 0 ? (
          <div className={styles.noRecommendations}>
            <p>현재 추천할 기사가 없습니다.</p>
            <p>잠시 후 다시 시도해주세요.</p>
          </div>
        ) : (
          recommendations.map((article) => (
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
          ))
        )}
      </div>

      <div className={styles.tip}>
        💡 AI가 당신의 관심사와 학습 패턴을 분석하여 추천합니다
      </div>
    </div>
  );
};