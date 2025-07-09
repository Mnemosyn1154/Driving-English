'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type ProcessingStatus = 
  | 'idle' 
  | 'recording' 
  | 'processing_stt' 
  | 'processing_gemini' 
  | 'success' 
  | 'error';

export interface CommandResult {
  type: 'command';
  payload: string;
  transcript: string;
  confidence: number;
}

export interface FallbackResult {
  type: 'fallback';
  transcript?: string;
  reason: string;
}

export interface GeminiResult {
  transcription: string;
  intent: string;
  confidence: number;
  response?: string;
  context?: Record<string, any>;
}

export interface UseHybridSpeechRecognitionOptions {
  onCommand?: (command: string, transcript: string) => void;
  onGeminiResponse?: (result: GeminiResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: ProcessingStatus) => void;
  silenceThreshold?: number; // milliseconds
  audioFormat?: string;
}

export interface UseHybridSpeechRecognitionReturn {
  isRecording: boolean;
  status: ProcessingStatus;
  lastTranscript: string | null;
  lastIntent: string | null;
  lastError: Error | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearError: () => void;
}

export function useHybridSpeechRecognition(
  options: UseHybridSpeechRecognitionOptions = {}
): UseHybridSpeechRecognitionReturn {
  const {
    onCommand,
    onGeminiResponse,
    onError,
    onStatusChange,
    silenceThreshold = 2000,
    audioFormat = 'audio/webm;codecs=opus',
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<string | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Update status and notify
  const updateStatus = useCallback((newStatus: ProcessingStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Handle error
  const handleError = useCallback((error: Error) => {
    console.error('Hybrid speech recognition error:', error);
    setLastError(error);
    updateStatus('error');
    onError?.(error);
  }, [onError, updateStatus]);

  // Detect silence
  const detectSilence = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    
    // If volume is below threshold, start/continue silence timer
    if (average < 5) { // Adjust threshold as needed
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('Silence detected, stopping recording');
          stopRecording();
        }, silenceThreshold);
      }
    } else {
      // Reset silence timer if sound detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }

    // Continue monitoring
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(detectSilence);
    }
  }, [isRecording, silenceThreshold]);

  // Process audio with STT first, then Gemini if needed
  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      // 1. Try STT first
      updateStatus('processing_stt');
      const sttResponse = await fetch('/api/stt-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (!sttResponse.ok) {
        const errorData = await sttResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('STT API Error:', errorData);
        throw new Error(`STT failed: ${errorData.error || sttResponse.statusText}`);
      }

      const sttResult = await sttResponse.json() as CommandResult | FallbackResult;

      if (sttResult.type === 'command') {
        // Success - execute command
        setLastTranscript(sttResult.transcript);
        setLastIntent(sttResult.payload);
        updateStatus('success');
        onCommand?.(sttResult.payload, sttResult.transcript);
        return;
      }

      // 2. Fallback to Gemini
      console.log('STT fallback, using Gemini:', sttResult.reason);
      updateStatus('processing_gemini');

      const geminiResponse = await fetch('/api/gemini-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audio: base64Audio,
          context: {
            previousTranscripts: [lastTranscript].filter(Boolean),
          }
        }),
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini processing failed: ${geminiResponse.statusText}`);
      }

      const geminiResult = await geminiResponse.json() as GeminiResult;
      
      setLastTranscript(geminiResult.transcription);
      setLastIntent(geminiResult.intent);
      updateStatus('success');
      onGeminiResponse?.(geminiResult);

    } catch (error) {
      handleError(error as Error);
    }
  }, [lastTranscript, updateStatus, onCommand, onGeminiResponse, handleError]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Reset state
      setLastError(null);
      audioChunksRef.current = [];

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Setup audio analysis for silence detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: audioFormat 
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: audioFormat });
        
        // Only process if we have actual audio data
        if (audioBlob.size > 0) {
          await processAudio(audioBlob);
        }
        
        audioChunksRef.current = [];
      };

      mediaRecorder.onerror = (event) => {
        handleError(new Error(`MediaRecorder error: ${event}`));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      updateStatus('recording');
      
      // Start silence detection
      detectSilence();

      console.log('Recording started');

    } catch (error) {
      handleError(error as Error);
    }
  }, [isRecording, audioFormat, updateStatus, processAudio, detectSilence, handleError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) {
      return;
    }

    try {
      // Stop silence detection
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Stop recording
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Clean up audio resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      analyserRef.current = null;
      mediaRecorderRef.current = null;
      
      setIsRecording(false);
      console.log('Recording stopped');

    } catch (error) {
      handleError(error as Error);
    }
  }, [isRecording, handleError]);

  // Cancel recording without processing
  const cancelRecording = useCallback(() => {
    audioChunksRef.current = []; // Clear chunks before stopping
    stopRecording();
    updateStatus('idle');
  }, [stopRecording, updateStatus]);

  // Clear error
  const clearError = useCallback(() => {
    setLastError(null);
    if (status === 'error') {
      updateStatus('idle');
    }
  }, [status, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        cancelRecording();
      }
    };
  }, [isRecording, cancelRecording]);

  return {
    isRecording,
    status,
    lastTranscript,
    lastIntent,
    lastError,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  };
}