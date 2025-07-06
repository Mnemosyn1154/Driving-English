import { WebSocketClient } from '@/services/client/websocket/client';
import { ClientMessage, ServerMessage, AuthMessage } from '@/types/websocket';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

// Replace global WebSocket with mock
global.WebSocket = MockWebSocket as any;

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockWebSocket: MockWebSocket;
  const wsUrl = 'ws://localhost:3000/api/voice/stream';
  const authToken = 'test-auth-token';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Capture WebSocket instance when created
    const originalWebSocket = global.WebSocket;
    global.WebSocket = jest.fn((url: string) => {
      mockWebSocket = new MockWebSocket(url);
      return mockWebSocket;
    }) as any;
    
    client = new WebSocketClient({
      url: wsUrl,
      token: authToken
    });
  });

  afterEach(() => {
    client.disconnect();
    jest.useRealTimers();
  });

  describe('connect', () => {
    it('should establish WebSocket connection', async () => {
      const connectPromise = client.connect();
      
      // Fast-forward to trigger connection
      jest.advanceTimersByTime(10);
      
      await connectPromise;

      expect(global.WebSocket).toHaveBeenCalledWith(wsUrl);
      expect(client.isConnected()).toBe(true);
    });

    it('should send authentication after connection', async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;

      const authMessage: AuthMessage = {
        type: 'auth',
        token: authToken,
        timestamp: expect.any(Number),
      };

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(authMessage)
      );
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      
      // Simulate connection error
      setTimeout(() => {
        mockWebSocket.readyState = WebSocket.CLOSED;
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Event('error'));
        }
      }, 5);

      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);

      await expect(connectPromise).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should not connect if already connected', async () => {
      // First connection
      const firstConnect = client.connect();
      jest.advanceTimersByTime(10);
      await firstConnect;
      
      jest.clearAllMocks();
      
      // Second connection attempt
      const secondConnect = client.connect();
      jest.advanceTimersByTime(10);
      await secondConnect;

      expect(global.WebSocket).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;

      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;
    });

    it('should handle auth success messages', (done) => {
      const serverMessage: ServerMessage = {
        type: 'auth_success',
        sessionId: 'test-session-id',
        timestamp: Date.now(),
      };

      // First wait for authentication to be sent
      setTimeout(() => {
        // Simulate auth success
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify(serverMessage),
          }));
        }
        
        expect(client.getSessionId()).toBe('test-session-id');
        done();
      }, 20);
    });

    it('should handle recognition result messages', (done) => {
      const serverMessage: ServerMessage = {
        type: 'recognition_result',
        transcript: 'Hello world',
        isFinal: true,
        confidence: 0.95,
        timestamp: Date.now(),
      };

      client.on('recognitionResult', (data) => {
        expect(data.transcript).toBe('Hello world');
        expect(data.isFinal).toBe(true);
        expect(data.confidence).toBe(0.95);
        done();
      });

      // First authenticate
      setTimeout(() => {
        const authSuccess: ServerMessage = {
          type: 'auth_success',
          sessionId: 'test-session',
          timestamp: Date.now(),
        };
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify(authSuccess),
          }));
        }
        
        // Then send recognition result
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify(serverMessage),
          }));
        }
      }, 20);
    });

    it('should handle error messages', (done) => {
      const serverMessage: ServerMessage = {
        type: 'error',
        error: 'Invalid audio format',
        code: 'INVALID_FORMAT',
        timestamp: Date.now(),
      };

      client.on('error', (data) => {
        expect(data.error).toBe('Invalid audio format');
        expect(data.code).toBe('INVALID_FORMAT');
        done();
      });

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(serverMessage),
        }));
      }
    });

    it('should handle malformed messages', () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: 'invalid json',
        }));
      }

      // The error handler is called internally, not emitted
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('sendAudioChunk', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;
      
      // Authenticate first
      const authSuccess: ServerMessage = {
        type: 'auth_success',
        sessionId: 'test-session',
        timestamp: Date.now(),
      };
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(authSuccess),
        }));
      }
    });

    it('should send audio chunk when authenticated', () => {
      const audioData = 'base64encodedaudio';
      const sequence = 1;
      
      client.sendAudioChunk(audioData, sequence);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'audio_chunk',
          data: audioData,
          sequence: sequence,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should throw error when not authenticated', () => {
      // Create new client without authentication
      const newClient = new WebSocketClient({
        url: wsUrl,
        token: authToken
      });
      
      expect(() => newClient.sendAudioChunk('data', 1)).toThrow('Client is not authenticated');
    });
  });

  describe('sendCommand', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;
      
      // Authenticate first
      const authSuccess: ServerMessage = {
        type: 'auth_success',
        sessionId: 'test-session',
        timestamp: Date.now(),
      };
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(authSuccess),
        }));
      }
    });

    it('should send command messages', () => {
      client.sendCommand('pause', { reason: 'user requested' });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'command',
          command: 'pause',
          context: { reason: 'user requested' },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should start audio stream', async () => {
      await client.startAudioStream({
        sampleRate: 16000,
        format: 'LINEAR16',
        language: 'en-US',
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'audio_stream_start',
          config: {
            sampleRate: 16000,
            format: 'LINEAR16',
            language: 'en-US',
          },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should end audio stream', () => {
      client.endAudioStream(1000);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'audio_stream_end',
          duration: 1000,
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('event emitter', () => {
    it('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      client.on('error', listener1);
      client.on('error', listener2);

      client.emit('error', { error: 'Test error' });

      expect(listener1).toHaveBeenCalledWith({ error: 'Test error' });
      expect(listener2).toHaveBeenCalledWith({ error: 'Test error' });
    });

    it('should remove listeners', () => {
      const listener = jest.fn();

      client.on('error', listener);
      client.off('error', listener);

      client.emit('error', { error: 'Test error' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    it('should handle unexpected disconnections', async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;

      const disconnectHandler = jest.fn();
      client.on('disconnected', disconnectHandler);

      // Simulate unexpected close
      if (mockWebSocket.onclose) {
        mockWebSocket.onclose(new CloseEvent('close', {
          code: 1006,
          reason: 'Abnormal closure',
        }));
      }

      expect(disconnectHandler).toHaveBeenCalledWith(1006, 'Abnormal closure');
      expect(client.isConnected()).toBe(false);
    });

    it('should emit connection state changes', async () => {
      const connectedHandler = jest.fn();
      client.on('connected', connectedHandler);

      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;

      expect(connectedHandler).toHaveBeenCalled();
    });
  });

  describe('message queuing', () => {
    it('should queue messages when not authenticated', async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;
      
      // Try to send command before authentication
      expect(() => client.sendCommand('test')).toThrow('Client is not authenticated');
    });

    it('should process queued messages after authentication', async () => {
      const connectPromise = client.connect();
      jest.advanceTimersByTime(10);
      await connectPromise;
      
      // Clear previous auth message
      jest.clearAllMocks();
      
      // Send auth success
      const authSuccess: ServerMessage = {
        type: 'auth_success',
        sessionId: 'test-session',
        timestamp: Date.now(),
      };
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', {
          data: JSON.stringify(authSuccess),
        }));
      }
      
      // Now commands should work
      client.sendCommand('test');
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });
});