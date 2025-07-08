'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import styles from './DrivingChatInterface.module.css';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  englishText?: string;
  koreanText?: string;
}

interface DrivingChatInterfaceProps {
  currentSentence?: {
    text: string;
    translation: string;
  };
  onCommand: (command: string) => void;
  isPlaying: boolean;
}

export const DrivingChatInterface: React.FC<DrivingChatInterfaceProps> = ({
  currentSentence,
  onCommand,
  isPlaying
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '안녕하세요! 운전 중 영어 학습을 도와드리겠습니다. 음성이나 텍스트로 명령해주세요.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Speech recognition
  const {
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
    isSupported,
    isListening
  } = useSpeechRecognition('ko-KR');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show current sentence when it changes
  useEffect(() => {
    if (currentSentence) {
      const sentenceMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '현재 문장:',
        englishText: currentSentence.text,
        koreanText: currentSentence.translation,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, sentenceMessage]);
    }
  }, [currentSentence]);

  // Process command and get response
  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let response = '';
    let commandExecuted = '';

    if (lowerText.includes('다음') || lowerText.includes('next')) {
      commandExecuted = 'next';
      response = '다음 문장으로 이동합니다.';
    } else if (lowerText.includes('이전') || lowerText.includes('previous')) {
      commandExecuted = 'previous';
      response = '이전 문장으로 돌아갑니다.';
    } else if (lowerText.includes('반복') || lowerText.includes('repeat')) {
      commandExecuted = 'repeat';
      response = '현재 문장을 다시 재생합니다.';
    } else if (lowerText.includes('일시정지') || lowerText.includes('pause')) {
      commandExecuted = 'pause';
      response = '재생을 일시정지합니다.';
    } else if (lowerText.includes('재생') || lowerText.includes('play')) {
      commandExecuted = 'play';
      response = '재생을 시작합니다.';
    } else if (lowerText.includes('도움말') || lowerText.includes('help')) {
      response = '사용 가능한 명령어: 다음, 이전, 반복, 재생, 일시정지';
    } else {
      response = '명령을 이해하지 못했습니다. "도움말"이라고 말해보세요.';
    }

    if (commandExecuted) {
      onCommand(commandExecuted);
    }

    return response;
  };

  // Handle speech recognition result
  useEffect(() => {
    if (transcript && transcript.trim()) {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Process and respond
      setIsProcessing(true);
      setTimeout(() => {
        const response = processCommand(transcript);
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
  }, [transcript, resetTranscript, onCommand]);

  // Handle text input
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: inputText.trim(),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Process and respond
      setIsProcessing(true);
      const messageText = inputText.trim();
      setInputText('');

      setTimeout(() => {
        const response = processCommand(messageText);
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
      }, 500);
    }
  };

  // Toggle voice recognition
  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Driving English</h1>
        <div className={styles.status}>
          {isPlaying ? '🎵 재생 중' : '⏸️ 일시정지'}
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.type]}`}
          >
            {message.type === 'assistant' && (
              <div className={styles.avatar}>AI</div>
            )}
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{message.content}</div>
              {message.englishText && (
                <div className={styles.sentenceBox}>
                  <div className={styles.englishText}>{message.englishText}</div>
                  <div className={styles.koreanText}>{message.koreanText}</div>
                </div>
              )}
              <div className={styles.messageTime}>
                {message.timestamp.toLocaleTimeString('ko-KR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}>AI</div>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        {isListening && interimTranscript && (
          <div className={`${styles.message} ${styles.user} ${styles.interim}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{interimTranscript}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className={styles.inputContainer} onSubmit={handleSubmit}>
        <button
          type="button"
          className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
          onClick={toggleVoice}
          disabled={!isSupported}
          aria-label={isListening ? '음성 인식 중지' : '음성 인식 시작'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isListening ? '듣는 중...' : '메시지를 입력하세요...'}
          className={styles.input}
          disabled={isProcessing || isListening}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || isProcessing || isListening}
          aria-label="메시지 전송"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
};