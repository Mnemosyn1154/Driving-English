'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { WakeWordIndicator } from '@/components/DrivingMode/WakeWordIndicator';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/Auth/withAuth';
import { useWakeWord } from '@/hooks/useWakeWord';
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

function DrivingModePage() {
  const router = useRouter();
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  const [enableWakeWord, setEnableWakeWord] = useState(true);
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
  } = useProgressTracking({ mode: 'driving', autoSave: true });
  
  // Analytics 훅
  const { trackDrivingMode, trackEvent } = useAnalytics();
  const [drivingStartTime] = useState(Date.now());
  
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
          
          // 운전 모드 시작 Analytics 추적
          trackEvent('driving_mode_start', {
            articleId: data.id || data.articles?.[0]?.id
          });
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
  
  // Wake word detection
  const {
    isListening: isWakeWordListening,
    isInitialized: isWakeWordReady,
    error: wakeWordError,
    start: startWakeWord,
    stop: stopWakeWord,
  } = useWakeWord({
    wakeWord: '헤이 드라이빙',
    threshold: 0.85,
    autoStart: false,
    onDetected: () => {
      console.log('Wake word detected!');
      setIsWakeWordDetected(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setIsWakeWordDetected(false), 3000);
    },
    onError: (error) => {
      console.error('Wake word error:', error);
    },
  });

  // Start wake word detection when ready
  useEffect(() => {
    if (isWakeWordReady && enableWakeWord) {
      startWakeWord();
    }
  }, [isWakeWordReady, enableWakeWord, startWakeWord]);
  
  // Clean up wake word detection on unmount
  useEffect(() => {
    return () => {
      if (isWakeWordListening) {
        stopWakeWord();
      }
    };
  }, [isWakeWordListening, stopWakeWord]);

  // Handle voice commands
  const handleCommand = useCallback((command: string) => {
    if (!article) return;
    
    const sentences = article.sentences && article.sentences.length > 0 
      ? article.sentences 
      : [{ id: '1', text: 'No content available', translation: '콘텐츠가 없습니다.', order: 1 }];
    
    switch (command) {
      case 'next':
        if (currentSentenceIndex < sentences.length - 1) {
          const newIndex = currentSentenceIndex + 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, sentences.length);
        }
        break;
      case 'previous':
        if (currentSentenceIndex > 0) {
          const newIndex = currentSentenceIndex - 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, sentences.length);
        }
        break;
      case 'repeat':
        // Trigger TTS to repeat current sentence
        console.log('Repeating sentence:', sentences[currentSentenceIndex].text);
        break;
      case 'pause':
        setIsPlaying(false);
        break;
      case 'play':
        setIsPlaying(true);
        break;
      case 'exit':
        // 운전 모드 Analytics 추적
        const sessionDuration = Date.now() - drivingStartTime;
        trackDrivingMode({
          sessionDuration,
          voiceCommandsUsed: stats.sentencesRead || 0,
          voiceCommandSuccess: stats.sentencesRead || 0, // TODO: 실제 성공/실패 추적 필요
          articlesCompleted: article && currentSentenceIndex >= article.sentences.length - 1 ? 1 : 0,
          safetyViolations: 0 // TODO: 안전 위반 추적 필요
        });
        
        trackEvent('driving_mode_exit', {
          duration: Math.round(sessionDuration / 1000),
          articleId: article?.id
        });
        
        // 세션 종료
        endSession();
        router.push('/');
        break;
    }
  }, [currentSentenceIndex, router, article, updateArticleProgress, endSession]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && article) {
      const sentences = article.sentences && article.sentences.length > 0 
        ? article.sentences 
        : [{ id: '1', text: 'No content available', translation: '콘텐츠가 없습니다.', order: 1 }];
      
      const timer = setTimeout(() => {
        if (currentSentenceIndex < sentences.length - 1) {
          const newIndex = currentSentenceIndex + 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, sentences.length);
        } else {
          setIsPlaying(false);
          // 기사 완료 시 진도 업데이트
          updateArticleProgress(article.id, sentences.length, sentences.length, {
            isCompleted: true
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

  // 기사에 sentences가 없거나 비어있는 경우 처리
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
      {/* Wake Word Indicator */}
      <WakeWordIndicator
        isListening={isWakeWordListening}
        isDetected={isWakeWordDetected}
        error={wakeWordError}
      />
      
      {/* Progress indicator */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className={styles.progressText}>
          {Math.round(progressPercentage)}% ({currentSentenceIndex + 1}/{sentences.length})
        </div>
      </div>
      
      <DrivingChatInterface
        currentSentence={sentences[currentSentenceIndex]}
        onCommand={handleCommand}
        isPlaying={isPlaying}
        isWakeWordDetected={isWakeWordDetected}
      />
      
      {/* Control buttons */}
      <div className={styles.controlBar}>
        {/* Wake word toggle */}
        <button
          className={`${styles.controlButton} ${enableWakeWord ? styles.active : ''}`}
          onClick={() => {
            setEnableWakeWord(!enableWakeWord);
            if (!enableWakeWord && isWakeWordReady) {
              startWakeWord();
            } else if (enableWakeWord && isWakeWordListening) {
              stopWakeWord();
            }
          }}
          aria-label={enableWakeWord ? '웨이크워드 비활성화' : '웨이크워드 활성화'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        
        {/* Exit button */}
        <button
          className={styles.exitButton}
          onClick={() => router.push('/')}
          aria-label="운전 모드 종료"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

    </div>
  );
}

// Export with authentication
export default withAuth(DrivingModePage, { allowSkipAuth: true });