'use client';

import React, { useEffect, useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export interface VoiceRecorderProps {
  wsUrl: string;
  token: string;
  onTranscript?: (transcript: string, confidence: number) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  wsUrl,
  token,
  onTranscript,
  onError,
  className = '',
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  
  const {
    state,
    connectionState,
    isRecording,
    error,
    startRecording,
    stopRecording,
    transcript,
    confidence,
  } = useAudioRecorder({
    wsUrl,
    token,
    onRecognitionResult: (result) => {
      onTranscript?.(result.transcript, result.confidence);
    },
    onError,
  });

  // Check microphone permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(result.state);
        
        result.addEventListener('change', () => {
          setPermissionStatus(result.state);
        });
      } catch (error) {
        console.error('Failed to check microphone permission:', error);
      }
    };

    checkPermission();
  }, []);

  // Handle recording toggle
  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
    }
  };

  // Get button style based on state
  const getButtonStyle = () => {
    if (state === 'error' || error) return 'bg-red-500 hover:bg-red-600';
    if (isRecording) return 'bg-red-500 hover:bg-red-600 animate-pulse';
    if (state === 'initializing' || state === 'connecting') return 'bg-gray-400';
    if (state === 'ready') return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-gray-400';
  };

  // Get button text
  const getButtonText = () => {
    if (state === 'initializing') return '초기화 중...';
    if (state === 'connecting') return '연결 중...';
    if (isRecording) return '녹음 중지';
    if (state === 'ready') return '녹음 시작';
    if (state === 'error') return '오류 발생';
    return '준비 중...';
  };

  // Get status text
  const getStatusText = () => {
    if (error) return `오류: ${error.message}`;
    if (permissionStatus === 'denied') return '마이크 권한이 거부되었습니다';
    if (connectionState === 'error') return '연결 오류';
    if (connectionState === 'connecting') return '서버 연결 중...';
    if (connectionState === 'connected') return '인증 중...';
    if (connectionState === 'authenticated') return '연결됨';
    return '연결 안됨';
  };

  return (
    <div className={`flex flex-col items-center gap-4 p-6 ${className}`}>
      {/* Main Recording Button */}
      <button
        onClick={handleToggleRecording}
        disabled={state === 'initializing' || state === 'connecting' || permissionStatus === 'denied'}
        className={`
          relative w-32 h-32 rounded-full text-white font-bold text-lg
          transition-all duration-300 transform
          ${getButtonStyle()}
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-4 focus:ring-blue-300
        `}
        aria-label={getButtonText()}
      >
        <div className="flex flex-col items-center justify-center h-full">
          {/* Microphone Icon */}
          <svg
            className={`w-12 h-12 mb-2 ${isRecording ? 'animate-pulse' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">{getButtonText()}</span>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full">
            <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
          </div>
        )}
      </button>

      {/* Status Display */}
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-1">상태: {getStatusText()}</p>
        {connectionState === 'authenticated' && (
          <p className="text-xs text-green-600">준비 완료</p>
        )}
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="w-full max-w-md p-4 bg-gray-100 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">인식 결과:</h3>
          <p className="text-gray-900">{transcript}</p>
          <p className="text-xs text-gray-500 mt-1">신뢰도: {(confidence * 100).toFixed(1)}%</p>
        </div>
      )}

      {/* Permission Request */}
      {permissionStatus === 'denied' && (
        <div className="w-full max-w-md p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
          <p className="text-sm text-yellow-800">
            마이크 사용 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="w-full max-w-md p-4 bg-red-100 border border-red-400 rounded-lg">
          <p className="text-sm text-red-800">{error.message}</p>
        </div>
      )}

      {/* Visual Feedback for Recording */}
      {isRecording && (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 30}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mt-2">음성을 인식하고 있습니다...</p>
        </div>
      )}
    </div>
  );
};