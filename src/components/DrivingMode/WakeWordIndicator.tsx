'use client';

import React, { useEffect, useState } from 'react';
import styles from './WakeWordIndicator.module.css';

interface WakeWordIndicatorProps {
  isListening: boolean;
  lastDetection: {
    wakeWord: string;
    confidence: number;
    timestamp: number;
  } | null;
  error: Error | null;
}

export const WakeWordIndicator: React.FC<WakeWordIndicatorProps> = ({
  isListening,
  lastDetection,
  error,
}) => {
  const [showDetection, setShowDetection] = useState(false);

  useEffect(() => {
    if (lastDetection) {
      setShowDetection(true);
      const timer = setTimeout(() => {
        setShowDetection(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastDetection]);

  if (error) {
    return (
      <div className={`${styles.container} ${styles.error}`}>
        <span className={styles.icon}>⚠️</span>
        <span className={styles.text}>음성 인식 오류</span>
      </div>
    );
  }

  if (showDetection && lastDetection) {
    return (
      <div className={`${styles.container} ${styles.detected}`}>
        <span className={styles.icon}>✓</span>
        <span className={styles.text}>
          "{lastDetection.wakeWord}" 감지됨
        </span>
      </div>
    );
  }

  if (isListening) {
    return (
      <div className={`${styles.container} ${styles.listening}`}>
        <span className={styles.icon}>
          <span className={styles.pulse}></span>
          🎤
        </span>
        <span className={styles.text}>음성 명령 대기 중...</span>
      </div>
    );
  }

  return null;
};