'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiAudioService } from '@/services/gemini/audioService';
import { HybridWakeWordDetector } from '@/services/audio/hybridWakeWord';
import { ConversationMessage } from '@/types/websocket';
import { useAudioRecorder } from './useAudioRecorder';
import { config } from '@/lib/env';

interface UseGeminiLiveAudioOptions {
  autoStart?: boolean;
  useLiveAPI?: boolean;
  useHybridMode?: boolean;
  wakeWordMode?: 'ml' | 'energy' | 'hybrid';
  onCommand?: (command: string, transcript: string) => void;
  onError?: (error: Error) => void;
}

interface UseGeminiLiveAudioReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  wakeWordDetected: boolean;
  transcript: string;
  conversation: ConversationMessage[];
  voiceActivityDetected: boolean;
  confidence: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendText: (text: string) => Promise<void>;
  clearConversation: () => void;
  updateContext: (context: string) => void;
  setWakeWordMode: (mode: 'ml' | 'energy' | 'hybrid') => void;
  setWakeWordThreshold: (threshold: number) => void;
}

export function useGeminiLiveAudio(options: UseGeminiLiveAudioOptions = {}): UseGeminiLiveAudioReturn {
  const {
    autoStart = false,
    useLiveAPI = true,
    useHybridMode = true,
    wakeWordMode = 'hybrid',
    onCommand,
    onError
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [voiceActivityDetected, setVoiceActivityDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);

  // Refs
  const audioServiceRef = useRef<GeminiAudioService | null>(null);
  const wakeWordDetectorRef = useRef<HybridWakeWordDetector | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio recorder hook
  const {
    isRecording,
    startRecording,
    stopRecording,
    audioStream,
  } = useAudioRecorder({
    onAudioData: async (audioData) => {
      if (audioServiceRef.current && wakeWordDetected) {
        await audioServiceRef.current.processAudioChunk(audioData);
      }
    },
    sampleRate: 16000,
    channelCount: 1,
  });

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Gemini Audio Service
        audioServiceRef.current = new GeminiAudioService({
          useLiveAPI,
          hybridMode: useHybridMode,
          onTranscript: (text, isFinal) => {
            setTranscript(text);
            if (isFinal) {
              setIsProcessing(true);
              // Clear processing state after timeout
              if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
              }
              processingTimeoutRef.current = setTimeout(() => {
                setIsProcessing(false);
              }, 5000);
            }
          },
          onAudioResponse: async (audioData) => {
            setIsProcessing(false);
            await playAudioResponse(audioData);
          },
          onError: (error) => {
            console.error('Gemini audio error:', error);
            setIsProcessing(false);
            onError?.(error);
          },
          onConversationUpdate: (messages) => {
            setConversation(messages);
          },
          onCommand: (command, transcriptText) => {
            console.log('Command detected:', command, transcriptText);
            onCommand?.(command, transcriptText);
          },
          onVoiceActivity: (isActive) => {
            setVoiceActivityDetected(isActive);
          },
        });

        // Initialize Wake Word Detector
        wakeWordDetectorRef.current = new HybridWakeWordDetector({
          useML: wakeWordMode !== 'energy',
          useEnergy: wakeWordMode !== 'ml',
          requireBoth: wakeWordMode === 'hybrid',
          mlThreshold: 0.85,
          energyThreshold: 0.7,
          sampleRate: 16000,
        });

        await wakeWordDetectorRef.current.initialize();

        // Set up wake word event handlers
        wakeWordDetectorRef.current.on('wakeWordDetected', async (result) => {
          console.log('Wake word detected:', result);
          setWakeWordDetected(true);
          setConfidence(result.confidence);
          
          // Start Gemini stream
          if (audioServiceRef.current) {
            await audioServiceRef.current.startStream({
              sampleRate: 16000,
            });
            setIsConnected(true);
          }

          // Auto stop after 10 seconds of silence
          setTimeout(() => {
            if (!voiceActivityDetected) {
              handleWakeWordTimeout();
            }
          }, 10000);
        });

        wakeWordDetectorRef.current.on('mlConfidence', (conf) => {
          if (wakeWordMode === 'ml' || wakeWordMode === 'hybrid') {
            setConfidence(conf);
          }
        });

        wakeWordDetectorRef.current.on('volumeChange', (volume) => {
          // Could be used for UI visualization
        });

        // Initialize audio element for playback
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.addEventListener('play', () => setIsSpeaking(true));
          audioRef.current.addEventListener('ended', () => setIsSpeaking(false));
          audioRef.current.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            setIsSpeaking(false);
          });
        }

      } catch (error) {
        console.error('Failed to initialize services:', error);
        onError?.(error as Error);
      }
    };

    initializeServices();

    return () => {
      // Cleanup
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (audioServiceRef.current) {
        audioServiceRef.current.cleanup();
      }
      if (wakeWordDetectorRef.current) {
        wakeWordDetectorRef.current.dispose();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [useLiveAPI, useHybridMode, wakeWordMode, onCommand, onError]);

  // Auto start if enabled
  useEffect(() => {
    if (autoStart && !isListening) {
      startListening();
    }
  }, [autoStart]);

  // Handle wake word timeout
  const handleWakeWordTimeout = useCallback(async () => {
    if (wakeWordDetected && !isProcessing && !isSpeaking) {
      console.log('Wake word timeout, ending stream');
      setWakeWordDetected(false);
      setIsConnected(false);
      
      if (audioServiceRef.current) {
        await audioServiceRef.current.endStream();
      }
    }
  }, [wakeWordDetected, isProcessing, isSpeaking]);

  // Play audio response
  const playAudioResponse = async (audioData: string) => {
    if (!audioRef.current) return;

    try {
      // Convert base64 to blob
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioData), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      await audioRef.current.play();

      // Clean up URL after playback
      audioRef.current.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      }, { once: true });

    } catch (error) {
      console.error('Failed to play audio response:', error);
      setIsSpeaking(false);
    }
  };

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setIsListening(true);
      
      // Start recording
      await startRecording();
      
      // Start wake word detection
      if (wakeWordDetectorRef.current && audioStream) {
        await wakeWordDetectorRef.current.startListening(audioStream);
      }

    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
      onError?.(error as Error);
    }
  }, [startRecording, audioStream, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
    setWakeWordDetected(false);
    setIsConnected(false);
    
    // Stop recording
    stopRecording();
    
    // Stop wake word detection
    if (wakeWordDetectorRef.current) {
      wakeWordDetectorRef.current.stopListening();
    }
    
    // End Gemini stream
    if (audioServiceRef.current) {
      audioServiceRef.current.endStream();
    }

    // Stop any playing audio
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  }, [stopRecording]);

  // Send text message
  const sendText = useCallback(async (text: string) => {
    if (!audioServiceRef.current) return;

    try {
      setTranscript(text);
      setIsProcessing(true);
      
      await audioServiceRef.current.sendText(text);
      
    } catch (error) {
      console.error('Failed to send text:', error);
      setIsProcessing(false);
      onError?.(error as Error);
    }
  }, [onError]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversation([]);
    setTranscript('');
    
    if (audioServiceRef.current) {
      audioServiceRef.current.clearConversationHistory();
    }
  }, []);

  // Update context
  const updateContext = useCallback((context: string) => {
    if (audioServiceRef.current) {
      audioServiceRef.current.updateLiveContext(context);
      audioServiceRef.current.setSystemPrompt(context);
    }
  }, []);

  // Set wake word mode
  const setWakeWordMode = useCallback((mode: 'ml' | 'energy' | 'hybrid') => {
    if (wakeWordDetectorRef.current) {
      wakeWordDetectorRef.current.setMode(mode);
    }
  }, []);

  // Set wake word threshold
  const setWakeWordThreshold = useCallback((threshold: number) => {
    if (wakeWordDetectorRef.current) {
      const status = wakeWordDetectorRef.current.getStatus();
      if (status.mode === 'ml' || status.mode === 'hybrid') {
        wakeWordDetectorRef.current.setMLThreshold(threshold);
      }
      if (status.mode === 'energy' || status.mode === 'hybrid') {
        wakeWordDetectorRef.current.setEnergyThreshold(threshold);
      }
    }
  }, []);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    isConnected,
    wakeWordDetected,
    transcript,
    conversation,
    voiceActivityDetected,
    confidence,
    startListening,
    stopListening,
    sendText,
    clearConversation,
    updateContext,
    setWakeWordMode,
    setWakeWordThreshold,
  };
}