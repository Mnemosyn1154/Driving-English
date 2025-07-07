'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './NewsList.module.css';

interface Article {
  id: string;
  title: string;
  titleKo?: string;
  summary: string;
  difficulty: number;
  category: string;
  wordCount: number;
  publishedAt: string;
}

interface NewsListProps {
  category?: string;
}

export function NewsList({ category }: NewsListProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, [page, category]);

  async function fetchArticles() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(category && { category }),
      });

      const response = await fetch(`/api/news/articles?${params}`);
      if (!response.ok) throw new Error('Failed to fetch articles');

      const data = await response.json();
      setArticles(data.articles);
      setHasMore(data.pagination.hasNext);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['초급', '초중급', '중급', '중상급', '상급'];
    return labels[difficulty - 1] || '중급';
  };

  const getDifficultyColor = (difficulty: number) => {
    const colors = ['#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#F44336'];
    return colors[difficulty - 1] || '#FFC107';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      general: '일반',
      technology: '기술',
      business: '비즈니스',
      health: '건강',
      science: '과학',
      sports: '스포츠',
    };
    return labels[category] || category;
  };

  if (loading && articles.length === 0) {
    return <div className={styles.loading}>뉴스를 불러오는 중...</div>;
  }

  if (error) {
    return <div className={styles.error}>오류: {error}</div>;
  }

  if (articles.length === 0) {
    return <div className={styles.empty}>표시할 뉴스가 없습니다.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.articleList}>
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/article/${article.id}`}
            className={styles.articleCard}
          >
            <div className={styles.articleHeader}>
              <span className={styles.category}>
                {getCategoryLabel(article.category)}
              </span>
              <span 
                className={styles.difficulty}
                style={{ backgroundColor: getDifficultyColor(article.difficulty) }}
              >
                {getDifficultyLabel(article.difficulty)}
              </span>
            </div>
            
            <h3 className={styles.title}>{article.title}</h3>
            {article.titleKo && (
              <p className={styles.titleKo}>{article.titleKo}</p>
            )}
            
            <p className={styles.summary}>{article.summary}</p>
            
            <div className={styles.metadata}>
              <span>{article.wordCount} 단어</span>
              <span>•</span>
              <span>{new Date(article.publishedAt).toLocaleDateString('ko-KR')}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.pagination}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className={styles.pageButton}
        >
          이전
        </button>
        
        <span className={styles.pageInfo}>페이지 {page}</span>
        
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore || loading}
          className={styles.pageButton}
        >
          다음
        </button>
      </div>
    </div>
  );
}