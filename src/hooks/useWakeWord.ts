/**
 * Wake Word Detection Hook
 * Provides easy integration of wake word detection in components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WakeWordDetector, WakeWordConfig } from '@/services/audio/wakeWord';

export interface UseWakeWordOptions {
  wakeWord?: string;
  threshold?: number;
  autoStart?: boolean;
  cooldownPeriod?: number;
  onDetected?: () => void;
  onError?: (error: Error) => void;
}

export interface UseWakeWordReturn {
  isListening: boolean;
  isInitialized: boolean;
  lastDetectionTime: number | null;
  error: Error | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    wakeWord = '헤이 드라이빙',
    threshold = 0.85,
    autoStart = false,
    cooldownPeriod = 2000,
    onDetected,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const detectorRef = useRef<WakeWordDetector | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize detector
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        const config: WakeWordConfig = {
          wakeWord,
          threshold,
          onDetected: handleDetection,
          onReady: () => {
            setIsInitialized(true);
            setError(null);
          },
          onError: (err) => {
            setError(err);
            if (onError) onError(err);
          },
        };

        const detector = new WakeWordDetector(config);
        await detector.initialize();
        detectorRef.current = detector;

        // Auto-start if requested
        if (autoStart) {
          await detector.startListening();
          setIsListening(true);
        }
      } catch (err) {
        const error = err as Error;
        setError(error);
        if (onError) onError(error);
      }
    };

    initializeDetector();

    // Cleanup
    return () => {
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [wakeWord, threshold]);

  /**
   * Handle wake word detection
   */
  const handleDetection = useCallback(() => {
    const now = Date.now();
    
    // Check if we're in cooldown period
    if (lastDetectionTime && now - lastDetectionTime < cooldownPeriod) {
      return;
    }

    setLastDetectionTime(now);
    
    // Notify parent component
    if (onDetected) {
      onDetected();
    }

    // Set cooldown timer
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    
    cooldownTimerRef.current = setTimeout(() => {
      // Cooldown period ended
      cooldownTimerRef.current = null;
    }, cooldownPeriod);
  }, [lastDetectionTime, cooldownPeriod, onDetected]);

  /**
   * Start listening for wake word
   */
  const start = useCallback(async () => {
    if (!detectorRef.current || !isInitialized || isListening) {
      return;
    }

    try {
      await detectorRef.current.startListening();
      setIsListening(true);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      if (onError) onError(error);
    }
  }, [isInitialized, isListening, onError]);

  /**
   * Stop listening for wake word
   */
  const stop = useCallback(() => {
    if (!detectorRef.current || !isListening) {
      return;
    }

    detectorRef.current.stopListening();
    setIsListening(false);
  }, [isListening]);

  /**
   * Reset detection state
   */
  const reset = useCallback(() => {
    setLastDetectionTime(null);
    setError(null);
    
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  return {
    isListening,
    isInitialized,
    lastDetectionTime,
    error,
    start,
    stop,
    reset,
  };
}

/**
 * Wake Word Training Hook
 * For collecting samples and training custom wake words
 */
export interface UseWakeWordTrainingReturn {
  isRecording: boolean;
  recordingProgress: number;
  samples: Array<{ audio: Float32Array; label: string }>;
  startRecording: (label: string) => void;
  stopRecording: () => void;
  clearSamples: () => void;
  trainModel: () => Promise<void>;
  saveModel: () => Promise<void>;
}

export function useWakeWordTraining(): UseWakeWordTrainingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [samples, setSamples] = useState<Array<{ audio: Float32Array; label: string }>>([]);

  const recordingLabelRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recordingDataRef = useRef<Float32Array[]>([]);

  /**
   * Start recording audio sample
   */
  const startRecording = useCallback(async (label: string) => {
    try {
      recordingLabelRef.current = label;
      recordingDataRef.current = [];
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      
      streamRef.current = stream;
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;
      
      // Create processor
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        recordingDataRef.current.push(new Float32Array(inputData));
        
        // Update progress (assume 3-second recording)
        const duration = recordingDataRef.current.length * 1024 / 16000;
        setRecordingProgress(Math.min(duration / 3, 1));
        
        // Auto-stop after 3 seconds
        if (duration >= 3) {
          stopRecording();
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;
      
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  /**
   * Stop recording and save sample
   */
  const stopRecording = useCallback(() => {
    if (!isRecording) return;
    
    // Combine audio chunks
    const totalLength = recordingDataRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of recordingDataRef.current) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Save sample
    setSamples(prev => [...prev, {
      audio: combinedAudio,
      label: recordingLabelRef.current,
    }]);
    
    // Clean up
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingProgress(0);
  }, [isRecording]);

  /**
   * Clear all samples
   */
  const clearSamples = useCallback(() => {
    setSamples([]);
  }, []);

  /**
   * Train model with collected samples
   */
  const trainModel = useCallback(async () => {
    // This would use TensorFlow.js transfer learning
    // to train a custom wake word model
    console.log('Training model with', samples.length, 'samples');
    
    // Placeholder for actual training logic
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    });
  }, [samples]);

  /**
   * Save trained model
   */
  const saveModel = useCallback(async () => {
    // Save model to IndexedDB or server
    console.log('Saving trained model');
    
    // Placeholder for actual save logic
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });
  }, []);

  return {
    isRecording,
    recordingProgress,
    samples,
    startRecording,
    stopRecording,
    clearSamples,
    trainModel,
    saveModel,
  };
}