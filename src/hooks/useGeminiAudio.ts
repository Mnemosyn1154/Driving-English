'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WebSocketClient } from '@/services/client/websocket/client';
import { 
  ConnectionState, 
  RecognitionResultMessage, 
  AudioResponseMessage,
  ConversationMessage 
} from '@/types/websocket';

export interface UseGeminiAudioOptions {
  autoConnect?: boolean;
  wsUrl?: string;
  token?: string;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onAudioResponse?: (audioData: string) => void;
  onError?: (error: Error) => void;
  onConversationUpdate?: (messages: ConversationMessage[]) => void;
}

export interface UseGeminiAudioReturn {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  isAuthenticated: boolean;
  sessionId: string | null;
  
  // Audio streaming
  isStreaming: boolean;
  isRecording: boolean;
  
  // Conversation
  conversationHistory: ConversationMessage[];
  lastTranscript: string | null;
  
  // Controls
  connect: () => Promise<void>;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendCommand: (command: string, context?: Record<string, any>) => void;
  clearConversation: () => void;
  
  // Error handling
  error: Error | null;
  clearError: () => void;
}

export function useGeminiAudio(options: UseGeminiAudioOptions = {}): UseGeminiAudioReturn {
  const {
    autoConnect = false,
    wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/api/voice/stream',
    token = process.env.NEXT_PUBLIC_AUTH_TOKEN || 'dev-token',
    onTranscript,
    onAudioResponse,
    onError,
    onConversationUpdate,
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const clientRef = useRef<WebSocketClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sequenceRef = useRef<number>(0);

  // Computed values
  const isConnected = connectionState === 'connected' || connectionState === 'authenticated';
  const isAuthenticated = connectionState === 'authenticated';

  /**
   * Initialize WebSocket client
   */
  const initializeClient = useCallback(() => {
    if (clientRef.current) return;

    const client = new WebSocketClient({
      url: wsUrl,
      token,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    });

    // Set up event handlers
    client.on('stateChange', (state) => {
      setConnectionState(state);
      if (state === 'disconnected') {
        setSessionId(null);
        setIsStreaming(false);
        setIsRecording(false);
      }
    });

    client.on('connected', () => {
      setError(null);
    });

    client.on('authenticated', (sessionId, userId) => {
      setSessionId(sessionId);
      setError(null);
      console.log('Authenticated with session:', sessionId);
    });

    client.on('recognitionResult', (result: RecognitionResultMessage) => {
      setLastTranscript(result.transcript);
      onTranscript?.(result.transcript, result.isFinal);
      
      if (result.isFinal) {
        // Add to conversation history
        const userMessage: ConversationMessage = {
          role: 'user',
          content: result.transcript,
          timestamp: Date.now(),
        };
        setConversationHistory(prev => {
          const updated = [...prev, userMessage];
          onConversationUpdate?.(updated);
          return updated;
        });
      }
    });

    client.on('audioResponse', (response: AudioResponseMessage) => {
      onAudioResponse?.(response.data);
      
      // Add assistant response to conversation if text is available
      if (response.text) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: response.text,
          timestamp: Date.now(),
        };
        setConversationHistory(prev => {
          const updated = [...prev, assistantMessage];
          onConversationUpdate?.(updated);
          return updated;
        });
      }
    });

    client.on('error', (errorData) => {
      const errorObj = errorData instanceof Error ? errorData : new Error(errorData.message);
      setError(errorObj);
      onError?.(errorObj);
      console.error('WebSocket error:', errorData);
    });

    clientRef.current = client;
  }, [wsUrl, token, onTranscript, onAudioResponse, onError, onConversationUpdate]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async () => {
    try {
      if (!clientRef.current) {
        initializeClient();
      }
      
      if (clientRef.current && connectionState === 'disconnected') {
        await clientRef.current.connect();
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [connectionState, initializeClient, onError]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    
    setConnectionState('disconnected');
    setSessionId(null);
    setIsStreaming(false);
    setIsRecording(false);
  }, [isRecording]);

  /**
   * Start audio recording
   */
  const startRecording = useCallback(async () => {
    if (!isAuthenticated || isRecording) {
      console.warn('Cannot start recording: not authenticated or already recording');
      return;
    }

    try {
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

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      // Create audio processing pipeline
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isRecording || !clientRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Float32Array(inputData);
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        
        // Convert to base64
        const buffer = Buffer.from(pcmData.buffer);
        const base64Data = buffer.toString('base64');
        
        // Send audio chunk
        clientRef.current.sendAudioChunk(base64Data, sequenceRef.current++);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;

      // Start audio stream
      await clientRef.current!.startAudioStream({
        language: 'ko-KR',
        sampleRate: 16000,
        encoding: 'LINEAR16',
        channels: 1,
      });

      setIsRecording(true);
      setIsStreaming(true);
      sequenceRef.current = 0;
      
      console.log('Audio recording started');

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      console.error('Failed to start recording:', error);
    }
  }, [isAuthenticated, isRecording, onError]);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    try {
      // Stop audio stream
      if (clientRef.current && isStreaming) {
        const duration = sequenceRef.current * 1024 / 16000; // Approximate duration
        clientRef.current.endAudioStream(duration);
      }

      // Clean up audio resources
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
      setIsStreaming(false);
      sequenceRef.current = 0;
      
      console.log('Audio recording stopped');

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      console.error('Failed to stop recording:', error);
    }
  }, [isRecording, isStreaming, onError]);

  /**
   * Send command
   */
  const sendCommand = useCallback((command: string, context?: Record<string, any>) => {
    if (!isAuthenticated || !clientRef.current) {
      console.warn('Cannot send command: not authenticated');
      return;
    }

    try {
      clientRef.current.sendCommand(command, context);
      
      // Add command to conversation history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: command,
        timestamp: Date.now(),
      };
      setConversationHistory(prev => {
        const updated = [...prev, userMessage];
        onConversationUpdate?.(updated);
        return updated;
      });

    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [isAuthenticated, onError, onConversationUpdate]);

  /**
   * Clear conversation history
   */
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setLastTranscript(null);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Initialize client even if not auto-connecting
    if (!clientRef.current) {
      initializeClient();
    }

    // Cleanup on unmount
    return () => {
      if (isRecording) {
        stopRecording();
      }
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array for mount/unmount only

  return {
    // Connection state
    connectionState,
    isConnected,
    isAuthenticated,
    sessionId,
    
    // Audio streaming
    isStreaming,
    isRecording,
    
    // Conversation
    conversationHistory,
    lastTranscript,
    
    // Controls
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendCommand,
    clearConversation,
    
    // Error handling
    error,
    clearError,
  };
}