'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { useVoicePWAIntegration } from '@/hooks/usePWAIntegration';
import { PWAVoiceStatus } from '@/components/PWAVoiceStatus';
import styles from './DrivingModeLayout.module.css';

interface DrivingModeLayoutProps {
  children: ReactNode;
  isDrivingMode: boolean;
  isVoiceActive?: boolean;
  onVoiceToggle?: (active: boolean) => void;
  speedLevel?: 'stationary' | 'slow' | 'fast'; // 속도에 따른 UI 조정
}

export const DrivingModeLayout: React.FC<DrivingModeLayoutProps> = ({
  children,
  isDrivingMode,
  isVoiceActive = false,
  onVoiceToggle,
  speedLevel = 'stationary',
}) => {
  const [isNightMode, setIsNightMode] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  const { isOnline, isOfflineReady } = useVoicePWAIntegration();

  // 자동 다크/라이트 모드 전환 (시간 기반)
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      setIsNightMode(hour >= 19 || hour <= 7);
    };
    
    updateTheme();
    const interval = setInterval(updateTheme, 60000); // 1분마다 확인
    
    return () => clearInterval(interval);
  }, []);

  // 속도에 따른 UI 자동 조정
  useEffect(() => {
    if (speedLevel === 'fast') {
      setShowControls(false);
      const timer = setTimeout(() => setShowControls(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowControls(true);
    }
  }, [speedLevel]);

  // 긴급 상황 시뮬레이션 (개발용)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F9' && isDrivingMode) {
        setEmergencyMode(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isDrivingMode]);

  const getLayoutClass = () => {
    let className = styles.container;
    
    if (isDrivingMode) {
      className += ` ${styles.drivingMode}`;
      
      if (isNightMode) {
        className += ` ${styles.nightMode}`;
      }
      
      if (emergencyMode) {
        className += ` ${styles.emergencyMode}`;
      }
      
      if (speedLevel === 'fast') {
        className += ` ${styles.highSpeedMode}`;
      }
    }
    
    return className;
  };

  return (
    <div className={getLayoutClass()}>
      {/* 운전 모드 상태 표시 */}
      {isDrivingMode && (
        <div className={styles.statusBar}>
          <div className={styles.statusLeft}>
            <span className={styles.drivingIndicator}>
              {emergencyMode ? '🚨 긴급' : '🚗 운전 모드'}
            </span>
            <span className={styles.speedIndicator}>
              {speedLevel === 'fast' ? '고속' : speedLevel === 'slow' ? '저속' : '정차'}
            </span>
          </div>
          
          <div className={styles.statusRight}>
            <span className={styles.networkStatus}>
              {isOnline ? '🟢' : isOfflineReady ? '🟡' : '🔴'}
            </span>
            <span className={styles.voiceStatus}>
              {isVoiceActive ? '🎤 음성 활성' : '🎤 음성 대기'}
            </span>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className={styles.content}>
        {children}
      </div>

      {/* 음성 제어 토글 버튼 (운전 모드에서만) */}
      {isDrivingMode && showControls && onVoiceToggle && (
        <div className={styles.voiceToggle}>
          <button
            className={`${styles.voiceButton} ${isVoiceActive ? styles.active : ''}`}
            onClick={() => onVoiceToggle(!isVoiceActive)}
            aria-label={isVoiceActive ? '음성 인식 중지' : '음성 인식 시작'}
          >
            <span className={styles.buttonIcon}>
              {isVoiceActive ? '🎤' : '🎙️'}
            </span>
            <span className={styles.buttonText}>
              {isVoiceActive ? '음성 활성' : '음성 시작'}
            </span>
          </button>
        </div>
      )}

      {/* 긴급 상황 알림 */}
      {emergencyMode && (
        <div className={styles.emergencyOverlay}>
          <div className={styles.emergencyContent}>
            <div className={styles.emergencyIcon}>🚨</div>
            <div className={styles.emergencyText}>
              <h2>긴급 모드</h2>
              <p>안전한 곳에 정차 후 이용해주세요</p>
            </div>
            <button
              className={styles.emergencyButton}
              onClick={() => setEmergencyMode(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* PWA 음성 상태 (운전 모드에서는 최소화) */}
      {isDrivingMode && (
        <PWAVoiceStatus className={styles.minimizedStatus} />
      )}
    </div>
  );
};