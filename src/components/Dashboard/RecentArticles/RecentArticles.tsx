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
    const fetchRecentArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/articles/recent?limit=5');
        
        if (!response.ok) {
          throw new Error('Failed to fetch recent articles');
        }
        
        const data = await response.json();
        setArticles(data.articles);
      } catch (error) {
        console.error('Error fetching recent articles:', error);
        // 에러 시 빈 배열 설정
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentArticles();
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