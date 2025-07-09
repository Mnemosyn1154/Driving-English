/**
 * WebSocket Server for Real-time Audio Communication
 * Integrates with Express server and handles Gemini Audio API
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { 
  ClientMessage, 
  ServerMessage, 
  AuthMessage, 
  AudioStreamStartMessage,
  AudioChunkMessage,
  AudioStreamEndMessage,
  CommandMessage,
  HybridModeMessage,
  ErrorMessage,
  RecognitionResultMessage,
  AudioResponseMessage,
  AuthSuccessMessage,
  AuthRequiredMessage
} from '@/types/websocket';
import { GeminiAudioService } from '@/services/gemini/audioService';
import jwt from 'jsonwebtoken';

export interface WebSocketServerConfig {
  server: HTTPServer;
  path?: string;
  jwtSecret?: string;
  corsOrigin?: string;
}

interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  isAuthenticated: boolean;
  geminiService?: GeminiAudioService;
  lastPing: number;
  hybridMode: boolean;
}

export class DrivingWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private config: Required<WebSocketServerConfig>;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: WebSocketServerConfig) {
    this.config = {
      server: config.server,
      path: config.path || '/api/voice/stream',
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'default-secret',
      corsOrigin: config.corsOrigin || process.env.CORS_ORIGIN || '*',
    };

    // Initialize WebSocket server
    this.wss = new WebSocketServer({
      server: this.config.server,
      path: this.config.path,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.startHeartbeat();

    console.log(`WebSocket server started on path: ${this.config.path}`);
  }

  /**
   * Verify client connection
   */
  private verifyClient(info: { origin: string; req: IncomingMessage }): boolean {
    // Basic CORS check
    if (this.config.corsOrigin !== '*' && info.origin !== this.config.corsOrigin) {
      console.warn(`Rejected connection from origin: ${info.origin}`);
      return false;
    }
    return true;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        ws,
        isAuthenticated: false,
        lastPing: Date.now(),
        hybridMode: false,
      };

      this.clients.set(clientId, client);
      console.log(`Client connected: ${clientId}`);

      // Send authentication required
      this.sendMessage(client, {
        type: 'auth_required',
        message: 'Authentication required',
        timestamp: Date.now(),
      });

      // Setup client event handlers
      ws.on('message', (data: Buffer) => {
        this.handleMessage(client, data);
      });

      ws.on('close', (code: number, reason: Buffer) => {
        this.handleDisconnect(client, code, reason.toString());
      });

      ws.on('error', (error: Error) => {
        this.handleError(client, error);
      });

      ws.on('pong', () => {
        client.lastPing = Date.now();
      });
    });

    this.wss.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(client: ClientConnection, data: Buffer): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth':
          await this.handleAuth(client, message);
          break;
        
        case 'audio_stream_start':
          await this.handleAudioStreamStart(client, message);
          break;
        
        case 'audio_chunk':
          await this.handleAudioChunk(client, message);
          break;
        
        case 'audio_stream_end':
          await this.handleAudioStreamEnd(client, message);
          break;
        
        case 'command':
          await this.handleCommand(client, message);
          break;
        
        case 'hybrid_mode':
          this.handleHybridMode(client, message as HybridModeMessage);
          break;
        
        case 'ping':
          client.lastPing = Date.now();
          this.sendMessage(client, {
            type: 'pong',
            timestamp: Date.now(),
          });
          break;
        
        default:
          this.sendError(client, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(client, 'INVALID_MESSAGE', 'Invalid message format');
    }
  }

  /**
   * Handle authentication
   */
  private async handleAuth(client: ClientConnection, message: AuthMessage): Promise<void> {
    try {
      // In development, accept any token
      if (process.env.NODE_ENV === 'development') {
        client.isAuthenticated = true;
        client.userId = 'dev-user';
      } else {
        // Verify JWT token
        const decoded = jwt.verify(message.token, this.config.jwtSecret) as any;
        client.userId = decoded.userId || decoded.sub;
        client.isAuthenticated = true;
      }

      // Send authentication success
      const response: AuthSuccessMessage = {
        type: 'auth_success',
        sessionId: client.id,
        userId: client.userId!,
        timestamp: Date.now(),
      };

      this.sendMessage(client, response);
      console.log(`Client authenticated: ${client.id} (${client.userId})`);

    } catch (error) {
      console.error('Authentication failed:', error);
      this.sendError(client, 'AUTH_FAILED', 'Invalid authentication token');
    }
  }

  /**
   * Handle audio stream start
   */
  private async handleAudioStreamStart(client: ClientConnection, message: AudioStreamStartMessage): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    try {
      // Initialize Gemini Audio Service
      client.geminiService = new GeminiAudioService({
        hybridMode: client.hybridMode,
        onTranscript: (transcript: string, isFinal: boolean) => {
          const response: RecognitionResultMessage = {
            type: 'recognition_result',
            transcript,
            isFinal,
            confidence: 0.9, // Placeholder confidence
            timestamp: Date.now(),
          };
          this.sendMessage(client, response);
        },
        onCommand: (command: string, transcript: string) => {
          // Send command result when hybrid mode detects a command
          const response: CommandMessage = {
            type: 'command',
            command,
            context: { transcript },
            timestamp: Date.now(),
          };
          this.sendMessage(client, response);
        },
        onAudioResponse: (audioData: string) => {
          const response: AudioResponseMessage = {
            type: 'audio_response',
            data: audioData,
            format: 'base64',
            duration: 0,
            text: '',
            language: 'ko-KR',
            timestamp: Date.now(),
          };
          this.sendMessage(client, response);
        },
        onError: (error: Error) => {
          this.sendError(client, 'GEMINI_ERROR', error.message);
        },
      });

      await client.geminiService.startStream(message.config);
      console.log(`Audio stream started for client: ${client.id}`);

    } catch (error) {
      console.error('Failed to start audio stream:', error);
      this.sendError(client, 'STREAM_START_FAILED', 'Failed to start audio stream');
    }
  }

  /**
   * Handle audio chunk
   */
  private async handleAudioChunk(client: ClientConnection, message: AudioChunkMessage): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    if (!client.geminiService) {
      this.sendError(client, 'STREAM_NOT_STARTED', 'Audio stream not started');
      return;
    }

    try {
      // Convert base64 to binary
      const audioData = Buffer.from(message.data, 'base64');
      await client.geminiService.processAudioChunk(audioData);
    } catch (error) {
      console.error('Failed to process audio chunk:', error);
      this.sendError(client, 'AUDIO_PROCESSING_FAILED', 'Failed to process audio chunk');
    }
  }

  /**
   * Handle audio stream end
   */
  private async handleAudioStreamEnd(client: ClientConnection, message: AudioStreamEndMessage): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    if (client.geminiService) {
      try {
        await client.geminiService.endStream();
        client.geminiService = undefined;
        console.log(`Audio stream ended for client: ${client.id}`);
      } catch (error) {
        console.error('Failed to end audio stream:', error);
        this.sendError(client, 'STREAM_END_FAILED', 'Failed to end audio stream');
      }
    }
  }

  /**
   * Handle command
   */
  private async handleCommand(client: ClientConnection, message: CommandMessage): Promise<void> {
    if (!client.isAuthenticated) {
      this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    console.log(`Command received from ${client.id}: ${message.command}`);
    
    // Process command through Gemini if available
    if (client.geminiService) {
      try {
        await client.geminiService.processCommand(message.command, message.context);
      } catch (error) {
        console.error('Failed to process command:', error);
        this.sendError(client, 'COMMAND_PROCESSING_FAILED', 'Failed to process command');
      }
    }
  }

  /**
   * Handle hybrid mode toggle
   */
  private handleHybridMode(client: ClientConnection, message: HybridModeMessage): void {
    if (!client.isAuthenticated) {
      this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    client.hybridMode = message.enabled;
    console.log(`Hybrid mode ${message.enabled ? 'enabled' : 'disabled'} for client ${client.id}`);

    // If Gemini service exists, update its configuration
    if (client.geminiService) {
      client.geminiService.updateConfig({ hybridMode: message.enabled });
    }

    // Send confirmation
    this.sendMessage(client, {
      type: 'hybrid_mode_updated',
      enabled: message.enabled,
      timestamp: Date.now(),
    } as ServerMessage);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: ClientConnection, code: number, reason: string): void {
    console.log(`Client disconnected: ${client.id} (${code}: ${reason})`);
    
    // Clean up Gemini service
    if (client.geminiService) {
      client.geminiService.cleanup();
    }
    
    this.clients.delete(client.id);
  }

  /**
   * Handle client error
   */
  private handleError(client: ClientConnection, error: Error): void {
    console.error(`Client error (${client.id}):`, error);
    
    // Clean up on error
    if (client.geminiService) {
      client.geminiService.cleanup();
    }
    
    this.clients.delete(client.id);
  }

  /**
   * Send message to client
   */
  private sendMessage(client: ClientConnection, message: ServerMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: ClientConnection, code: string, message: string): void {
    const errorMessage: ErrorMessage = {
      type: 'error',
      code,
      message,
      timestamp: Date.now(),
    };
    
    this.sendMessage(client, errorMessage);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients) {
        // Check if client is still alive
        if (now - client.lastPing > 60000) { // 1 minute timeout
          console.log(`Client ${clientId} timed out`);
          client.ws.terminate();
          this.clients.delete(clientId);
        } else {
          // Send ping
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get authenticated clients count
   */
  public getAuthenticatedClientsCount(): number {
    return Array.from(this.clients.values()).filter(client => client.isAuthenticated).length;
  }

  /**
   * Close server
   */
  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      if (client.geminiService) {
        client.geminiService.cleanup();
      }
      client.ws.terminate();
    }
    
    this.clients.clear();
    this.wss.close();
    console.log('WebSocket server closed');
  }
}