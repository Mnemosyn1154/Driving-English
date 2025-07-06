/**
 * WebSocket Client for Audio Streaming
 * Handles connection to the server and audio data transmission
 */

import {
  ClientMessage,
  ServerMessage,
  AuthMessage,
  AudioStreamStartMessage,
  AudioChunkMessage,
  AudioStreamEndMessage,
  CommandMessage,
  ErrorMessage,
  RecognitionResultMessage,
} from '@/types/websocket';

export interface WebSocketClientConfig {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';

export interface WebSocketClientEvents {
  stateChange: (state: ConnectionState) => void;
  recognitionResult: (result: RecognitionResultMessage) => void;
  error: (error: ErrorMessage | Error) => void;
  audioResponse: (response: any) => void;
  connected: () => void;
  disconnected: (code: number, reason: string) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Partial<WebSocketClientEvents> = {};
  private messageQueue: ClientMessage[] = [];
  private sessionId: string | null = null;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      token: config.token,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected' || this.state === 'authenticated') {
      console.warn('Already connected or connecting');
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setState('disconnected');
  }

  /**
   * Start audio streaming
   */
  async startAudioStream(config: AudioStreamStartMessage['config']): Promise<void> {
    this.ensureAuthenticated();

    const message: AudioStreamStartMessage = {
      type: 'audio_stream_start',
      config,
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Send audio chunk
   */
  sendAudioChunk(data: string, sequence: number): void {
    this.ensureAuthenticated();

    const message: AudioChunkMessage = {
      type: 'audio_chunk',
      data,
      sequence,
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * End audio streaming
   */
  endAudioStream(duration: number): void {
    this.ensureAuthenticated();

    const message: AudioStreamEndMessage = {
      type: 'audio_stream_end',
      duration,
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Send command
   */
  sendCommand(command: string, context?: Record<string, any>): void {
    this.ensureAuthenticated();

    const message: CommandMessage = {
      type: 'command',
      command,
      context,
      timestamp: Date.now(),
    };

    this.send(message);
  }

  /**
   * Add event listener
   */
  on<K extends keyof WebSocketClientEvents>(
    event: K,
    handler: WebSocketClientEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketClientEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.setState('connected');
      this.reconnectAttempts = 0;
      
      // Send authentication
      this.authenticate();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Emit connected event
      this.emit('connected');
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
      this.cleanup();
      
      const wasAuthenticated = this.state === 'authenticated';
      this.setState('disconnected');
      
      // Emit disconnected event
      this.emit('disconnected', event.code, event.reason);
      
      // Attempt reconnection if it was an unexpected disconnect
      if (wasAuthenticated && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.handleError(new Error('WebSocket error'));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.handleError(new Error('Invalid message format'));
      }
    };
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'auth_success':
        this.sessionId = message.sessionId;
        this.setState('authenticated');
        this.processMessageQueue();
        break;

      case 'auth_required':
        this.authenticate();
        break;

      case 'recognition_result':
        this.emit('recognitionResult', message);
        break;

      case 'audio_response':
        this.emit('audioResponse', message);
        break;

      case 'error':
        this.handleServerError(message);
        break;

      default:
        console.warn('Unknown message type:', (message as any).type);
    }
  }

  /**
   * Authenticate with the server
   */
  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage: AuthMessage = {
      type: 'auth',
      token: this.config.token,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  /**
   * Send message to server
   */
  private send(message: ClientMessage): void {
    if (this.state !== 'authenticated') {
      // Queue message if not authenticated
      this.messageQueue.push(message);
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Ensure client is authenticated
   */
  private ensureAuthenticated(): void {
    if (this.state !== 'authenticated') {
      throw new Error('Client is not authenticated');
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setState('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.setState('error');
    this.emit('error', error);
  }

  /**
   * Handle server errors
   */
  private handleServerError(error: ErrorMessage): void {
    console.error(`Server error: ${error.code} - ${error.message}`);
    this.emit('error', error);
    
    // Handle specific error codes
    switch (error.code) {
      case 'AUTH_FAILED':
        this.setState('error');
        this.disconnect();
        break;
      case 'RATE_LIMIT_EXCEEDED':
        // Wait before retrying
        setTimeout(() => {
          this.scheduleReconnect();
        }, 60000); // Wait 1 minute
        break;
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof WebSocketClientEvents>(
    event: K,
    ...args: Parameters<WebSocketClientEvents[K]>
  ): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      (handler as any)(...args);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.messageQueue = [];
    this.sessionId = null;
  }
}