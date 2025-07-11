'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface ProgressState {
  sessionId: string | null;
  currentArticleId: string | null;
  currentSentence: number;
  totalSentences: number;
  isSessionActive: boolean;
  lastUpdateTime: Date | null;
}

interface UseProgressTrackingOptions {
  mode?: 'learn' | 'driving';
  autoSave?: boolean;
  saveInterval?: number; // milliseconds
}

export function useProgressTracking(options: UseProgressTrackingOptions = {}) {
  const { mode = 'learn', autoSave = true, saveInterval = 30000 } = options;
  const { isAuthenticated, isSkipAuth } = useAuth();
  
  const [state, setState] = useState<ProgressState>({
    sessionId: null,
    currentArticleId: null,
    currentSentence: 0,
    totalSentences: 0,
    isSessionActive: false,
    lastUpdateTime: null
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    articlesRead: 0,
    sentencesRead: 0,
    totalReadingTime: 0
  });

  // 학습 세션 시작
  const startSession = useCallback(async (deviceInfo?: any) => {
    // 게스트 모드에서는 API 호출하지 않음
    if (isSkipAuth || !isAuthenticated) {
      setState(prev => ({
        ...prev,
        sessionId: 'guest-session',
        isSessionActive: true,
        lastUpdateTime: new Date()
      }));
      console.log('Guest mode: Local session started');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/progress/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, deviceInfo })
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        sessionId: data.sessionId,
        isSessionActive: true,
        lastUpdateTime: new Date()
      }));

      console.log('Learning session started:', data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      console.error('Error starting session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [mode, isSkipAuth, isAuthenticated]);

  // 학습 세션 종료
  const endSession = useCallback(async () => {
    if (!state.sessionId) return;

    // 게스트 모드에서는 로컬에서만 처리
    if (isSkipAuth || !isAuthenticated) {
      setState(prev => ({
        ...prev,
        sessionId: null,
        isSessionActive: false,
        lastUpdateTime: null
      }));
      console.log('Guest mode: Local session ended');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/progress/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          articlesRead: stats.articlesRead,
          sentencesRead: stats.sentencesRead
        })
      });

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        sessionId: null,
        isSessionActive: false,
        lastUpdateTime: new Date()
      }));

      console.log('Learning session ended:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
      console.error('Error ending session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [state.sessionId, stats, isSkipAuth, isAuthenticated]);

  // 기사 진도 업데이트
  const updateArticleProgress = useCallback(async (
    articleId: string,
    currentSentence: number,
    totalSentences: number,
    options: {
      isCompleted?: boolean;
      isBookmarked?: boolean;
      readingTime?: number;
    } = {}
  ) => {
    // 게스트 모드에서는 로컬 상태만 업데이트
    if (isSkipAuth || !isAuthenticated) {
      setState(prev => ({
        ...prev,
        currentArticleId: articleId,
        currentSentence,
        totalSentences,
        lastUpdateTime: new Date()
      }));
      
      // 로컬 스토리지에 저장
      localStorage.setItem(`guest-progress-${articleId}`, JSON.stringify({
        currentSentence,
        totalSentences,
        lastUpdate: new Date().toISOString()
      }));
      
      return;
    }

    try {
      setError(null);

      const response = await fetch('/api/progress/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          currentSentence,
          totalSentences,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update article progress');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        currentArticleId: articleId,
        currentSentence,
        totalSentences,
        lastUpdateTime: new Date()
      }));

      // 통계 업데이트
      if (options.isCompleted && state.currentArticleId !== articleId) {
        setStats(prev => ({
          ...prev,
          articlesRead: prev.articlesRead + 1
        }));
      }

      if (currentSentence > state.currentSentence) {
        setStats(prev => ({
          ...prev,
          sentencesRead: prev.sentencesRead + (currentSentence - state.currentSentence)
        }));
      }

      if (options.readingTime) {
        setStats(prev => ({
          ...prev,
          totalReadingTime: prev.totalReadingTime + options.readingTime!
        }));
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
      console.error('Error updating article progress:', err);
      throw err;
    }
  }, [state.currentSentence, state.currentArticleId, isSkipAuth, isAuthenticated]);

  // 기사 진도 조회
  const getArticleProgress = useCallback(async (articleId: string) => {
    // 게스트 모드에서는 로컬 스토리지에서 조회
    if (isSkipAuth || !isAuthenticated) {
      const saved = localStorage.getItem(`guest-progress-${articleId}`);
      if (saved) {
        const data = JSON.parse(saved);
        return {
          currentSentence: data.currentSentence,
          totalSentences: data.totalSentences,
          isCompleted: false,
          readingTime: 0
        };
      }
      return {
        currentSentence: 0,
        totalSentences: 0,
        isCompleted: false,
        readingTime: 0
      };
    }

    try {
      setError(null);

      const response = await fetch(`/api/progress/article?articleId=${articleId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch article progress');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        currentArticleId: articleId,
        currentSentence: data.currentSentence,
        totalSentences: data.totalSentences
      }));

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch progress');
      console.error('Error fetching article progress:', err);
      throw err;
    }
  }, [isSkipAuth, isAuthenticated]);

  // 진도 북마크 토글
  const toggleBookmark = useCallback(async (articleId: string, isBookmarked: boolean) => {
    // 게스트 모드에서는 지원하지 않음
    if (isSkipAuth || !isAuthenticated) {
      console.log('Guest mode: Bookmarks not supported');
      return;
    }

    try {
      await updateArticleProgress(articleId, state.currentSentence, state.totalSentences, {
        isBookmarked
      });
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  }, [updateArticleProgress, state.currentSentence, state.totalSentences, isSkipAuth, isAuthenticated]);

  // 자동 저장 설정
  useEffect(() => {
    if (!autoSave || !state.isSessionActive) return;

    const interval = setInterval(async () => {
      if (state.currentArticleId && state.lastUpdateTime) {
        const timeSinceUpdate = Date.now() - state.lastUpdateTime.getTime();
        if (timeSinceUpdate >= saveInterval) {
          try {
            await updateArticleProgress(
              state.currentArticleId,
              state.currentSentence,
              state.totalSentences,
              { readingTime: Math.round(timeSinceUpdate / 1000) }
            );
          } catch (err) {
            console.error('Auto-save failed:', err);
          }
        }
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [autoSave, state.isSessionActive, state.currentArticleId, state.lastUpdateTime, saveInterval, updateArticleProgress, state.currentSentence, state.totalSentences]);

  // 컴포넌트 언마운트 시 세션 종료
  useEffect(() => {
    return () => {
      if (state.isSessionActive) {
        endSession();
      }
    };
  }, [state.isSessionActive, endSession]);

  return {
    // State
    sessionId: state.sessionId,
    currentArticleId: state.currentArticleId,
    currentSentence: state.currentSentence,
    totalSentences: state.totalSentences,
    isSessionActive: state.isSessionActive,
    isLoading,
    error,
    stats,
    
    // Progress percentage
    progressPercentage: state.totalSentences > 0 ? (state.currentSentence / state.totalSentences) * 100 : 0,

    // Actions
    startSession,
    endSession,
    updateArticleProgress,
    getArticleProgress,
    toggleBookmark,
    
    // Utility
    clearError: () => setError(null)
  };
}