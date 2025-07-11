'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/Auth/withAuth';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { useAnalytics } from '@/providers/AnalyticsProvider';
import styles from './page.module.css';

interface Article {
  id: string;
  title: string;
  sentences: Array<{
    id: string;
    text: string;
    translation: string;
    audioUrl?: string;
    order: number;
  }>;
}

function LearnModePage() {
  const router = useRouter();
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 진도 관리 훅
  const {
    startSession,
    endSession,
    updateArticleProgress,
    getArticleProgress,
    isSessionActive,
    progressPercentage,
    stats
  } = useProgressTracking({ mode: 'learn', autoSave: true });

  // Analytics 훅
  const { trackLearningProgress, trackEvent } = useAnalytics();

  // 기사 데이터 로드
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // URL에서 articleId 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('articleId');
        
        let response;
        if (articleId) {
          // 특정 기사 요청
          response = await fetch(`/api/news/articles/${articleId}`);
        } else {
          // 추천 기사 요청
          response = await fetch('/api/news/articles?type=recommendations&limit=1');
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }
        
        const data = await response.json();
        
        if (articleId) {
          // 단일 기사 응답
          setArticle(data);
        } else {
          // 추천 기사 리스트 응답
          if (data.articles && data.articles.length > 0) {
            setArticle(data.articles[0]);
          } else {
            throw new Error('No articles available');
          }
        }
        
        // 진도 관리 시작
        if (!isSessionActive) {
          await startSession();
        }
        
        // 기사 진도 조회
        if (data.id || (data.articles && data.articles.length > 0)) {
          const articleId = data.id || data.articles[0].id;
          try {
            const progress = await getArticleProgress(articleId);
            setCurrentSentenceIndex(progress.currentSentence || 0);
          } catch (err) {
            console.error('Failed to load article progress:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        setError('기사를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [isSessionActive, startSession, getArticleProgress]);

  // Handle voice commands
  const handleCommand = useCallback((command: string) => {
    if (!article) return;
    
    switch (command) {
      case 'next':
        if (currentSentenceIndex < article.sentences.length - 1) {
          const newIndex = currentSentenceIndex + 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, article.sentences.length);
          
          // Analytics 추적
          trackLearningProgress({
            articleId: article.id,
            sentencesCompleted: newIndex,
            totalSentences: article.sentences.length,
            timeSpent: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
            voiceInteractions: stats.sentencesRead,
            completionRate: (newIndex / article.sentences.length) * 100
          });
          
          trackEvent('sentence_navigation', {
            direction: 'next',
            sentenceIndex: newIndex,
            articleId: article.id
          });
        }
        break;
      case 'previous':
        if (currentSentenceIndex > 0) {
          const newIndex = currentSentenceIndex - 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, article.sentences.length);
        }
        break;
      case 'repeat':
        // Trigger TTS to repeat current sentence
        console.log('Repeating sentence:', article.sentences[currentSentenceIndex].text);
        break;
      case 'pause':
        setIsPlaying(false);
        break;
      case 'play':
        setIsPlaying(true);
        break;
      case 'exit':
        // 세션 종료
        endSession();
        router.push('/');
        break;
    }
  }, [currentSentenceIndex, router, article]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && article) {
      const timer = setTimeout(() => {
        if (currentSentenceIndex < article.sentences.length - 1) {
          const newIndex = currentSentenceIndex + 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, article.sentences.length);
        } else {
          setIsPlaying(false);
          // 기사 완료 시 진도 업데이트
          updateArticleProgress(article.id, article.sentences.length, article.sentences.length, {
            isCompleted: true
          });
          
          // Analytics 추적 - 기사 완료
          trackLearningProgress({
            articleId: article.id,
            sentencesCompleted: article.sentences.length,
            totalSentences: article.sentences.length,
            timeSpent: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
            voiceInteractions: stats.sentencesRead,
            completionRate: 100
          });
          
          trackEvent('article_completed', {
            articleId: article.id,
            totalSentences: article.sentences.length,
            studyTime: Math.round((Date.now() - (window.performance?.timing?.navigationStart || Date.now())) / 1000)
          });
        }
      }, 5000); // 5 seconds per sentence

      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentSentenceIndex, article, updateArticleProgress]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          handleCommand('next');
          break;
        case 'ArrowLeft':
          handleCommand('previous');
          break;
        case ' ':
          e.preventDefault();
          handleCommand(isPlaying ? 'pause' : 'play');
          break;
        case 'Escape':
          handleCommand('exit');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleCommand, isPlaying]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>기사를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error || '기사를 불러올 수 없습니다.'}</p>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 기사에 sentences가 없거나 비어있는 경우 콘텐츠를 문장으로 분할
  const sentences = article.sentences && article.sentences.length > 0 
    ? article.sentences 
    : [{ 
        id: '1', 
        text: '이 기사는 아직 처리되지 않았습니다.', 
        translation: 'This article has not been processed yet.',
        order: 1
      }];

  return (
    <div className={styles.container}>
      <DrivingChatInterface
        currentSentence={sentences[currentSentenceIndex]}
        onCommand={handleCommand}
        isPlaying={isPlaying}
      />
      
      {/* Simple sentence counter */}
      <div className={styles.sentenceCounter}>
        {currentSentenceIndex + 1} / {sentences.length}
      </div>
      
      {/* Exit button */}
      <button
        className={styles.exitButton}
        onClick={() => router.push('/dashboard')}
        aria-label="학습 모드 종료"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  );
}

// Export with authentication
export default withAuth(LearnModePage, { allowSkipAuth: true });