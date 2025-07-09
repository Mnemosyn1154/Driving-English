'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { WakeWordIndicator } from '@/components/DrivingMode/WakeWordIndicator';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/components/Auth/withAuth';
import { useWakeWord } from '@/hooks/useWakeWord';
import styles from './page.module.css';

// Mock data for testing
const mockArticle = {
  title: 'Technology advances in electric vehicles',
  sentences: [
    {
      id: '1',
      text: 'Electric vehicles are becoming more popular worldwide.',
      translation: '전기차가 전 세계적으로 더 인기를 얻고 있습니다.',
    },
    {
      id: '2',
      text: 'Battery technology has improved significantly in recent years.',
      translation: '배터리 기술이 최근 몇 년간 크게 향상되었습니다.',
    },
    {
      id: '3',
      text: 'Many countries are investing in charging infrastructure.',
      translation: '많은 국가들이 충전 인프라에 투자하고 있습니다.',
    },
    {
      id: '4',
      text: 'The cost of electric vehicles continues to decrease.',
      translation: '전기차의 가격이 계속 하락하고 있습니다.',
    },
    {
      id: '5',
      text: 'Environmental benefits are driving consumer adoption.',
      translation: '환경적 이점이 소비자 채택을 촉진하고 있습니다.',
    },
  ],
};

function DrivingModePage() {
  const router = useRouter();
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  const [enableWakeWord, setEnableWakeWord] = useState(true);
  
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
    switch (command) {
      case 'next':
        if (currentSentenceIndex < mockArticle.sentences.length - 1) {
          setCurrentSentenceIndex(prev => prev + 1);
        }
        break;
      case 'previous':
        if (currentSentenceIndex > 0) {
          setCurrentSentenceIndex(prev => prev - 1);
        }
        break;
      case 'repeat':
        // Trigger TTS to repeat current sentence
        console.log('Repeating sentence:', mockArticle.sentences[currentSentenceIndex].text);
        break;
      case 'pause':
        setIsPlaying(false);
        break;
      case 'play':
        setIsPlaying(true);
        break;
      case 'exit':
        router.push('/');
        break;
    }
  }, [currentSentenceIndex, router]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      const timer = setTimeout(() => {
        if (currentSentenceIndex < mockArticle.sentences.length - 1) {
          setCurrentSentenceIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, 5000); // 5 seconds per sentence

      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentSentenceIndex]);

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

  return (
    <div className={styles.container}>
      {/* Wake Word Indicator */}
      <WakeWordIndicator
        isListening={isWakeWordListening}
        isDetected={isWakeWordDetected}
        error={wakeWordError}
      />
      
      <DrivingChatInterface
        currentSentence={mockArticle.sentences[currentSentenceIndex]}
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