'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import styles from './NewsList.module.css';

interface Article {
  id: string;
  title: string;
  titleKo?: string;
  summary: string;
  category: string;
  wordCount: number;
  publishedAt: string;
}

interface NewsListProps {
  category?: string;
  personalized?: boolean;
}

export function NewsList({ category, personalized = true }: NewsListProps) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, [page, category]);

  async function fetchArticles() {
    try {
      setLoading(true);
      
      // 개인화 설정 확인
      const preferences = localStorage.getItem('newsPreferences');
      const deviceId = localStorage.getItem('deviceId');
      const shouldPersonalize = personalized && (preferences || user);
      
      let response;
      if (shouldPersonalize) {
        // 개인화된 뉴스 가져오기
        const params = new URLSearchParams();
        if (user) {
          // TODO: user.id 대신 DB에서 가져온 userId 사용
          params.append('userId', user.id);
        } else if (deviceId) {
          params.append('deviceId', deviceId);
        }
        
        response = await fetch(`/api/news/personalized?${params}`);
        setIsPersonalized(true);
      } else {
        // 일반 뉴스 가져오기
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          ...(category && { category }),
        });
        
        response = await fetch(`/api/news/articles?${params}`);
        setIsPersonalized(false);
      }
      
      if (!response.ok) throw new Error('Failed to fetch articles');

      const data = await response.json();
      setArticles(data.articles);
      setHasMore(data.pagination?.hasNext || false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }


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

  // 초기 데이터가 없고 로딩 중일 때만 로딩 표시
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
      {isPersonalized && (
        <div className={styles.personalizedBadge}>
          🎯 개인화된 추천
        </div>
      )}
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
            </div>
            
            <h3 className={styles.title}>{article.title}</h3>
            {article.titleKo && (
              <p className={styles.titleKo}>{article.titleKo}</p>
            )}
            
            <p className={styles.summary}>{article.summary}</p>
            
            <div className={styles.metadata}>
              <span>{article.wordCount} 단어</span>
              <span>•</span>
              <span suppressHydrationWarning>{new Date(article.publishedAt).toLocaleDateString('ko-KR')}</span>
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