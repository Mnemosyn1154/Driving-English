'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatInterface.module.css';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = '메시지를 입력하세요...'
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.type]}`}
          >
            <div className={styles.messageContent}>
              {message.content}
            </div>
            <div className={styles.messageTime}>
              {message.timestamp.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputContainer} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || isLoading}
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