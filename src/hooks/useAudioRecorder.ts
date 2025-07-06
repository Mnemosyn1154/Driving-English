/**
 * React Hook for Audio Recording
 * Provides easy-to-use interface for audio recording with WebSocket streaming
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioRecorder, AudioChunk } from '@/services/client/audio/recorder';
import { AudioEncoder } from '@/services/client/audio/encoder';
import { WebSocketClient, ConnectionState } from '@/services/client/websocket/client';
import { RecognitionResultMessage } from '@/types/websocket';

export interface UseAudioRecorderConfig {
  wsUrl: string;
  token: string;
  sampleRate?: number;
  format?: 'FLAC' | 'LINEAR16';
  language?: string;
  onRecognitionResult?: (result: RecognitionResultMessage) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: RecordingState) => void;
}

export type RecordingState = 
  | 'idle' 
  | 'initializing' 
  | 'ready' 
  | 'connecting'
  | 'recording' 
  | 'processing'
  | 'error';

export interface UseAudioRecorderReturn {
  state: RecordingState;
  connectionState: ConnectionState;
  isRecording: boolean;
  error: Error | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  transcript: string;
  confidence: number;
  cleanup: () => void;
}

export function useAudioRecorder(config: UseAudioRecorderConfig): UseAudioRecorderReturn {
  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const encoderRef = useRef<AudioEncoder | null>(null);
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const streamStartTimeRef = useRef<number>(0);
  const isCleaningUpRef = useRef(false);

  // Initialize components
  useEffect(() => {
    const initialize = async () => {
      if (isCleaningUpRef.current) return;

      try {
        setState('initializing');
        setError(null);

        // Check browser support
        if (!AudioRecorder.isSupported()) {
          throw new Error('Audio recording is not supported in this browser');
        }

        // Create audio recorder
        const recorder = new AudioRecorder({
          sampleRate: config.sampleRate || 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        // Create encoder
        const encoder = new AudioEncoder({
          format: config.format || 'LINEAR16',
          sampleRate: config.sampleRate || 16000,
          channels: 1,
        });

        // Create WebSocket client
        const wsClient = new WebSocketClient({
          url: config.wsUrl,
          token: config.token,
        });

        // Setup WebSocket event handlers
        wsClient.on('stateChange', (state) => {
          setConnectionState(state);
        });

        wsClient.on('recognitionResult', (result) => {
          setTranscript(result.transcript);
          setConfidence(result.confidence);
          config.onRecognitionResult?.(result);
        });

        wsClient.on('error', (error) => {
          console.error('WebSocket error:', error);
          setError(error instanceof Error ? error : new Error(String(error)));
          config.onError?.(error instanceof Error ? error : new Error(String(error)));
        });

        // Setup audio recorder event handlers
        recorder.on('audioChunk', (event) => {
          const chunk = event.data as AudioChunk;
          
          // Only process if we're recording and connected
          if (recorder.isRecording() && wsClient.getState() === 'authenticated') {
            // Encode audio data
            const encodedData = encoder.encodeToBase64(chunk.data);
            
            // Send to server
            try {
              wsClient.sendAudioChunk(encodedData, chunk.sequence);
            } catch (error) {
              console.error('Failed to send audio chunk:', error);
            }
          }
        });

        recorder.on('error', (event) => {
          const error = event.data as Error;
          console.error('Recorder error:', error);
          setError(error);
          setState('error');
          config.onError?.(error);
        });

        recorder.on('stateChange', (event) => {
          const { newState } = event.data;
          
          if (newState === 'ready') {
            setState('ready');
          } else if (newState === 'error') {
            setState('error');
          }
        });

        // Initialize recorder
        await recorder.initialize();

        // Store refs
        recorderRef.current = recorder;
        encoderRef.current = encoder;
        wsClientRef.current = wsClient;

        setState('ready');
      } catch (error) {
        console.error('Failed to initialize audio recorder:', error);
        setError(error as Error);
        setState('error');
        config.onError?.(error as Error);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      isCleaningUpRef.current = true;
      cleanup();
    };
  }, []); // Empty deps, only run once

  // Notify state changes
  useEffect(() => {
    config.onStateChange?.(state);
  }, [state, config]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const recorder = recorderRef.current;
      const wsClient = wsClientRef.current;

      if (!recorder || !wsClient) {
        throw new Error('Components not initialized');
      }

      if (state !== 'ready') {
        throw new Error(`Cannot start recording in state: ${state}`);
      }

      setState('connecting');

      // Connect to WebSocket if not connected
      if (wsClient.getState() === 'disconnected') {
        await wsClient.connect();
        
        // Wait for authentication
        await new Promise<void>((resolve, reject) => {
          const checkAuth = setInterval(() => {
            const state = wsClient.getState();
            
            if (state === 'authenticated') {
              clearInterval(checkAuth);
              resolve();
            } else if (state === 'error') {
              clearInterval(checkAuth);
              reject(new Error('WebSocket authentication failed'));
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkAuth);
            reject(new Error('WebSocket connection timeout'));
          }, 10000);
        });
      }

      // Start audio stream on server
      await wsClient.startAudioStream({
        sampleRate: config.sampleRate || 16000,
        format: config.format || 'LINEAR16',
        language: config.language || 'ko-KR',
      });

      // Start recording
      streamStartTimeRef.current = Date.now();
      recorder.start();
      
      setState('recording');
      
      // Clear previous results
      setTranscript('');
      setConfidence(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(error as Error);
      setState('error');
      config.onError?.(error as Error);
      throw error;
    }
  }, [state, config]);

  // Stop recording
  const stopRecording = useCallback(() => {
    try {
      const recorder = recorderRef.current;
      const wsClient = wsClientRef.current;

      if (!recorder || !wsClient) {
        return;
      }

      if (state !== 'recording') {
        return;
      }

      setState('processing');

      // Stop recorder
      recorder.stop();

      // End audio stream
      const duration = Date.now() - streamStartTimeRef.current;
      wsClient.endAudioStream(duration);

      setState('ready');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError(error as Error);
      setState('error');
      config.onError?.(error as Error);
    }
  }, [state, config]);

  // Cleanup function
  const cleanup = useCallback(() => {
    try {
      // Stop recording if active
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.stop();
      }

      // Cleanup recorder
      recorderRef.current?.cleanup();
      recorderRef.current = null;

      // Disconnect WebSocket
      wsClientRef.current?.disconnect();
      wsClientRef.current = null;

      // Clear encoder
      encoderRef.current = null;

      // Reset state
      setState('idle');
      setError(null);
      setTranscript('');
      setConfidence(0);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, []);

  return {
    state,
    connectionState,
    isRecording: state === 'recording',
    error,
    startRecording,
    stopRecording,
    transcript,
    confidence,
    cleanup,
  };
}