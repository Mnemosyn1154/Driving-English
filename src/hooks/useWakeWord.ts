'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WakeWordDetector, WakeWordConfig, WakeWordEvent } from '@/services/client/wakeword/detector';

interface UseWakeWordOptions {
  wakeWords?: string[];
  language?: string;
  autoStart?: boolean;
  onDetected?: (event: WakeWordEvent) => void;
  onError?: (error: Error) => void;
}

interface UseWakeWordReturn {
  isListening: boolean;
  isSupported: boolean;
  lastDetection: {
    wakeWord: string;
    confidence: number;
    timestamp: number;
  } | null;
  start: () => Promise<void>;
  stop: () => void;
  updateWakeWords: (wakeWords: string[]) => void;
  error: Error | null;
}

const DEFAULT_WAKE_WORDS = ['헤이 드라이빙', 'hey driving', '드라이빙', 'driving'];

export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    wakeWords = DEFAULT_WAKE_WORDS,
    language = 'ko-KR',
    autoStart = false,
    onDetected,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastDetection, setLastDetection] = useState<UseWakeWordReturn['lastDetection']>(null);
  const [error, setError] = useState<Error | null>(null);

  const detectorRef = useRef<WakeWordDetector | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize detector
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Check support
    const supported = WakeWordDetector.isSupported();
    setIsSupported(supported);

    if (!supported) {
      const err = new Error('Wake word detection is not supported in this browser');
      setError(err);
      onError?.(err);
      return;
    }

    // Create detector
    const config: WakeWordConfig = {
      wakeWords,
      language,
      continuous: true,
      interimResults: true,
      sensitivity: 0.7,
    };

    const detector = new WakeWordDetector(config);

    // Set up event handlers
    detector.on('detected', (event) => {
      const detection = {
        wakeWord: event.data.wakeWord,
        confidence: event.data.confidence,
        timestamp: Date.now(),
      };
      
      setLastDetection(detection);
      onDetected?.(event);
      
      // Vibrate on detection (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    });

    detector.on('listening', () => {
      setIsListening(true);
    });

    detector.on('stopped', () => {
      setIsListening(false);
    });

    detector.on('error', (event) => {
      const err = new Error(event.data.error || 'Wake word detection error');
      setError(err);
      onError?.(err);
    });

    detectorRef.current = detector;

    // Auto-start if requested
    if (autoStart) {
      detector.start().catch((err) => {
        setError(err);
        onError?.(err);
      });
    }

    // Cleanup
    return () => {
      detector.stop();
      detectorRef.current = null;
    };
  }, []); // Empty deps, only run once

  // Start listening
  const start = useCallback(async () => {
    if (!detectorRef.current) {
      throw new Error('Wake word detector not initialized');
    }

    try {
      setError(null);
      await detectorRef.current.start();
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      throw error;
    }
  }, [onError]);

  // Stop listening
  const stop = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.stop();
    }
  }, []);

  // Update wake words
  const updateWakeWords = useCallback((newWakeWords: string[]) => {
    if (detectorRef.current) {
      detectorRef.current.updateConfig({ wakeWords: newWakeWords });
    }
  }, []);

  return {
    isListening,
    isSupported,
    lastDetection,
    start,
    stop,
    updateWakeWords,
    error,
  };
}