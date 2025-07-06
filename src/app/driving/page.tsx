'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingModeLayout } from '@/components/DrivingMode/DrivingModeLayout';
import { VoiceControl } from '@/components/DrivingMode/VoiceControl';
import { MinimalNewsDisplay } from '@/components/DrivingMode/MinimalNewsDisplay';
import { useRouter } from 'next/navigation';
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

export default function DrivingModePage() {
  const router = useRouter();
  const [isDrivingMode, setIsDrivingMode] = useState(true);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  // Handle voice commands
  const handleCommand = useCallback((command: string) => {
    setLastCommand(command);
    
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

  // Handle transcript updates
  const handleTranscript = useCallback((transcript: string) => {
    setLastTranscript(transcript);
  }, []);

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
    <DrivingModeLayout isDrivingMode={isDrivingMode}>
      <div className={styles.container}>
        {/* Main news display */}
        <MinimalNewsDisplay
          title={mockArticle.title}
          sentences={mockArticle.sentences}
          currentSentenceIndex={currentSentenceIndex}
          isPlaying={isPlaying}
          onSentenceChange={setCurrentSentenceIndex}
        />

        {/* Voice control */}
        <VoiceControl
          isActive={isDrivingMode}
          onCommand={handleCommand}
          onTranscript={handleTranscript}
        />

        {/* Debug info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className={styles.debugInfo}>
            <p>Last command: {lastCommand}</p>
            <p>Last transcript: {lastTranscript}</p>
          </div>
        )}

        {/* Exit button */}
        <button
          className={styles.exitButton}
          onClick={() => router.push('/')}
          aria-label="운전 모드 종료"
        >
          ✕
        </button>
      </div>
    </DrivingModeLayout>
  );
}