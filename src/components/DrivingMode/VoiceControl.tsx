'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { ChatInterface, ChatMessage } from './ChatInterface';
import styles from './VoiceControl.module.css';

interface VoiceControlProps {
  isActive: boolean;
  onCommand: (command: string) => void;
  onTranscript: (transcript: string) => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  isActive,
  onCommand,
  onTranscript,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Use speech recognition
  const {
    transcript,
    interimTranscript,
    startListening: startSpeechRecognition,
    stopListening: stopSpeechRecognition,
    resetTranscript,
    error: speechError,
    isSupported,
    isListening: isSpeechListening
  } = useSpeechRecognition('ko-KR');

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
      setTimeout(() => {
        const response = getCommandResponse(transcript);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
      }, 500);
      
      resetTranscript();
    }
  }, [transcript, onTranscript, onCommand, resetTranscript]);

  // Handle voice level animation
  useEffect(() => {
    if (isSpeechListening) {
      const interval = setInterval(() => {
        setVoiceLevel(Math.random() * 0.8 + 0.2);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVoiceLevel(0);
    }
  }, [isSpeechListening]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(async () => {
    if (!isSupported) {
      alert('음성 인식이 지원되지 않는 브라우저입니다.');
      return;
    }

    if (isSpeechListening) {
      setStatus('processing');
      stopSpeechRecognition();
      setIsListening(false);
      setStatus('idle');
    } else {
      setStatus('listening');
      await startSpeechRecognition();
      setIsListening(true);
    }
  }, [isSpeechListening, startSpeechRecognition, stopSpeechRecognition, isSupported]);

  // Handle text message from chat
  const handleSendMessage = useCallback((message: string) => {
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
    
    // Get response
    setIsProcessing(true);
    setTimeout(() => {
      const response = getCommandResponse(message);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);
    }, 500);
  }, [onTranscript, onCommand]);

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

        {/* Voice Button */}
        <button
          className={`${styles.voiceButton} ${styles[status]}`}
          onClick={handleVoiceToggle}
          aria-label={isListening ? '음성 인식 중지' : '음성 인식 시작'}
        >
          <div className={styles.micIcon}>
            {status === 'listening' && (
              <div className={styles.pulseRing} style={{ transform: `scale(${1 + voiceLevel})` }} />
            )}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span className={styles.statusText}>
            {status === 'idle' && '탭하여 말하기'}
            {status === 'listening' && (interimTranscript || '듣는 중...')}
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
    </div>
  );
};