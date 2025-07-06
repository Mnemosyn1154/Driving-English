'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWebSocket } from '@/hooks/useWebSocket';
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
  
  const { startRecording, stopRecording, audioLevel } = useAudioRecorder();
  const { sendAudioData, lastTranscript } = useWebSocket();

  // Voice level indicator
  useEffect(() => {
    if (isListening && audioLevel) {
      setVoiceLevel(audioLevel);
    } else {
      setVoiceLevel(0);
    }
  }, [isListening, audioLevel]);

  // Handle transcripts
  useEffect(() => {
    if (lastTranscript) {
      onTranscript(lastTranscript);
      // Check for commands
      const lowerTranscript = lastTranscript.toLowerCase();
      if (lowerTranscript.includes('다음') || lowerTranscript.includes('next')) {
        onCommand('next');
      } else if (lowerTranscript.includes('이전') || lowerTranscript.includes('previous')) {
        onCommand('previous');
      } else if (lowerTranscript.includes('반복') || lowerTranscript.includes('repeat')) {
        onCommand('repeat');
      } else if (lowerTranscript.includes('일시정지') || lowerTranscript.includes('pause')) {
        onCommand('pause');
      } else if (lowerTranscript.includes('재생') || lowerTranscript.includes('play')) {
        onCommand('play');
      }
    }
  }, [lastTranscript, onTranscript, onCommand]);

  const handleVoiceToggle = useCallback(async () => {
    if (isListening) {
      setStatus('processing');
      await stopRecording();
      setIsListening(false);
      setStatus('idle');
    } else {
      setStatus('listening');
      await startRecording((audioData) => {
        sendAudioData(audioData);
      });
      setIsListening(true);
    }
  }, [isListening, startRecording, stopRecording, sendAudioData]);

  // Auto-stop listening after 10 seconds
  useEffect(() => {
    if (isListening) {
      const timeout = setTimeout(() => {
        handleVoiceToggle();
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isListening, handleVoiceToggle]);

  if (!isActive) return null;

  return (
    <div className={styles.container}>
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
          {status === 'listening' && '듣는 중...'}
          {status === 'processing' && '처리 중...'}
          {status === 'speaking' && '응답 중...'}
        </span>
      </button>

      {isListening && (
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