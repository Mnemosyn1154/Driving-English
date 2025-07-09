/**
 * Wake Word Indicator Component
 * Shows wake word detection status and visual feedback
 */

import React from 'react';
import styles from './WakeWordIndicator.module.css';

interface WakeWordIndicatorProps {
  isListening: boolean;
  isDetected: boolean;
  error?: Error | null;
  wakeWord?: string;
}

export const WakeWordIndicator: React.FC<WakeWordIndicatorProps> = ({
  isListening,
  isDetected,
  error,
  wakeWord = '헤이 드라이빙',
}) => {
  return (
    <div className={`${styles.container} ${isDetected ? styles.detected : ''}`}>
      <div className={styles.indicator}>
        <div className={`${styles.icon} ${isListening ? styles.listening : ''}`}>
          {isListening ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
          )}
        </div>
        
        <div className={styles.text}>
          {error ? (
            <span className={styles.error}>웨이크워드 오류</span>
          ) : isDetected ? (
            <span className={styles.detected}>감지됨!</span>
          ) : isListening ? (
            <span className={styles.listening}>"{wakeWord}" 대기 중...</span>
          ) : (
            <span className={styles.idle}>웨이크워드 비활성</span>
          )}
        </div>
      </div>

      {isListening && !isDetected && (
        <div className={styles.pulseContainer}>
          <div className={styles.pulse}></div>
          <div className={styles.pulse}></div>
          <div className={styles.pulse}></div>
        </div>
      )}

      {isDetected && (
        <div className={styles.detectedAnimation}>
          <div className={styles.ripple}></div>
        </div>
      )}
    </div>
  );
};