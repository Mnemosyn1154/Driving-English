'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DrivingChatInterface } from '@/components/DrivingMode/DrivingChatInterface';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/Auth/AuthModal';
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
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // 로그인 상태 확인
  useEffect(() => {
    const skipAuth = localStorage.getItem('skipAuth');
    if (!loading && !user && !skipAuth) {
      // 로그인되지 않은 경우 모달 표시
      setShowAuthModal(true);
    }
  }, [user, loading]);

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
      <DrivingChatInterface
        currentSentence={mockArticle.sentences[currentSentenceIndex]}
        onCommand={handleCommand}
        isPlaying={isPlaying}
      />
      
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

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          // 로그인하지 않고 닫으면 홈으로 이동
          if (!user) {
            router.push('/');
          }
        }}
        onSuccess={() => {
          setShowAuthModal(false);
          // 로그인 성공 시 계속 진행
        }}
      />
    </div>
  );
}