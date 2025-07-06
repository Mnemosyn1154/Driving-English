'use client';

import React, { useState, useEffect } from 'react';
import styles from './MinimalNewsDisplay.module.css';

interface Sentence {
  id: string;
  text: string;
  translation?: string;
}

interface MinimalNewsDisplayProps {
  title: string;
  sentences: Sentence[];
  currentSentenceIndex: number;
  isPlaying: boolean;
  onSentenceChange: (index: number) => void;
}

export const MinimalNewsDisplay: React.FC<MinimalNewsDisplayProps> = ({
  title,
  sentences,
  currentSentenceIndex,
  isPlaying,
  onSentenceChange,
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const currentSentence = sentences[currentSentenceIndex];
  const progress = ((currentSentenceIndex + 1) / sentences.length) * 100;

  // Auto-hide translation after showing
  useEffect(() => {
    if (showTranslation) {
      const timer = setTimeout(() => {
        setShowTranslation(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showTranslation, currentSentenceIndex]);

  const handleSwipeLeft = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      onSentenceChange(currentSentenceIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentSentenceIndex > 0) {
      onSentenceChange(currentSentenceIndex - 1);
    }
  };

  const handleTap = () => {
    setShowTranslation(!showTranslation);
  };

  return (
    <div className={styles.container}>
      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Title - minimal display */}
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.counter}>
          {currentSentenceIndex + 1} / {sentences.length}
        </span>
      </div>

      {/* Main content area with swipe gestures */}
      <div 
        className={styles.content}
        onClick={handleTap}
        role="button"
        tabIndex={0}
        aria-label="탭하여 번역 보기"
      >
        {/* Current sentence */}
        <div className={styles.sentenceContainer}>
          <p className={styles.sentence}>
            {currentSentence?.text}
          </p>
          
          {/* Translation (shown on tap) */}
          {showTranslation && currentSentence?.translation && (
            <p className={styles.translation}>
              {currentSentence.translation}
            </p>
          )}
        </div>

        {/* Visual indicators for swipe */}
        <div className={styles.swipeIndicators}>
          {currentSentenceIndex > 0 && (
            <div className={styles.swipeLeft}>
              <span>←</span>
            </div>
          )}
          {currentSentenceIndex < sentences.length - 1 && (
            <div className={styles.swipeRight}>
              <span>→</span>
            </div>
          )}
        </div>
      </div>

      {/* Simple navigation buttons for non-gesture control */}
      <div className={styles.navigation}>
        <button
          className={styles.navButton}
          onClick={() => handleSwipeRight()}
          disabled={currentSentenceIndex === 0}
          aria-label="이전 문장"
        >
          이전
        </button>
        
        <div className={styles.playIndicator}>
          {isPlaying ? '재생 중' : '일시정지'}
        </div>
        
        <button
          className={styles.navButton}
          onClick={() => handleSwipeLeft()}
          disabled={currentSentenceIndex === sentences.length - 1}
          aria-label="다음 문장"
        >
          다음
        </button>
      </div>
    </div>
  );
};