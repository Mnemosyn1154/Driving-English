'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/Auth/withAuth';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { useAnalytics } from '@/providers/AnalyticsProvider';
import { useTTS } from '@/hooks/useTTS';
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
  const [isPlaying, setIsPlaying] = useState(true); // 자동 재생을 위해 true로 시작
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSentenceRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);
  const hasInitializedTTSRef = useRef(false);
  const ttsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedRef = useRef(false); // 현재 문장이 실제로 재생되었는지 추적
  const playStartTimeRef = useRef<number>(0); // 재생 시작 시간 추적
  const playCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 재생 확인 타임아웃
  const [sentences, setSentences] = useState<Array<{
    id: string;
    text: string;
    translation: string;
    audioUrl?: string;
    order: number;
  }>>([]);
  
  // TTS 훅 초기화
  const {
    synthesize,
    isPlaying: isTTSPlaying,
    isSynthesizing,
    play: playTTS,
    pause: pauseTTS,
    stop: stopTTS,
    error: ttsError
  } = useTTS({ 
    language: 'en-US',
    autoPlay: true,
    cacheEnabled: true
  });
  
  // TTS 상태 변화 추적
  useEffect(() => {
    console.log('[Learn] TTS 상태 변화:', {
      isTTSPlaying,
      isSynthesizing,
      ttsError: !!ttsError,
      currentSentenceIndex,
      hasPlayed: hasPlayedRef.current
    });
  }, [isTTSPlaying, isSynthesizing, ttsError, currentSentenceIndex]);
  
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
  
  // 컴포넌트 마운트 추적 및 cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 모든 timeout 정리
      if (ttsTimeoutRef.current) {
        clearTimeout(ttsTimeoutRef.current);
      }
      if (playCheckTimeoutRef.current) {
        clearTimeout(playCheckTimeoutRef.current);
      }
      // TTS 정지
      stopTTS();
    };
  }, [stopTTS]);

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
        
        let loadedArticle = null;
        
        if (articleId) {
          // 단일 기사 응답
          console.log('[Learn] 단일 기사 로드:', data);
          loadedArticle = data;
        } else {
          // 추천 기사 리스트 응답
          if (data.articles && data.articles.length > 0) {
            console.log('[Learn] 추천 기사 로드:', data.articles[0]);
            loadedArticle = data.articles[0];
          } else {
            throw new Error('No articles available');
          }
        }
        
        setArticle(loadedArticle);
        
        // sentences 설정
        console.log('[Learn] 기사 sentences 상세 확인:', {
          hasSentences: !!loadedArticle.sentences,
          sentenceCount: loadedArticle.sentences?.length || 0,
          articleTitle: loadedArticle.title,
          articleId: loadedArticle.id
        });
        
        // 첫 3개 문장 샘플 출력
        if (loadedArticle.sentences && loadedArticle.sentences.length > 0) {
          console.log('[Learn] 문장 샘플 (Top 3):');
          loadedArticle.sentences.slice(0, 3).forEach((s, i) => {
            console.log(`  [${i}]:`, {
              id: s?.id,
              text: s?.text?.substring(0, 50) + '...',
              translation: s?.translation?.substring(0, 30) + '...',
              hasText: !!s?.text,
              textLength: s?.text?.length || 0
            });
          });
        }
        
        if (loadedArticle.sentences && loadedArticle.sentences.length > 0) {
          // 문장 데이터 검증 및 정리
          const validSentences = loadedArticle.sentences
            .filter((sentence, index) => {
              const isValid = sentence && 
                            sentence.text && 
                            typeof sentence.text === 'string' &&
                            sentence.text.trim().length > 0;
              
              if (!isValid) {
                console.warn(`[Learn] 무효한 문장 [${index}]:`, sentence);
              }
              return isValid;
            })
            .map((sentence, index) => ({
              ...sentence,
              id: sentence.id || `sentence-${index}`,
              text: sentence.text.trim(),
              translation: sentence.translation || '',
              order: sentence.order || index + 1
            }));
          
          console.log('[Learn] 유효한 문장 수:', validSentences.length, '/', loadedArticle.sentences.length);
          
          if (validSentences.length > 0) {
            setSentences(validSentences);
            // 첫 번째 문장 자동 재생 - 약간의 지연 후
            if (isPlaying && validSentences[0]) {
              console.log('[Learn] 첫 번째 문장 자동 재생 예약:', {
                text: validSentences[0].text.substring(0, 50) + '...',
                translation: validSentences[0].translation?.substring(0, 30) + '...'
              });
              setTimeout(() => {
                if (isMountedRef.current && isPlaying) {
                  console.log('[Learn] 첫 번째 문장 자동 재생 시작');
                  hasPlayedRef.current = true;
                  playStartTimeRef.current = Date.now();
                  synthesize(validSentences[0].text);
                }
              }, 1000); // 초기 로딩 안정화를 위해 약간 더 긴 지연
            }
          } else {
            console.log('[Learn] 유효한 문장이 없음');
            setError('기사에 문장이 없습니다.');
          }
        } else {
          // 문장이 없는 경우
          console.log('[Learn] 기사에 sentences가 없음');
          setError('기사에 문장이 없습니다.');
        }
        
        // 진도 관리 시작
        if (!isSessionActive) {
          await startSession();
        }
        
        // 기사 진도 조회
        if (loadedArticle.id) {
          try {
            const progress = await getArticleProgress(loadedArticle.id);
            const savedIndex = progress.currentSentence || 0;
            console.log('[Learn] 저장된 진도:', savedIndex);
            setCurrentSentenceIndex(savedIndex);
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
  }, []); // 초기 로드 시 한 번만 실행

  // Handle voice commands
  const handleCommand = useCallback((command: string) => {
    if (!article) return;
    
    switch (command) {
      case 'next':
        if (sentences.length > 0 && currentSentenceIndex < sentences.length - 1) {
          const newIndex = currentSentenceIndex + 1;
          setCurrentSentenceIndex(newIndex);
          // 진도 업데이트
          updateArticleProgress(article.id, newIndex, sentences.length);
          
          // Analytics 추적
          trackLearningProgress({
            articleId: article.id,
            sentencesCompleted: newIndex,
            totalSentences: sentences.length,
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
        if (sentences.length > 0 && sentences[currentSentenceIndex]) {
          const sentence = sentences[currentSentenceIndex];
          console.log('[Learn] 반복 재생:', sentence.text.substring(0, 50) + '...');
          hasPlayedRef.current = true;
          playStartTimeRef.current = Date.now();
          synthesize(sentence.text);
        }
        break;
      case 'pause':
        setIsPlaying(false);
        pauseTTS();
        // timeout 정리
        if (ttsTimeoutRef.current) {
          clearTimeout(ttsTimeoutRef.current);
        }
        break;
      case 'play':
        setIsPlaying(true);
        if (sentences.length > 0 && sentences[currentSentenceIndex]) {
          const sentence = sentences[currentSentenceIndex];
          console.log('[Learn] 수동 재생:', sentence.text.substring(0, 50) + '...');
          hasPlayedRef.current = true;
          playStartTimeRef.current = Date.now();
          // 지연 없이 바로 재생 (수동 재생이므로)
          synthesize(sentence.text);
        }
        break;
      case 'exit':
        // 세션 종료
        endSession();
        router.push('/');
        break;
    }
  }, [currentSentenceIndex, router, article, sentences, updateArticleProgress, endSession, synthesize, pauseTTS, trackLearningProgress, trackEvent, stats.sentencesRead]);

  // TTS \uc790\ub3d9 \uc7ac\uc0dd - \ubb38\uc7a5\uc774 \ubcc0\uacbd\ub420 \ub54c\ub9c8\ub2e4 \uc2e4\ud589
  useEffect(() => {
    console.log('[Learn] TTS useEffect 실행:', {
      sentencesLength: sentences.length,
      currentSentenceIndex,
      hasSentence: !!sentences[currentSentenceIndex],
      isPlaying
    });
    
    if (sentences.length > 0 && currentSentenceIndex < sentences.length && 
        sentences[currentSentenceIndex] && isPlaying) {
      const currentSentence = sentences[currentSentenceIndex];
      
      console.log('[Learn] 현재 문장 확인:', currentSentence);
      
      // \uc774\uc804 \ubb38\uc7a5\uacfc \ub2e4\ub978 \uacbd\uc6b0\uc5d0\ub9cc \uc7ac\uc0dd
      if (currentSentence.text !== lastSentenceRef.current) {
        console.log('[Learn] TTS 재생 시도:', {
          text: currentSentence.text,
          index: currentSentenceIndex,
          isPlaying,
          isMounted: isMountedRef.current
        });
        lastSentenceRef.current = currentSentence.text;
        
        // 이전 timeout 취소
        if (ttsTimeoutRef.current) {
          clearTimeout(ttsTimeoutRef.current);
        }
        
        // 디바운싱으로 중복 호출 방지
        ttsTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && isPlaying) {
            // 재생 시작 표시
            playStartTimeRef.current = Date.now();
            
            // TTS 요청 후 실제 재생 확인
            synthesize(currentSentence.text).then(() => {
              console.log('[Learn] TTS 재생 요청 성공');
              
              // 3초 후에도 재생이 시작되지 않으면 다음으로 이동
              playCheckTimeoutRef.current = setTimeout(() => {
                if (!isTTSPlaying && !isSynthesizing && hasPlayedRef.current) {
                  console.warn('[Learn] TTS 재생이 시작되지 않음, 다음 문장으로 이동');
                  hasPlayedRef.current = false;
                  
                  if (currentSentenceIndex < sentences.length - 1 && isPlaying) {
                    setCurrentSentenceIndex(currentSentenceIndex + 1);
                  }
                }
              }, 3000);
              
              hasPlayedRef.current = true;
            }).catch((error) => {
              console.error('[Learn] TTS 재생 실패:', error);
              hasPlayedRef.current = false; // 실패 시 리셋
            });
          }
        }, 200); // 디바운싱 시간 증가
        
        return () => {
          if (ttsTimeoutRef.current) {
            clearTimeout(ttsTimeoutRef.current);
          }
        };
      }
    }
  }, [currentSentenceIndex, sentences, isPlaying, synthesize]);

  // TTS \uc5d0\ub7ec \ucc98\ub9ac
  useEffect(() => {
    if (ttsError) {
      console.error('[Learn] TTS Error:', ttsError);
      hasPlayedRef.current = false; // 에러 시 재생 상태 리셋
      
      // 에러 발생 시 다음 문장으로 이동 방지
      if (isPlaying) {
        console.log('[Learn] TTS 에러로 자동 재생 중지');
        setIsPlaying(false);
      }
    }
  }, [ttsError, isPlaying]);

  // Auto-play functionality - 오디오 재생 완료 후 다음 문장으로
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // 이전 timeout 정리
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    
    console.log('[Learn] Auto-play check:', {
      isTTSPlaying,
      isSynthesizing,
      isPlaying,
      hasPlayed: hasPlayedRef.current,
      currentSentenceIndex,
      sentencesLength: sentences.length
    });
    
    // 현재 문장이 재생되었고, TTS가 완료되었을 때만 다음으로
    if (!isTTSPlaying && !isSynthesizing && isPlaying && hasPlayedRef.current && article && sentences.length > 0) {
      const playDuration = Date.now() - playStartTimeRef.current;
      console.log('[Learn] 오디오 재생 완료, 재생 시간:', playDuration, 'ms');
      
      // 최소 재생 시간 보장 (3초)
      const minPlayTime = 3000;
      const waitTime = Math.max(2000, minPlayTime - playDuration);
      
      autoPlayTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && isPlaying) {
          if (currentSentenceIndex < sentences.length - 1) {
            const newIndex = currentSentenceIndex + 1;
            console.log('[Learn] 다음 문장으로 이동:', newIndex);
            hasPlayedRef.current = false; // 다음 문장을 위해 리셋
            setCurrentSentenceIndex(newIndex);
            // 진도 업데이트
            updateArticleProgress(article.id, newIndex, sentences.length);
          } else {
            console.log('[Learn] 기사 완료');
            setIsPlaying(false);
            hasPlayedRef.current = false;
            // 기사 완료 시 진도 업데이트
            updateArticleProgress(article.id, sentences.length, sentences.length, {
              isCompleted: true
            });
            
            // Analytics 추적 - 기사 완료
            trackLearningProgress({
              articleId: article.id,
              sentencesCompleted: sentences.length,
              totalSentences: sentences.length,
              timeSpent: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
              voiceInteractions: stats.sentencesRead,
              completionRate: 100
            });
            
            trackEvent('article_completed', {
              articleId: article.id,
              totalSentences: sentences.length,
              studyTime: Math.round((Date.now() - (window.performance?.timing?.navigationStart || Date.now())) / 1000)
            });
          }
        }
      }, waitTime); // 동적 대기 시간

      return () => {
        if (autoPlayTimeoutRef.current) {
          clearTimeout(autoPlayTimeoutRef.current);
          autoPlayTimeoutRef.current = null;
        }
      };
    }
  }, [isPlaying, isTTSPlaying, isSynthesizing, currentSentenceIndex, article, sentences, updateArticleProgress, trackLearningProgress, trackEvent, stats.sentencesRead]);

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

  // 디버깅을 위한 현재 문장 로그
  console.log('[Learn] 렌더링 시 currentSentence:', {
    currentSentenceIndex,
    sentencesLength: sentences.length,
    currentSentence: sentences[currentSentenceIndex] ? {
      id: sentences[currentSentenceIndex].id,
      text: sentences[currentSentenceIndex].text?.substring(0, 50) + '...',
      translation: sentences[currentSentenceIndex].translation?.substring(0, 30) + '...'
    } : null,
    isPlaying,
    hasPlayed: hasPlayedRef.current
  });

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