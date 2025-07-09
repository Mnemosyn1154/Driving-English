'use client';

import React, { useState } from 'react';
import { useWakeWord } from '@/hooks/useWakeWord';
import styles from './page.module.css';

export default function TestWakeWordPage() {
  const [detectionLog, setDetectionLog] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(0.7);
  
  const {
    isListening,
    isInitialized,
    lastDetectionTime,
    error,
    start,
    stop,
    reset,
  } = useWakeWord({
    wakeWord: '헤이 드라이빙',
    threshold,
    autoStart: false,
    onDetected: () => {
      const timestamp = new Date().toLocaleTimeString('ko-KR');
      setDetectionLog(prev => [`${timestamp} - 웨이크워드 감지됨!`, ...prev].slice(0, 10));
    },
    onError: (err) => {
      const timestamp = new Date().toLocaleTimeString('ko-KR');
      setDetectionLog(prev => [`${timestamp} - 오류: ${err.message}`, ...prev].slice(0, 10));
    },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>웨이크워드 테스트</h1>
        <p>마이크 권한을 허용하고 "헤이 드라이빙"이라고 말해보세요</p>
      </div>

      <div className={styles.status}>
        <div className={styles.statusItem}>
          <span>상태:</span>
          <span className={isListening ? styles.active : styles.inactive}>
            {isListening ? '듣는 중...' : '대기 중'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span>초기화:</span>
          <span className={isInitialized ? styles.success : styles.pending}>
            {isInitialized ? '완료' : '대기 중'}
          </span>
        </div>
        {error && (
          <div className={styles.statusItem}>
            <span>오류:</span>
            <span className={styles.error}>{error.message}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          onClick={() => isListening ? stop() : start()}
          disabled={!isInitialized}
          className={`${styles.button} ${isListening ? styles.stopButton : styles.startButton}`}
        >
          {isListening ? '중지' : '시작'}
        </button>
        <button
          onClick={reset}
          className={styles.button}
        >
          리셋
        </button>
      </div>

      <div className={styles.settings}>
        <label>
          감지 민감도: {threshold}
          <input
            type="range"
            min="0.5"
            max="0.9"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            disabled={isListening}
          />
        </label>
      </div>

      <div className={styles.log}>
        <h3>감지 로그</h3>
        <div className={styles.logContent}>
          {detectionLog.length === 0 ? (
            <p className={styles.emptyLog}>아직 감지된 내역이 없습니다</p>
          ) : (
            detectionLog.map((entry, index) => (
              <div key={index} className={styles.logEntry}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.instructions}>
        <h3>테스트 방법</h3>
        <ol>
          <li>시작 버튼을 클릭하여 웨이크워드 감지를 시작합니다</li>
          <li>마이크 권한을 허용합니다</li>
          <li>"헤이 드라이빙"이라고 명확하게 말합니다</li>
          <li>감지되면 로그에 기록됩니다</li>
          <li>민감도를 조절하여 최적의 설정을 찾습니다</li>
        </ol>
        
        <h3>디버깅 팁</h3>
        <ul>
          <li>조용한 환경에서 테스트하세요</li>
          <li>마이크와 적당한 거리(30-50cm)를 유지하세요</li>
          <li>너무 크거나 작지 않게 평상시 대화 톤으로 말하세요</li>
          <li>브라우저 콘솔을 열어 상세 로그를 확인하세요</li>
        </ul>
      </div>
    </div>
  );
}