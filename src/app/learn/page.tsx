
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/Auth/withAuth';
import { useAnalytics } from '@/providers/AnalyticsProvider';
import styles from './page.module.css';

import { useArticleData } from '@/hooks/useArticleData';
import { useSentenceControl } from '@/hooks/useSentenceControl';
import { VoiceController } from '@/components/LearnMode/controllers/VoiceController';
import { Sentence } from '@/types/article';

function LearnModePage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true); // 자동 재생을 위해 true로 시작

  // Get articleId from URL
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const articleId = urlParams?.get('articleId') || undefined;

  // 1. Article Data Module
  const { article, isLoading, error } = useArticleData(articleId);

  // 2. Sentence Control Module
  const { currentSentence, currentIndex, goToNext, goToPrev } = useSentenceControl({
    article,
  });

  // Analytics 훅
  const { trackLearningProgress, trackEvent } = useAnalytics();

  // Handle voice commands
  const handleCommand = useCallback((command: string) => {
    if (!article || !currentSentence) return;

    switch (command) {
      case 'next':
        goToNext();
        // Analytics 추적
        trackLearningProgress({
          articleId: article.id,
          sentencesCompleted: currentIndex + 1,
          totalSentences: article.sentences.length,
          timeSpent: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
          voiceInteractions: 0, // TODO: Integrate with actual voice interaction stats
          completionRate: ((currentIndex + 1) / article.sentences.length) * 100,
        });
        trackEvent('sentence_navigation', {
          direction: 'next',
          sentenceIndex: currentIndex + 1,
          articleId: article.id,
        });
        break;
      case 'previous':
        goToPrev();
        break;
      case 'repeat':
        // VoiceController will handle the actual repetition based on currentSentence prop
        // We just need to ensure isPlaying is true to trigger it
        setIsPlaying(true);
        break;
      case 'pause':
        setIsPlaying(false);
        break;
      case 'play':
        setIsPlaying(true);
        break;
      case 'exit':
        // TODO: Integrate with endSession from useProgressTracking
        router.push('/');
        break;
    }
  }, [article, currentSentence, currentIndex, goToNext, goToPrev, router, trackLearningProgress, trackEvent, repeat]);

  // Auto-play functionality - 오디오 재생 완료 후 다음 문장으로
  useEffect(() => {
    if (isPlaying && currentSentence) {
      // This effect will trigger VoiceController to play the current sentence.
      // The VoiceController should ideally have a callback for when it finishes playing
      // to then call goToNext(). For now, we'll simulate auto-advance.
      // In a real scenario, VoiceController would emit an 'onPlaybackComplete' event.
      const autoAdvanceTimeout = setTimeout(() => {
        if (isPlaying && currentSentence && article && currentIndex < article.sentences.length - 1) {
          goToNext();
        } else if (isPlaying && currentSentence && article && currentIndex === article.sentences.length - 1) {
          // Article completed
          setIsPlaying(false);
          // TODO: Integrate with updateArticleProgress for completion
          trackLearningProgress({
            articleId: article.id,
            sentencesCompleted: article.sentences.length,
            totalSentences: article.sentences.length,
            timeSpent: Date.now() - (window.performance?.timing?.navigationStart || Date.now()),
            voiceInteractions: 0, // TODO: Integrate with actual voice interaction stats
            completionRate: 100,
          });
          trackEvent('article_completed', {
            articleId: article.id,
            totalSentences: article.sentences.length,
            studyTime: Math.round((Date.now() - (window.performance?.timing?.navigationStart || Date.now())) / 1000),
          });
        }
      }, 5000); // Simulate playback duration

      return () => clearTimeout(autoAdvanceTimeout);
    }
  }, [isPlaying, currentSentence, article, currentIndex, goToNext, trackLearningProgress, trackEvent]);

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

  if (isLoading) {
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

  return (
    <div className={styles.container}>
      {currentSentence && (
        <VoiceController
          textToSpeak={currentSentence.text}
          translationToSpeak={currentSentence.translation}
          onCommand={handleCommand}
          isPlaying={isPlaying}
        />
      )}
      <DrivingChatInterface
        currentSentence={currentSentence as Sentence}
        onCommand={handleCommand}
        isPlaying={isPlaying}
      />

      {/* Simple sentence counter */}
      <div className={styles.sentenceCounter}>
        {currentIndex + 1} / {article.sentences.length}
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
