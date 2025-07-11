'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { useConversationContext } from '@/hooks/useConversationContext';

export interface AccessibleVoiceFeedbackConfig {
  enabled: boolean;
  isDrivingMode: boolean;
  speedLevel: 'stationary' | 'slow' | 'fast';
  voiceSettings: {
    rate: number;
    pitch: number;
    volume: number;
    voice?: string;
  };
  feedbackLevel: 'minimal' | 'standard' | 'verbose';
  emergencyMode: boolean;
}

export interface VoiceFeedbackMessage {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'navigation' | 'status' | 'error' | 'success' | 'warning' | 'emergency';
  timestamp: number;
  interruptible: boolean;
}

export function useAccessibleVoiceFeedback(config: AccessibleVoiceFeedbackConfig) {
  const [messageQueue, setMessageQueue] = useState<VoiceFeedbackMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<VoiceFeedbackMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<VoiceFeedbackMessage[]>([]);
  
  const queueTimeoutRef = useRef<NodeJS.Timeout>();
  const messageIdRef = useRef(0);
  
  const { speak, isSpeaking, cancel, getVoices } = useTTS();
  const { userPreferences, sessionState } = useConversationContext();

  // 운전 모드별 음성 설정
  const getVoiceSettings = useCallback(() => {
    const baseSettings = config.voiceSettings;
    
    switch (config.speedLevel) {
      case 'fast':
        return {
          ...baseSettings,
          rate: Math.min(baseSettings.rate * 1.3, 2.0),
          volume: Math.min(baseSettings.volume * 1.2, 1.0),
        };
      case 'slow':
        return {
          ...baseSettings,
          rate: Math.max(baseSettings.rate * 0.8, 0.5),
        };
      default:
        return baseSettings;
    }
  }, [config.voiceSettings, config.speedLevel]);

  // 피드백 레벨별 메시지 필터링
  const shouldProcessMessage = useCallback((message: VoiceFeedbackMessage) => {
    if (!config.enabled) return false;
    if (config.emergencyMode && message.category !== 'emergency') return false;
    
    switch (config.feedbackLevel) {
      case 'minimal':
        return message.priority === 'urgent' || message.category === 'emergency';
      case 'standard':
        return message.priority !== 'low' || message.category === 'emergency';
      case 'verbose':
        return true;
      default:
        return false;
    }
  }, [config.enabled, config.emergencyMode, config.feedbackLevel]);

  // 메시지 우선순위 정렬
  const sortMessagesByPriority = useCallback((messages: VoiceFeedbackMessage[]) => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    return messages.sort((a, b) => {
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return a.timestamp - b.timestamp;
    });
  }, []);

  // 메시지 추가
  const addMessage = useCallback((
    text: string,
    options: Partial<Omit<VoiceFeedbackMessage, 'id' | 'text' | 'timestamp'>> = {}
  ) => {
    const message: VoiceFeedbackMessage = {
      id: `msg_${messageIdRef.current++}`,
      text,
      priority: options.priority || 'medium',
      category: options.category || 'status',
      timestamp: Date.now(),
      interruptible: options.interruptible ?? true,
    };

    if (!shouldProcessMessage(message)) {
      return;
    }

    setMessageQueue(prev => {
      const newQueue = [...prev, message];
      return sortMessagesByPriority(newQueue);
    });
  }, [shouldProcessMessage, sortMessagesByPriority]);

  // 긴급 메시지 (즉시 실행)
  const addUrgentMessage = useCallback((text: string, category: VoiceFeedbackMessage['category'] = 'emergency') => {
    const message: VoiceFeedbackMessage = {
      id: `urgent_${messageIdRef.current++}`,
      text,
      priority: 'urgent',
      category,
      timestamp: Date.now(),
      interruptible: false,
    };

    // 현재 재생 중인 메시지가 방해 가능한 경우 중단
    if (currentMessage?.interruptible) {
      cancel();
    }

    setMessageQueue(prev => [message, ...prev]);
  }, [currentMessage, cancel]);

  // 메시지 처리
  const processNextMessage = useCallback(async () => {
    if (isProcessing || messageQueue.length === 0) {
      return;
    }

    setIsProcessing(true);
    const nextMessage = messageQueue[0];
    setCurrentMessage(nextMessage);
    setMessageQueue(prev => prev.slice(1));

    try {
      const voiceSettings = getVoiceSettings();
      
      // 카테고리별 메시지 전처리
      let processedText = nextMessage.text;
      
      if (config.isDrivingMode && config.speedLevel === 'fast') {
        // 고속 주행 중에는 간단한 메시지만
        processedText = processedText.split('.')[0]; // 첫 번째 문장만
      }

      await speak(processedText, voiceSettings);
      
      // 피드백 히스토리에 추가
      setFeedbackHistory(prev => [nextMessage, ...prev.slice(0, 49)]);
      
    } catch (error) {
      console.error('Voice feedback error:', error);
    } finally {
      setCurrentMessage(null);
      setIsProcessing(false);
    }
  }, [isProcessing, messageQueue, getVoiceSettings, config.isDrivingMode, config.speedLevel, speak]);

  // 큐 처리 루프
  useEffect(() => {
    if (messageQueue.length > 0 && !isProcessing) {
      const delay = config.speedLevel === 'fast' ? 500 : 200;
      
      queueTimeoutRef.current = setTimeout(() => {
        processNextMessage();
      }, delay);
    }

    return () => {
      if (queueTimeoutRef.current) {
        clearTimeout(queueTimeoutRef.current);
      }
    };
  }, [messageQueue, isProcessing, processNextMessage, config.speedLevel]);

  // 미리 정의된 메시지들
  const predefinedMessages = {
    // 네비게이션
    navigation: {
      start: () => addMessage('음성 안내를 시작합니다', { category: 'navigation', priority: 'medium' }),
      stop: () => addMessage('음성 안내를 중지합니다', { category: 'navigation', priority: 'medium' }),
      next: () => addMessage('다음 항목으로 이동합니다', { category: 'navigation', priority: 'low' }),
      previous: () => addMessage('이전 항목으로 이동합니다', { category: 'navigation', priority: 'low' }),
      menu: () => addMessage('메뉴를 열었습니다', { category: 'navigation', priority: 'low' }),
      back: () => addMessage('이전 화면으로 돌아갑니다', { category: 'navigation', priority: 'low' }),
    },
    
    // 상태 안내
    status: {
      loading: () => addMessage('로딩 중입니다', { category: 'status', priority: 'low' }),
      connected: () => addMessage('연결되었습니다', { category: 'status', priority: 'medium' }),
      disconnected: () => addMessage('연결이 끊어졌습니다', { category: 'status', priority: 'high' }),
      offline: () => addMessage('오프라인 모드입니다', { category: 'status', priority: 'high' }),
      online: () => addMessage('온라인 모드입니다', { category: 'status', priority: 'medium' }),
    },
    
    // 오류 메시지
    error: {
      generic: () => addMessage('오류가 발생했습니다', { category: 'error', priority: 'high' }),
      network: () => addMessage('네트워크 오류입니다', { category: 'error', priority: 'high' }),
      voice: () => addMessage('음성 인식 오류입니다', { category: 'error', priority: 'high' }),
      permission: () => addMessage('권한이 필요합니다', { category: 'error', priority: 'high' }),
    },
    
    // 성공 메시지
    success: {
      saved: () => addMessage('저장되었습니다', { category: 'success', priority: 'medium' }),
      completed: () => addMessage('완료되었습니다', { category: 'success', priority: 'medium' }),
      sent: () => addMessage('전송되었습니다', { category: 'success', priority: 'medium' }),
    },
    
    // 경고 메시지
    warning: {
      battery: () => addMessage('배터리가 부족합니다', { category: 'warning', priority: 'high' }),
      storage: () => addMessage('저장 공간이 부족합니다', { category: 'warning', priority: 'high' }),
      connection: () => addMessage('연결 상태가 불안정합니다', { category: 'warning', priority: 'high' }),
    },
    
    // 긴급 메시지
    emergency: {
      stop: () => addUrgentMessage('즉시 안전한 곳에 정차하세요', 'emergency'),
      danger: () => addUrgentMessage('위험한 상황입니다', 'emergency'),
      help: () => addUrgentMessage('도움이 필요하시면 112에 신고하세요', 'emergency'),
    },
  };

  // 메시지 큐 클리어
  const clearQueue = useCallback(() => {
    setMessageQueue([]);
    cancel();
  }, [cancel]);

  // 현재 메시지 스킵
  const skipCurrent = useCallback(() => {
    if (currentMessage?.interruptible) {
      cancel();
    }
  }, [currentMessage, cancel]);

  // 피드백 설정 업데이트
  const updateSettings = useCallback((newSettings: Partial<AccessibleVoiceFeedbackConfig>) => {
    // 설정 업데이트는 부모 컴포넌트에서 처리
    console.log('Voice feedback settings update requested:', newSettings);
  }, []);

  // 사용 가능한 음성 목록 가져오기
  const getAvailableVoices = useCallback(() => {
    return getVoices().filter(voice => 
      voice.lang.includes('ko') || voice.lang.includes('en')
    );
  }, [getVoices]);

  // 메시지 통계
  const getStatistics = useCallback(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentMessages = feedbackHistory.filter(msg => msg.timestamp > oneHourAgo);
    
    const byCategory = recentMessages.reduce((acc, msg) => {
      acc[msg.category] = (acc[msg.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: feedbackHistory.length,
      recent: recentMessages.length,
      byCategory,
      queueLength: messageQueue.length,
      isActive: isProcessing,
    };
  }, [feedbackHistory, messageQueue.length, isProcessing]);

  return {
    // 상태
    isActive: config.enabled,
    isSpeaking,
    currentMessage,
    queueLength: messageQueue.length,
    
    // 메시지 추가
    addMessage,
    addUrgentMessage,
    
    // 미리 정의된 메시지
    messages: predefinedMessages,
    
    // 제어
    clearQueue,
    skipCurrent,
    
    // 설정
    updateSettings,
    getAvailableVoices,
    
    // 통계
    getStatistics,
    
    // 히스토리
    history: feedbackHistory,
  };
}