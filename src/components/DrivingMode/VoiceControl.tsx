'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSTT } from '@/hooks/useSTT';
import { useTTS } from '@/hooks/useTTS';
import { useGeminiLiveAudio } from '@/hooks/useGeminiLiveAudio';
import { useConversationContext } from '@/hooks/useConversationContext';
import { useVoiceErrorHandler } from '@/hooks/useVoiceErrorHandler';
import { ChatInterface, ChatMessage } from './ChatInterface';
import { ConversationMessage } from '@/types/websocket';
import styles from './VoiceControl.module.css';

interface VoiceControlProps {
  isActive: boolean;
  onCommand: (command: string) => void;
  onTranscript: (transcript: string) => void;
  useAdvancedVoice?: boolean; // Toggle between basic and advanced voice recognition
  context?: string; // Context for AI assistant
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  isActive,
  onCommand,
  onTranscript,
  useAdvancedVoice = false,
  context,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word'>('idle');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wakeWordMode, setWakeWordMode] = useState<'ml' | 'energy' | 'hybrid'>('hybrid');
  
  // Conversation Context
  const {
    generateContextString,
    addConversationMessage,
    addRecentCommand,
    updateDrivingContext,
    drivingContext,
    userPreferences,
    sessionState,
    getContextualRecommendations,
  } = useConversationContext();

  // Error handling
  const {
    isHealthy,
    isInRecovery,
    currentError,
    handleError,
    serviceStatus,
    networkStatus,
    permissionStatus,
    audioDeviceStatus,
  } = useVoiceErrorHandler({
    enableLogging: true,
    enableUserNotification: true,
    gracefulDegradation: true,
    onError: (error) => {
      console.error('Voice error:', error);
      setStatus('idle');
      setIsProcessing(false);
    },
    onRecovery: (success) => {
      console.log('Recovery result:', success);
      if (success) {
        setStatus('idle');
      }
    },
    onFallback: (mode) => {
      console.log('Fallback mode:', mode);
      // Update UI to show fallback mode
    },
  });

  // Advanced Voice Recognition with Gemini Live Audio
  const geminiLiveAudio = useGeminiLiveAudio({
    autoStart: false,
    useLiveAPI: true,
    useHybridMode: true,
    wakeWordMode,
    onCommand: (command, transcript) => {
      console.log('Gemini command:', command, transcript);
      
      // Add to conversation context
      addConversationMessage({
        role: 'user',
        content: transcript,
        timestamp: Date.now(),
      });
      addRecentCommand(command);
      
      onCommand(command);
      onTranscript(transcript);
    },
    onError: (error) => {
      console.error('Gemini Live Audio error:', error);
      handleError({
        code: 'gemini-audio-error',
        message: error.message,
        details: error,
        severity: 'medium',
        source: 'gemini',
        recoverable: true,
      });
      setStatus('idle');
      setIsProcessing(false);
    },
  });

  // Basic STT with noise filtering (fallback)
  const {
    isListening: isSpeechListening,
    transcript,
    interimTranscript,
    audioLevel,
    error: speechError,
    startListening: startSpeechRecognition,
    stopListening: stopSpeechRecognition,
    resetTranscript,
  } = useSTT({
    provider: 'browser', // Start with browser, can switch to 'google' later
    language: 'ko-KR',
    continuous: true,
    interimResults: true,
    noiseFilter: true, // Enable noise filtering for driving
    speechContexts: [
      {
        phrases: ['다음', '이전', '반복', '일시정지', '재생', '채팅', '뉴스'],
        boost: 20,
      },
    ],
  });

  // Use TTS for voice responses
  const {
    synthesize,
    isPlaying: isSpeaking,
  } = useTTS({
    language: 'ko',
    speed: 1.1, // Slightly faster for driving
    autoPlay: true,
  });

  // Update context when provided or when context changes
  useEffect(() => {
    if (useAdvancedVoice) {
      // Generate dynamic context based on current state
      const contextType = context ? 'newsReading' : 'general';
      const dynamicContext = generateContextString(contextType);
      const fullContext = context ? `${context}\n\n${dynamicContext}` : dynamicContext;
      
      geminiLiveAudio.updateContext(fullContext);
    }
  }, [context, useAdvancedVoice, geminiLiveAudio, generateContextString, drivingContext, userPreferences]);

  // Update driving context when component is active
  useEffect(() => {
    if (isActive) {
      updateDrivingContext({
        isDriving: true,
        timeOfDay: new Date().getHours() < 12 ? 'morning' : 
                   new Date().getHours() < 17 ? 'afternoon' : 
                   new Date().getHours() < 22 ? 'evening' : 'night',
      });
    }
  }, [isActive, updateDrivingContext]);

  // Sync messages with Gemini conversation
  useEffect(() => {
    if (useAdvancedVoice && geminiLiveAudio.conversation.length > 0) {
      const chatMessages: ChatMessage[] = geminiLiveAudio.conversation.map((msg: ConversationMessage) => ({
        id: `${msg.timestamp}`,
        type: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(chatMessages);
    }
  }, [useAdvancedVoice, geminiLiveAudio.conversation]);

  // Helper function to get command response
  const getCommandResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('다음') || lowerText.includes('next')) {
      onCommand('next');
      return '다음 문장으로 이동합니다.';
    } else if (lowerText.includes('이전') || lowerText.includes('previous')) {
      onCommand('previous');
      return '이전 문장으로 돌아갑니다.';
    } else if (lowerText.includes('반복') || lowerText.includes('repeat')) {
      onCommand('repeat');
      return '현재 문장을 다시 재생합니다.';
    } else if (lowerText.includes('일시정지') || lowerText.includes('pause')) {
      onCommand('pause');
      return '재생을 일시정지합니다.';
    } else if (lowerText.includes('재생') || lowerText.includes('play')) {
      onCommand('play');
      return '재생을 시작합니다.';
    } else if (lowerText.includes('채팅') || lowerText.includes('타이핑')) {
      return '채팅 모드로 전환했습니다. 메시지를 입력해주세요.';
    }
    return '명령을 이해하지 못했습니다. 다시 말씀해주세요.';
  };

  // Handle transcript updates from speech recognition
  useEffect(() => {
    if (transcript && transcript !== '') {
      // Add to conversation context
      addConversationMessage({
        role: 'user',
        content: transcript,
        timestamp: Date.now(),
      });
      
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Process the transcript
      onTranscript(transcript);
      
      // Get response
      setIsProcessing(true);
      const response = getCommandResponse(transcript);
      
      // Add to conversation context
      addConversationMessage({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Speak the response
      await synthesize(response);
      setIsProcessing(false);
      
      resetTranscript();
    }
  }, [transcript, onTranscript, onCommand, resetTranscript, addConversationMessage]);

  // Update voice level from STT audio level or Gemini confidence
  useEffect(() => {
    if (useAdvancedVoice) {
      setVoiceLevel(geminiLiveAudio.confidence);
    } else {
      setVoiceLevel(audioLevel);
    }
  }, [audioLevel, useAdvancedVoice, geminiLiveAudio.confidence]);

  // Update status based on advanced or basic voice recognition
  useEffect(() => {
    if (useAdvancedVoice) {
      if (geminiLiveAudio.isSpeaking) {
        setStatus('speaking');
      } else if (geminiLiveAudio.wakeWordDetected) {
        setStatus('wake-word');
      } else if (geminiLiveAudio.isProcessing) {
        setStatus('processing');
      } else if (geminiLiveAudio.isListening) {
        setStatus('listening');
      } else {
        setStatus('idle');
      }
    } else {
      // Basic STT status
      if (isSpeaking) {
        setStatus('speaking');
      } else if (isSpeechListening) {
        setStatus('listening');
      } else if (isProcessing) {
        setStatus('processing');
      } else {
        setStatus('idle');
      }
    }
  }, [
    useAdvancedVoice,
    geminiLiveAudio.isSpeaking,
    geminiLiveAudio.wakeWordDetected,
    geminiLiveAudio.isProcessing,
    geminiLiveAudio.isListening,
    isSpeaking,
    isSpeechListening,
    isProcessing,
  ]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(async () => {
    try {
      if (useAdvancedVoice) {
        // Advanced mode: toggle Gemini Live Audio
        if (geminiLiveAudio.isListening) {
          geminiLiveAudio.stopListening();
          setIsListening(false);
        } else {
          await geminiLiveAudio.startListening();
          setIsListening(true);
        }
      } else {
        // Basic mode: toggle STT
        if (isSpeechListening) {
          stopSpeechRecognition();
          setIsListening(false);
        } else {
          await startSpeechRecognition();
          setIsListening(true);
        }
      }
    } catch (err) {
      console.error('Voice toggle error:', err);
      
      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          handleError({
            code: 'permission-denied',
            message: '마이크 권한이 거부되었습니다',
            details: err,
            severity: 'high',
            source: 'permission',
            recoverable: true,
          });
        } else if (err.name === 'NotFoundError') {
          handleError({
            code: 'audio-device-not-found',
            message: '마이크 장치를 찾을 수 없습니다',
            details: err,
            severity: 'high',
            source: 'audio',
            recoverable: true,
          });
        } else if (err.name === 'NetworkError') {
          handleError({
            code: 'network-error',
            message: '네트워크 연결 오류',
            details: err,
            severity: 'medium',
            source: 'network',
            recoverable: true,
          });
        } else {
          handleError({
            code: 'voice-toggle-error',
            message: err.message,
            details: err,
            severity: 'medium',
            source: 'audio',
            recoverable: true,
          });
        }
      }
    }
  }, [
    useAdvancedVoice,
    geminiLiveAudio.isListening,
    geminiLiveAudio.startListening,
    geminiLiveAudio.stopListening,
    isSpeechListening,
    startSpeechRecognition,
    stopSpeechRecognition,
    handleError,
  ]);

  // Handle text message from chat
  const handleSendMessage = useCallback(async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Process the message
    onTranscript(message);
    
    if (useAdvancedVoice) {
      // Advanced mode: send to Gemini Live Audio
      setIsProcessing(true);
      try {
        await geminiLiveAudio.sendText(message);
      } catch (error) {
        console.error('Failed to send message to Gemini:', error);
        setIsProcessing(false);
      }
    } else {
      // Basic mode: use local command processing
      setIsProcessing(true);
      const response = getCommandResponse(message);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Speak the response
      await synthesize(response);
      setIsProcessing(false);
    }
  }, [useAdvancedVoice, onTranscript, onCommand, geminiLiveAudio.sendText, getCommandResponse, synthesize]);

  // Auto-stop listening after 10 seconds
  useEffect(() => {
    if (isSpeechListening) {
      const timeout = setTimeout(() => {
        handleVoiceToggle();
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isSpeechListening, handleVoiceToggle]);

  if (!isActive) return null;

  return (
    <div className={styles.container}>
      {/* Chat Interface */}
      {showChat && (
        <div className={styles.chatContainer}>
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isProcessing}
            placeholder="명령을 입력하세요 (예: 다음, 이전, 재생)"
          />
        </div>
      )}

      {/* Control Buttons */}
      <div className={styles.controlButtons}>
        {/* Chat Toggle Button */}
        <button
          className={styles.chatToggleButton}
          onClick={() => setShowChat(!showChat)}
          aria-label={showChat ? '채팅 닫기' : '채팅 열기'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>

        {/* Advanced Voice Mode Toggle (when available) */}
        {useAdvancedVoice && (
          <button
            className={styles.settingsButton}
            onClick={() => {
              const nextMode = wakeWordMode === 'hybrid' ? 'ml' : 
                              wakeWordMode === 'ml' ? 'energy' : 'hybrid';
              setWakeWordMode(nextMode);
              geminiLiveAudio.setWakeWordMode(nextMode);
            }}
            aria-label={`웨이크워드 모드: ${wakeWordMode}`}
            title={`현재 모드: ${wakeWordMode}\n클릭하여 변경`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span className={styles.modeLabel}>{wakeWordMode}</span>
          </button>
        )}

        {/* Voice Button */}
        <button
          className={`${styles.voiceButton} ${styles[status === 'wake-word' ? 'wakeWord' : status]}`}
          onClick={handleVoiceToggle}
          aria-label={isListening ? '음성 인식 중지' : '음성 인식 시작'}
          disabled={isSpeaking} // Disable while speaking
        >
          <div className={styles.micIcon}>
            {status === 'listening' && (
              <div className={styles.pulseRing} style={{ transform: `scale(${1 + voiceLevel * 2})` }} />
            )}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span className={styles.statusText}>
            {status === 'idle' && '탭하여 말하기'}
            {status === 'wake-word' && '웨이크워드 감지됨'}
            {status === 'listening' && (
              useAdvancedVoice 
                ? geminiLiveAudio.transcript || '듣는 중...'
                : interimTranscript || '듣는 중...'
            )}
            {status === 'processing' && '처리 중...'}
            {status === 'speaking' && '응답 중...'}
          </span>
        </button>
      </div>

      {/* Voice Level Indicator */}
      {isSpeechListening && (
        <div className={styles.voiceLevelIndicator}>
          <div 
            className={styles.voiceLevelBar} 
            style={{ width: `${voiceLevel * 100}%` }}
          />
        </div>
      )}

      {/* System Status Indicator */}
      {!isHealthy && (
        <div className={styles.systemStatus}>
          <div className={`${styles.statusIndicator} ${styles.error}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>
              {isInRecovery ? '복구 중...' : 
               currentError ? `오류: ${currentError.message}` : 
               '시스템 상태 확인 중'}
            </span>
          </div>
          {/* Service Status */}
          <div className={styles.serviceStatus}>
            <span className={`${styles.serviceItem} ${styles[serviceStatus.stt]}`}>
              STT: {serviceStatus.stt}
            </span>
            <span className={`${styles.serviceItem} ${styles[serviceStatus.gemini]}`}>
              AI: {serviceStatus.gemini}
            </span>
            <span className={`${styles.serviceItem} ${styles[serviceStatus.wakeWord]}`}>
              감지: {serviceStatus.wakeWord}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};