/**
 * Enhanced Speech-to-Text Hook
 * Integrates multiple STT providers with audio processing
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { sttService } from '@/services/stt/sttService';
import { AudioProcessor } from '@/services/audio/audioProcessor';
import { DrivingNoiseFilter } from '@/services/audio/noiseFilter';
import {
  STTResult,
  STTStream,
  STTProvider,
  StreamingSTTConfig,
} from '@/types/stt';

export interface UseSTTOptions {
  provider?: STTProvider;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoStart?: boolean;
  noiseFilter?: boolean;
  onResult?: (result: STTResult) => void;
  onError?: (error: Error) => void;
  speechContexts?: Array<{
    phrases: string[];
    boost?: number;
  }>;
}

export interface UseSTTReturn {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: Error | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  resetTranscript: () => void;
  switchProvider: (provider: STTProvider) => Promise<void>;
  currentProvider: STTProvider;
  audioLevel: number;
}

export function useSTT(options: UseSTTOptions = {}): UseSTTReturn {
  const {
    provider = 'browser',
    language = 'ko-KR',
    continuous = true,
    interimResults = true,
    autoStart = false,
    noiseFilter = true,
    onResult,
    onError,
    speechContexts,
  } = options;

  // State management
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [currentProvider, setCurrentProvider] = useState<STTProvider>(provider);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for persistent values
  const streamRef = useRef<STTStream | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const audioAnalyzerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunkerRef = useRef<any>(null);

  // Initialize STT service
  useEffect(() => {
    const initializeService = async () => {
      try {
        await sttService.initialize({ provider: currentProvider });
      } catch (err) {
        console.error('Failed to initialize STT service:', err);
        setError(err as Error);
      }
    };

    initializeService();
  }, [currentProvider]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isListening) {
      startListening();
    }
  }, [autoStart]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (audioProcessorRef.current) {
        audioProcessorRef.current.destroy();
      }
    };
  }, []);

  /**
   * Start listening
   */
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsProcessing(true);

      // Initialize audio processor
      if (!audioProcessorRef.current) {
        audioProcessorRef.current = new AudioProcessor({
          sampleRate: 48000,
          noiseSuppressionLevel: noiseFilter ? 0.8 : 0,
        });
        await audioProcessorRef.current.initialize();
      }

      // Create voice stream with noise filtering
      const stream = await audioProcessorRef.current.createVoiceStream();
      mediaStreamRef.current = stream;

      // Create audio analyzer for level monitoring
      audioAnalyzerRef.current = audioProcessorRef.current.createAudioAnalyzer(stream);
      
      // Start audio level monitoring
      const monitorAudioLevel = () => {
        if (audioAnalyzerRef.current && isListening) {
          const level = audioAnalyzerRef.current.getLevel();
          setAudioLevel(level);
          requestAnimationFrame(monitorAudioLevel);
        }
      };
      monitorAudioLevel();

      // Configure STT stream
      const config: StreamingSTTConfig = {
        language,
        enableInterimResults: interimResults,
        enablePunctuation: true,
        speechContexts,
        onInterimResult: (result: STTResult) => {
          setInterimTranscript(result.transcript);
          setConfidence(result.confidence);
          if (onResult) onResult(result);
        },
        onFinalResult: (result: STTResult) => {
          setTranscript(prev => {
            const newTranscript = prev ? `${prev} ${result.transcript}` : result.transcript;
            return newTranscript;
          });
          setInterimTranscript('');
          setConfidence(result.confidence);
          if (onResult) onResult(result);
        },
        onError: (err: Error) => {
          setError(err);
          if (onError) onError(err);
        },
        onEnd: () => {
          setIsListening(false);
          setIsProcessing(false);
        },
      };

      // Create STT stream
      const sttStream = sttService.getService().createStream(config);
      streamRef.current = sttStream;

      // For providers that support audio chunks (Google, Gemini)
      if (currentProvider !== 'browser') {
        chunkerRef.current = audioProcessorRef.current.createAudioChunker(
          stream,
          100, // 100ms chunks
          (chunk, timestamp) => {
            if (streamRef.current) {
              streamRef.current.write({
                data: chunk,
                timestamp,
              });
            }
          }
        );
      } else {
        // Browser STT starts automatically with stream
        streamRef.current.write({ data: new ArrayBuffer(0), timestamp: Date.now() });
      }

      setIsListening(true);
      setIsProcessing(false);
    } catch (err) {
      console.error('Failed to start listening:', err);
      setError(err as Error);
      setIsProcessing(false);
      if (onError) onError(err as Error);
    }
  }, [currentProvider, language, interimResults, noiseFilter, speechContexts, onResult, onError]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.end();
      streamRef.current = null;
    }

    if (chunkerRef.current) {
      chunkerRef.current.stop();
      chunkerRef.current = null;
    }

    if (audioAnalyzerRef.current) {
      audioAnalyzerRef.current.disconnect();
      audioAnalyzerRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsProcessing(false);
    setAudioLevel(0);
  }, []);

  /**
   * Pause listening
   */
  const pauseListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.pause();
    }
  }, []);

  /**
   * Resume listening
   */
  const resumeListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.resume();
    }
  }, []);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
  }, []);

  /**
   * Switch STT provider
   */
  const switchProvider = useCallback(async (newProvider: STTProvider) => {
    const wasListening = isListening;
    
    if (wasListening) {
      stopListening();
    }

    try {
      await sttService.switchProvider(newProvider);
      setCurrentProvider(newProvider);
      
      if (wasListening) {
        // Wait a bit before restarting
        setTimeout(() => startListening(), 500);
      }
    } catch (err) {
      setError(err as Error);
      if (onError) onError(err as Error);
    }
  }, [isListening, stopListening, startListening, onError]);

  return {
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    confidence,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
    switchProvider,
    currentProvider,
    audioLevel,
  };
}