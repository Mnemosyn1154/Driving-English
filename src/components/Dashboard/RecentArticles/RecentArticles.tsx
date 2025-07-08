'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './RecentArticles.module.css';

interface Article {
  id: string;
  title: string;
  source: string;
  readAt: string;
  completionRate: number;
  bookmarked: boolean;
}

export const RecentArticles: React.FC = () => {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: API에서 실제 최근 읽은 기사 가져오기
    // 임시 데이터
    setTimeout(() => {
      setArticles([
        {
          id: '1',
          title: 'Tech Giants Report Record Profits Despite Economic Uncertainty',
          source: 'TechCrunch',
          readAt: '2시간 전',
          completionRate: 100,
          bookmarked: true
        },
        {
          id: '2',
          title: 'Climate Scientists Warn of Accelerating Global Warming',
          source: 'BBC News',
          readAt: '5시간 전',
          completionRate: 75,
          bookmarked: false
        },
        {
          id: '3',
          title: 'New AI Model Achieves Breakthrough in Language Understanding',
          source: 'MIT Tech Review',
          readAt: '어제',
          completionRate: 100,
          bookmarked: true
        },
        {
          id: '4',
          title: 'Global Markets React to Federal Reserve Decision',
          source: 'Reuters Business',
          readAt: '2일 전',
          completionRate: 50,
          bookmarked: false
        },
        {
          id: '5',
          title: 'Space Exploration: New Discoveries from Mars Rover',
          source: 'NASA News',
          readAt: '3일 전',
          completionRate: 100,
          bookmarked: false
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleArticleClick = (articleId: string) => {
    // TODO: 기사 상세 페이지나 학습 모드로 이동
    router.push(`/learn?articleId=${articleId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>📚 최근 학습 기록</h2>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📚 최근 학습 기록</h2>
      
      <div className={styles.articleList}>
        {articles.map((article) => (
          <div
            key={article.id}
            className={styles.articleItem}
            onClick={() => handleArticleClick(article.id)}
          >
            <div className={styles.articleContent}>
              <h3 className={styles.articleTitle}>{article.title}</h3>
              <div className={styles.articleMeta}>
                <span className={styles.source}>{article.source}</span>
                <span className={styles.separator}>•</span>
                <span className={styles.readTime}>{article.readAt}</span>
              </div>
            </div>
            
            <div className={styles.articleActions}>
              <div className={styles.completionBar}>
                <div
                  className={styles.completionProgress}
                  style={{ width: `${article.completionRate}%` }}
                />
              </div>
              <span className={styles.completionText}>{article.completionRate}%</span>
              {article.bookmarked && (
                <span className={styles.bookmark}>⭐</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className={styles.viewAllButton}
        onClick={() => router.push('/history')}
      >
        전체 기록 보기
      </button>
    </div>
  );
};