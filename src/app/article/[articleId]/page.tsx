'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Sentence {
  id: string;
  order: number;
  text: string;
  translation?: string;
  audioUrlEn?: string;
  audioUrlKo?: string;
  difficulty: number;
  wordCount: number;
}

interface Article {
  id: string;
  title: string;
  titleKo?: string;
  summary: string;
  summaryKo?: string;
  content: string;
  difficulty: number;
  wordCount: number;
  readingTime: number;
  category: string;
  publishedAt: string;
  sentences: Sentence[];
  audioUrlEn?: string;
  audioUrlKo?: string;
}

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    fetchArticle();
  }, [params.articleId]);

  async function fetchArticle() {
    try {
      setLoading(true);
      const response = await fetch(`/api/news/articles/${params.articleId}`);
      if (!response.ok) throw new Error('Failed to fetch article');
      
      const data = await response.json();
      setArticle(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handlePrevious = () => {
    setCurrentSentence(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (article?.sentences && currentSentence < article.sentences.length - 1) {
      setCurrentSentence(prev => prev + 1);
    }
  };

  const handleToggleTranslation = () => {
    setShowTranslation(!showTranslation);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>기사를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className={styles.error}>
        <h2>오류가 발생했습니다</h2>
        <p>{error || '기사를 찾을 수 없습니다'}</p>
        <Link href="/" className={styles.backButton}>홈으로 돌아가기</Link>
      </div>
    );
  }

  const sentence = article.sentences?.[currentSentence];
  const progress = article.sentences?.length > 0 
    ? ((currentSentence + 1) / article.sentences.length) * 100 
    : 0;
    
  // If no sentences or invalid sentence index, show error
  if (!sentence || !article.sentences || article.sentences.length === 0) {
    return (
      <div className={styles.error}>
        <h2>문장을 찾을 수 없습니다</h2>
        <p>이 기사에는 표시할 문장이 없습니다.</p>
        <Link href="/" className={styles.backButton}>홈으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← 뒤로</Link>
        <div className={styles.headerInfo}>
          <span className={styles.category}>{article.category}</span>
          <span className={styles.difficulty}>난이도 {article.difficulty}</span>
        </div>
      </header>

      <article className={styles.article}>
        <h1 className={styles.title}>{article.title}</h1>
        {article.titleKo && (
          <h2 className={styles.titleKo}>{article.titleKo}</h2>
        )}

        <div className={styles.summary}>
          <p>{article.summary}</p>
          {article.summaryKo && (
            <p className={styles.summaryKo}>{article.summaryKo}</p>
          )}
        </div>

        <div className={styles.progress}>
          <div 
            className={styles.progressBar} 
            style={{ width: `${progress}%` }}
          />
          <span className={styles.progressText}>
            {currentSentence + 1} / {article.sentences.length}
          </span>
        </div>

        <div className={styles.sentenceCard}>
          <div className={styles.sentenceNumber}>
            문장 {currentSentence + 1}
          </div>
          
          <p className={styles.sentenceText}>{sentence.text}</p>
          
          {showTranslation && sentence.translation && (
            <p className={styles.translation}>{sentence.translation}</p>
          )}

          <div className={styles.sentenceActions}>
            <button 
              onClick={handleToggleTranslation}
              className={styles.translationButton}
            >
              {showTranslation ? '번역 숨기기' : '번역 보기'}
            </button>
          </div>
        </div>

        <div className={styles.navigation}>
          <button 
            onClick={handlePrevious}
            disabled={currentSentence === 0}
            className={styles.navButton}
          >
            이전
          </button>

          <button
            onClick={() => router.push('/driving')}
            className={styles.drivingModeButton}
          >
            🚗 운전 모드
          </button>

          <button 
            onClick={handleNext}
            disabled={currentSentence === article.sentences.length - 1}
            className={styles.navButton}
          >
            다음
          </button>
        </div>
      </article>
    </div>
  );
}