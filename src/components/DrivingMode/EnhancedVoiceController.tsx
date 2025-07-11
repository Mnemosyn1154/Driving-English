'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';
import { useVoicePWAIntegration } from '@/hooks/usePWAIntegration';
import { useConversationContext } from '@/hooks/useConversationContext';
import { useTTS } from '@/hooks/useTTS';
import styles from './EnhancedVoiceController.module.css';

interface EnhancedVoiceControllerProps {
  isDrivingMode: boolean;
  onCommand: (command: string) => void;
  onTranscript: (transcript: string) => void;
  isActive: boolean;
  speedLevel?: 'stationary' | 'slow' | 'fast';
  onToggle?: (active: boolean) => void;
}

export const EnhancedVoiceController: React.FC<EnhancedVoiceControllerProps> = ({
  isDrivingMode,
  onCommand,
  onTranscript,
  isActive,
  speedLevel = 'stationary',
  onToggle,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  
  const processingTimeoutRef = useRef<NodeJS.Timeout>();
  const feedbackTimeoutRef = useRef<NodeJS.Timeout>();
  
  const { isOnline, isOfflineReady, preloadVoiceContent } = useVoicePWAIntegration();
  
  const {
    addConversationMessage,
    addRecentCommand,
    generateContextString,
    userPreferences,
    sessionState,
  } = useConversationContext();
  
  const { speak, isSpeaking, cancel: cancelTTS } = useTTS();

  // 운전 모드 특화 음성 명령 패턴
  const drivingCommands = {
    // 뉴스 제어
    'news': ['뉴스', '뉴스 들려줘', '뉴스 시작', '뉴스 켜줘'],
    'next': ['다음', '다음 뉴스', '건너뛰기', '넘어가기'],
    'previous': ['이전', '이전 뉴스', '뒤로가기', '돌아가기'],
    'pause': ['일시정지', '정지', '멈춰', '잠깐'],
    'resume': ['재생', '계속', '다시', '시작'],
    'repeat': ['반복', '다시 들려줘', '한번 더', '다시 말해줘'],
    
    // 속도 제어
    'faster': ['빨리', '빠르게', '속도 올려', '빨리 말해'],
    'slower': ['천천히', '느리게', '속도 내려', '천천히 말해'],
    
    // 볼륨 제어
    'louder': ['크게', '볼륨 올려', '소리 크게', '더 크게'],
    'quieter': ['작게', '볼륨 내려', '소리 작게', '더 작게'],
    
    // 학습 기능
    'translate': ['번역', '번역해줘', '해석', '뜻이 뭐야'],
    'explain': ['설명', '설명해줘', '자세히', '더 자세히'],
    'simplify': ['쉽게', '간단히', '쉽게 설명', '간단히 말해'],
    
    // 운전 모드 특화
    'emergency': ['긴급', '위험', '응급', '도움'],
    'focus': ['집중', '집중 모드', '방해 금지', '조용히'],
    'summary': ['요약', '요약해줘', '간단히', '핵심만'],
    'help': ['도움', '도움말', '명령어', '어떻게'],
  };

  // 운전 상황별 피드백 메시지
  const getFeedbackMessage = (command: string, success: boolean) => {
    if (!success) {
      return speedLevel === 'fast' 
        ? '명령을 인식하지 못했습니다'
        : '죄송합니다. 명령을 다시 말씀해 주세요';
    }
    
    const messages = {
      'news': '뉴스를 시작합니다',
      'next': '다음 뉴스로 이동합니다',
      'previous': '이전 뉴스로 돌아갑니다',
      'pause': '일시정지합니다',
      'resume': '재생을 계속합니다',
      'repeat': '다시 들려드립니다',
      'emergency': '안전한 곳에 정차해주세요',
      'help': '음성 명령을 사용하실 수 있습니다',
    };
    
    return messages[command as keyof typeof messages] || '명령을 실행합니다';
  };

  // 향상된 음성 인식 시스템
  const hybridSpeech = useHybridSpeechRecognition({
    onCommand: (command: string) => {
      console.log('Voice command recognized:', command);
      
      setLastCommand(command);
      setCommandHistory(prev => [command, ...prev.slice(0, 9)]);
      
      // 컨텍스트 저장
      addConversationMessage({
        role: 'user',
        content: command,
        timestamp: Date.now(),
      });
      addRecentCommand(command);
      
      // 피드백 제공
      const feedbackMsg = getFeedbackMessage(command, true);
      setFeedbackMessage(feedbackMsg);
      
      // 운전 모드에서 간단한 피드백만 제공
      if (isDrivingMode && speedLevel !== 'fast') {
        speak(feedbackMsg, { rate: 1.2, volume: 0.8 });
      }
      
      // 명령 실행
      onCommand(command);
      
      // 피드백 메시지 자동 삭제
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedbackMessage('');
      }, 3000);
    },
    
    onTranscript: (transcript: string) => {
      console.log('Voice transcript:', transcript);
      onTranscript(transcript);
    },
    
    onError: (error) => {
      console.error('Voice recognition error:', error);
      setFeedbackMessage('음성 인식 오류가 발생했습니다');
      setIsProcessing(false);
    },
    
    onVoiceStart: () => {
      setIsListening(true);
      setVoiceLevel(0.5);
    },
    
    onVoiceEnd: () => {
      setIsListening(false);
      setVoiceLevel(0);
      setIsProcessing(true);
      
      // 처리 시간 제한
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
      }, 5000);
    },
    
    onResult: () => {
      setIsProcessing(false);
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    },
    
    // 운전 모드 특화 설정
    continuous: isDrivingMode,
    interimResults: true,
    maxAlternatives: 3,
    
    // 속도별 설정 조정
    noSpeechTimeout: speedLevel === 'fast' ? 2000 : 3000,
    maxSpeechTimeout: speedLevel === 'fast' ? 5000 : 10000,
  });

  // 웨이크워드 감지
  useEffect(() => {
    if (isDrivingMode && isActive) {
      const handleWakeWord = () => {
        setWakeWordDetected(true);
        setTimeout(() => setWakeWordDetected(false), 2000);
      };
      
      // 웨이크워드 감지 시뮬레이션 (실제로는 ML 모델에서 처리)
      const wakeWordListener = (e: KeyboardEvent) => {
        if (e.key === 'w' && e.ctrlKey) {
          handleWakeWord();
        }
      };
      
      window.addEventListener('keydown', wakeWordListener);
      return () => window.removeEventListener('keydown', wakeWordListener);
    }
  }, [isDrivingMode, isActive]);

  // 음성 데이터 프리로딩
  useEffect(() => {
    if (isDrivingMode && isOnline) {
      const commonAudioUrls = [
        '/api/tts?text=뉴스를 시작합니다',
        '/api/tts?text=다음 뉴스로 이동합니다',
        '/api/tts?text=일시정지합니다',
        '/api/tts?text=명령을 인식하지 못했습니다',
      ];
      
      preloadVoiceContent(commonAudioUrls);
    }
  }, [isDrivingMode, isOnline, preloadVoiceContent]);

  // 음성 인식 토글
  const toggleVoiceRecognition = useCallback(() => {
    if (isActive) {
      hybridSpeech.stop();
      cancelTTS();
    } else {
      hybridSpeech.start();
    }
    
    onToggle?.(!isActive);
  }, [isActive, hybridSpeech, cancelTTS, onToggle]);

  // 키보드 단축키 (개발/테스트용)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isDrivingMode && e.ctrlKey) {
        switch (e.key) {
          case 'v':
            e.preventDefault();
            toggleVoiceRecognition();
            break;
          case 'n':
            e.preventDefault();
            onCommand('next');
            break;
          case 'p':
            e.preventDefault();
            onCommand('pause');
            break;
          case 'r':
            e.preventDefault();
            onCommand('resume');
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isDrivingMode, toggleVoiceRecognition, onCommand]);

  // 정리
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  // 운전 모드가 아닌 경우 렌더링하지 않음
  if (!isDrivingMode) {
    return null;
  }

  return (
    <div className={styles.voiceController}>
      {/* 음성 상태 표시 */}
      <div className={styles.voiceStatus}>
        {wakeWordDetected && (
          <div className={styles.wakeWordIndicator}>
            👋 웨이크워드 감지됨
          </div>
        )}
        
        {isListening && (
          <div className={styles.listeningIndicator}>
            <div className={styles.voiceLevelBar}>
              <div 
                className={styles.voiceLevelFill}
                style={{ width: `${voiceLevel * 100}%` }}
              />
            </div>
            <span>음성 인식 중...</span>
          </div>
        )}
        
        {isProcessing && (
          <div className={styles.processingIndicator}>
            <div className={styles.processingSpinner} />
            <span>처리 중...</span>
          </div>
        )}
        
        {feedbackMessage && (
          <div className={styles.feedbackMessage}>
            {feedbackMessage}
          </div>
        )}
      </div>

      {/* 마지막 명령 표시 */}
      {lastCommand && (
        <div className={styles.lastCommand}>
          마지막 명령: {lastCommand}
        </div>
      )}

      {/* 연결 상태 표시 */}
      <div className={styles.connectionStatus}>
        <span className={styles.statusDot} data-status={isOnline ? 'online' : isOfflineReady ? 'offline-ready' : 'offline'}>
          {isOnline ? '🟢' : isOfflineReady ? '🟡' : '🔴'}
        </span>
        <span className={styles.statusText}>
          {isOnline ? '온라인' : isOfflineReady ? '오프라인 준비' : '오프라인'}
        </span>
      </div>

      {/* 긴급 상황 표시 */}
      {speedLevel === 'fast' && (
        <div className={styles.highSpeedWarning}>
          ⚠️ 고속 주행 중 - 안전 운전하세요
        </div>
      )}
    </div>
  );
};