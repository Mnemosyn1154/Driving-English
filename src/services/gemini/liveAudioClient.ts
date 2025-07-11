/**
 * Gemini Live Audio WebSocket Client
 * Handles real-time audio streaming and bidirectional communication with Gemini API
 */

import { EventEmitter } from 'events';

export interface LiveAudioConfig {
  apiKey: string;
  model?: string;
  language?: string;
  sampleRate?: number;
  enableVAD?: boolean; // Voice Activity Detection
  interimResults?: boolean;
  context?: string;
}

export interface LiveAudioResponse {
  type: 'transcript' | 'response' | 'error' | 'vad';
  data: {
    text?: string;
    isFinal?: boolean;
    confidence?: number;
    error?: string;
    speechDetected?: boolean;
  };
}

export class GeminiLiveAudioClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: LiveAudioConfig;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private audioQueue: ArrayBuffer[] = [];
  private conversationContext: string[] = [];
  private sessionId: string;

  constructor(config: LiveAudioConfig) {
    super();
    this.config = {
      model: 'gemini-2.0-flash-exp',
      language: 'ko-KR',
      sampleRate: 16000,
      enableVAD: true,
      interimResults: true,
      ...config
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Connect to Gemini Live Audio API
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Note: The actual Gemini Live Audio API endpoint will be provided by Google
      // This is a placeholder for the WebSocket endpoint
      const wsUrl = `wss://generativelanguage.googleapis.com/v1/models/${this.config.model}:streamGenerateContent`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      this.setupEventHandlers();
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        
        this.ws!.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.ws!.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.isConnected = true;
      this.setupPingInterval();
      this.sendInitialConfiguration();
      
      // Process queued audio
      while (this.audioQueue.length > 0) {
        const audio = this.audioQueue.shift()!;
        await this.sendAudio(audio);
      }
      
      this.emit('connected');
    } catch (error) {
      console.error('Failed to connect to Gemini Live Audio:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Send initial configuration
   */
  private sendInitialConfiguration(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const config = {
      type: 'configure',
      sessionId: this.sessionId,
      config: {
        audioConfig: {
          encoding: 'LINEAR16',
          sampleRateHertz: this.config.sampleRate,
          languageCode: this.config.language,
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ],
        tools: [
          {
            name: 'driving_assistant',
            description: 'Voice assistant for learning English while driving',
            parameters: {
              commands: ['play', 'pause', 'next', 'previous', 'repeat', 'translate', 'explain', 'difficulty']
            }
          }
        ],
        systemInstruction: this.config.context || `You are a helpful driving English learning assistant. 
          Help users learn English while driving by reading news articles and providing translations.
          Always prioritize safety and keep responses concise for driving conditions.
          Respond in Korean when needed, especially for translations and explanations.`,
        enableVoiceActivityDetection: this.config.enableVAD,
        interimResults: this.config.interimResults
      }
    };

    this.ws.send(JSON.stringify(config));
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      console.log(`WebSocket closed: ${code} - ${reason}`);
      this.isConnected = false;
      this.cleanup();
      this.emit('disconnected', { code, reason });
      
      if (code !== 1000) { // Abnormal closure
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('ping', () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.pong();
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'transcript':
        this.emit('transcript', {
          type: 'transcript',
          data: {
            text: message.text,
            isFinal: message.isFinal,
            confidence: message.confidence
          }
        });
        
        if (message.isFinal) {
          this.conversationContext.push(`User: ${message.text}`);
          this.trimConversationContext();
        }
        break;

      case 'response':
        this.emit('response', {
          type: 'response',
          data: {
            text: message.text,
            isFinal: message.isFinal
          }
        });
        
        if (message.isFinal) {
          this.conversationContext.push(`Assistant: ${message.text}`);
          this.trimConversationContext();
        }
        break;

      case 'voiceActivityUpdate':
        this.emit('vad', {
          type: 'vad',
          data: {
            speechDetected: message.speechDetected
          }
        });
        break;

      case 'error':
        this.emit('error', new Error(message.error));
        break;

      case 'toolCall':
        this.handleToolCall(message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle tool calls from Gemini
   */
  private handleToolCall(message: any): void {
    const { toolName, parameters } = message;
    
    this.emit('toolCall', {
      name: toolName,
      parameters
    });
  }

  /**
   * Send audio data
   */
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.isConnected) {
      this.audioQueue.push(audioData);
      if (!this.ws) {
        await this.connect();
      }
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Convert audio to base64 for JSON transport
      const base64Audio = Buffer.from(audioData).toString('base64');
      
      const message = {
        type: 'audio',
        sessionId: this.sessionId,
        audio: {
          data: base64Audio,
          sampleRate: this.config.sampleRate,
          encoding: 'LINEAR16'
        }
      };

      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send text input (for testing or fallback)
   */
  sendText(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'text',
        sessionId: this.sessionId,
        text,
        context: this.getConversationContext()
      };

      this.ws.send(JSON.stringify(message));
      this.conversationContext.push(`User: ${text}`);
      this.trimConversationContext();
    }
  }

  /**
   * Update conversation context
   */
  updateContext(context: string): void {
    this.config.context = context;
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'updateContext',
        sessionId: this.sessionId,
        context
      };

      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get conversation context
   */
  private getConversationContext(): string {
    return this.conversationContext.slice(-10).join('\n');
  }

  /**
   * Trim conversation context to prevent it from growing too large
   */
  private trimConversationContext(): void {
    if (this.conversationContext.length > 20) {
      this.conversationContext = this.conversationContext.slice(-15);
    }
  }

  /**
   * Setup ping interval to keep connection alive
   */
  private setupPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private reconnectAttempts = 0;

  /**
   * Disconnect from the service
   */
  disconnect(): void {
    this.isConnected = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.audioQueue = [];
    this.removeAllListeners();
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current session ID
   */
  get session(): string {
    return this.sessionId;
  }
}

// Factory function for creating client instances
export function createGeminiLiveAudioClient(config: LiveAudioConfig): GeminiLiveAudioClient {
  return new GeminiLiveAudioClient(config);
}