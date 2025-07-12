'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLearnCore } from './hooks/useLearnCore';
import { useInputHandler } from './hooks/useInputHandler';
import styles from './LearnInterface.module.css';

export function LearnInterface() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Core learning logic
  const {
    article,
    currentIndex,
    isLoading,
    error,
    messages,
    isPlaying,
    isAutoPlay,
    goToNext,
    goToPrevious,
    repeat,
    togglePlayPause,
    addMessage,
    getCurrentSentence,
    totalSentences,
  } = useLearnCore();
  
  // Handle commands
  const handleCommand = useCallback((command: string, source: 'voice' | 'text') => {
    console.log(`[LearnInterface] Command from ${source}:`, command);
    
    switch (command) {
      case 'next':
        goToNext();
        break;
      case 'previous':
      case 'prev':
        goToPrevious();
        break;
      case 'repeat':
        repeat();
        break;
      case 'play':
      case 'pause':
        togglePlayPause();
        break;
      case 'exit':
        addMessage('system', '학습을 종료합니다.');
        setTimeout(() => router.push('/dashboard'), 1000);
        break;
      default:
        console.log('[LearnInterface] Unknown command:', command);
        // Don't show message for unknown commands
    }
  }, [goToNext, goToPrevious, repeat, togglePlayPause, addMessage, router]);
  
  // Input handling
  const {
    inputMode,
    textInput,
    isVoiceEnabled,
    isRecording,
    voiceStatus,
    setTextInput,
    handleTextSubmit,
    toggleVoiceRecognition,
    switchInputMode,
  } = useInputHandler({
    onCommand: handleCommand,
    addMessage,
  });
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowRight':
          handleCommand('next', 'text');
          break;
        case 'ArrowLeft':
          handleCommand('previous', 'text');
          break;
        case ' ':
          e.preventDefault();
          handleCommand(isPlaying ? 'pause' : 'play', 'text');
          break;
        case 'Escape':
          handleCommand('exit', 'text');
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, handleCommand]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>기사를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !article) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error || '기사를 불러올 수 없습니다.'}</p>
          <button onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  
  const currentSentence = getCurrentSentence();
  
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.articleInfo}>
          <h2>{article.title}</h2>
          <span className={styles.progress}>
            {currentIndex + 1} / {totalSentences}
          </span>
        </div>
        <button
          className={styles.exitButton}
          onClick={() => router.push('/dashboard')}
          aria-label="학습 종료"
        >
          ✕
        </button>
      </div>
      
      {/* Chat Messages */}
      <div className={styles.chatContainer} ref={chatContainerRef}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.type]}`}
          >
            {message.type === 'system' && (
              <span className={styles.messageLabel}>[시스템]</span>
            )}
            {message.type === 'user' && (
              <span className={styles.messageLabel}>[나]</span>
            )}
            {message.type === 'sentence' && (
              <span className={styles.messageLabel}>
                [영어] {message.metadata?.isPlaying && '🔊'}
              </span>
            )}
            {message.type === 'translation' && (
              <span className={styles.messageLabel}>[번역]</span>
            )}
            {message.type === 'command' && (
              <span className={styles.messageLabel}>[명령]</span>
            )}
            <div className={styles.messageContent}>{message.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className={styles.inputArea}>
        <form onSubmit={handleTextSubmit} className={styles.inputForm}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              inputMode === 'voice' 
                ? '음성 명령 모드 (텍스트 입력도 가능)'
                : '명령어를 입력하세요... (다음, 이전, 다시, 일시정지)'
            }
            className={styles.textInput}
          />
          <button type="submit" className={styles.sendButton}>
            전송
          </button>
          {isVoiceEnabled && (
            <button
              type="button"
              onClick={toggleVoiceRecognition}
              className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
              aria-label={isRecording ? '음성 인식 중지' : '음성 인식 시작'}
            >
              🎤
            </button>
          )}
        </form>
        
        {/* Input Mode Selector */}
        <div className={styles.modeSelector}>
          <button
            onClick={() => switchInputMode('text')}
            className={inputMode === 'text' ? styles.active : ''}
          >
            텍스트
          </button>
          <button
            onClick={() => switchInputMode('hybrid')}
            className={inputMode === 'hybrid' ? styles.active : ''}
          >
            하이브리드
          </button>
          {isVoiceEnabled && (
            <button
              onClick={() => switchInputMode('voice')}
              className={inputMode === 'voice' ? styles.active : ''}
            >
              음성
            </button>
          )}
        </div>
        
        {/* Voice Status */}
        {isRecording && (
          <div className={styles.voiceStatus}>
            <span className={styles.recordingIndicator}>●</span>
            음성 인식 중... ({voiceStatus})
          </div>
        )}
      </div>
      
      {/* Quick Controls */}
      <div className={styles.quickControls}>
        <button onClick={goToPrevious} disabled={currentIndex === 0}>
          ⏮ 이전
        </button>
        <button onClick={togglePlayPause}>
          {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
        </button>
        <button onClick={goToNext} disabled={currentIndex === totalSentences - 1}>
          다음 ⏭
        </button>
        <button onClick={repeat}>
          🔁 다시
        </button>
      </div>
    </div>
  );
}