'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { WebSocketClient } from '@/services/client/websocket/client';

interface UseWebSocketReturn {
  isConnected: boolean;
  lastTranscript: string | null;
  sendAudioData: (data: Uint8Array) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: Error | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    // Initialize WebSocket client
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/api/voice/stream';
    const token = process.env.NEXT_PUBLIC_AUTH_TOKEN || 'test-token';
    
    const client = new WebSocketClient({
      url: wsUrl,
      token: token,
    });

    // Set up event listeners
    client.on('connected', () => {
      setIsConnected(true);
      setError(null);
    });

    client.on('disconnected', () => {
      setIsConnected(false);
    });

    client.on('recognitionResult', (data) => {
      if (data.transcript) {
        setLastTranscript(data.transcript);
      }
    });

    client.on('error', (err) => {
      setError(err);
      console.error('WebSocket error:', err);
    });

    clientRef.current = client;

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      if (clientRef.current && !isConnected) {
        await clientRef.current.connect();
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [isConnected]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  const sendAudioData = useCallback((data: Uint8Array) => {
    if (clientRef.current && isConnected) {
      try {
        // Convert to base64 for transmission
        const base64Data = btoa(String.fromCharCode(...data));
        clientRef.current.sendAudioChunk(base64Data, Date.now());
      } catch (err) {
        setError(err as Error);
        console.error('Failed to send audio data:', err);
      }
    }
  }, [isConnected]);

  return {
    isConnected,
    lastTranscript,
    sendAudioData,
    connect,
    disconnect,
    error,
  };
}