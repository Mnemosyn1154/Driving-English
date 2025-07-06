import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { AudioStreamHandler } from '@/services/server/gemini/audioStream';
import {
  ClientMessage,
  ServerMessage,
  AuthMessage,
  AudioStreamStartMessage,
  AudioChunkMessage,
  AudioStreamEndMessage,
  CommandMessage,
  ErrorMessage,
} from '@/types/websocket';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAuthenticated?: boolean;
  pingTimer?: NodeJS.Timeout;
}

export class DrivingEnglishWebSocketServer {
  private wss: WebSocketServer;
  private audioHandler: AudioStreamHandler;
  private clients: Map<string, AuthenticatedWebSocket>;
  private jwtSecret: string;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/voice/stream',
      perMessageDeflate: false, // Disable compression for real-time audio
    });

    this.audioHandler = new AudioStreamHandler();
    this.clients = new Map();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    this.setupWebSocketServer();
    this.setupAudioHandlerListeners();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      console.log('New WebSocket connection attempt');
      
      // Generate session ID
      ws.sessionId = uuidv4();
      
      // Set up ping/pong for connection health
      ws.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('pong', () => {
        // Connection is alive
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Request authentication
      this.sendMessage(ws, {
        type: 'auth_required',
        timestamp: Date.now(),
      } as ServerMessage);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  private setupAudioHandlerListeners() {
    // Listen for recognition results
    this.audioHandler.on('recognitionResult', (result) => {
      const client = this.findClientBySessionId(result.sessionId);
      if (client) {
        this.sendMessage(client, {
          type: 'recognition_result',
          transcript: result.transcript,
          confidence: result.confidence,
          command: result.command,
          isFinal: result.isFinal,
          timestamp: Date.now(),
        });
      }
    });

    // Listen for errors
    this.audioHandler.on('error', ({ sessionId, error, type }) => {
      const client = this.findClientBySessionId(sessionId);
      if (client) {
        this.sendError(client, type || 'PROCESSING_ERROR', error.message);
      }
    });

    // Listen for session events
    this.audioHandler.on('sessionStarted', ({ sessionId }) => {
      console.log(`Audio session started: ${sessionId}`);
    });

    this.audioHandler.on('sessionEnded', ({ sessionId, duration }) => {
      console.log(`Audio session ended: ${sessionId}, duration: ${duration}ms`);
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: ClientMessage) {
    // Check if authenticated (except for auth messages)
    if (message.type !== 'auth' && !ws.isAuthenticated) {
      this.sendError(ws, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    switch (message.type) {
      case 'auth':
        await this.handleAuth(ws, message as AuthMessage);
        break;

      case 'audio_stream_start':
        await this.handleAudioStreamStart(ws, message as AudioStreamStartMessage);
        break;

      case 'audio_chunk':
        await this.handleAudioChunk(ws, message as AudioChunkMessage);
        break;

      case 'audio_stream_end':
        await this.handleAudioStreamEnd(ws, message as AudioStreamEndMessage);
        break;

      case 'command':
        await this.handleCommand(ws, message as CommandMessage);
        break;

      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  private async handleAuth(ws: AuthenticatedWebSocket, message: AuthMessage) {
    try {
      // Verify JWT token
      const decoded = jwt.verify(message.token, this.jwtSecret) as any;
      
      // Set authentication status
      ws.userId = decoded.userId || decoded.sub;
      ws.isAuthenticated = true;
      
      // Store client
      this.clients.set(ws.sessionId!, ws);
      
      // Send success response
      this.sendMessage(ws, {
        type: 'auth_success',
        sessionId: ws.sessionId!,
        userId: ws.userId,
        timestamp: Date.now(),
      });
      
      console.log(`Client authenticated: userId=${ws.userId}, sessionId=${ws.sessionId}`);
    } catch (error) {
      console.error('Authentication failed:', error);
      this.sendError(ws, 'AUTH_FAILED', 'Invalid authentication token');
      ws.close(1008, 'Authentication failed');
    }
  }

  private async handleAudioStreamStart(ws: AuthenticatedWebSocket, message: AudioStreamStartMessage) {
    try {
      if (!ws.sessionId || !ws.userId) {
        throw new Error('Missing session or user ID');
      }

      // Start audio stream
      await this.audioHandler.startStream(
        ws.sessionId,
        ws.userId,
        {
          sampleRate: message.config.sampleRate,
          format: message.config.format,
          language: message.config.language,
        }
      );

      // Send confirmation
      this.sendMessage(ws, {
        type: 'stream_started',
        timestamp: Date.now(),
      } as ServerMessage);
    } catch (error: any) {
      console.error('Failed to start audio stream:', error);
      this.sendError(ws, 'STREAM_START_FAILED', error.message);
    }
  }

  private async handleAudioChunk(ws: AuthenticatedWebSocket, message: AudioChunkMessage) {
    try {
      if (!ws.sessionId) {
        throw new Error('No session ID');
      }

      // Process audio chunk
      await this.audioHandler.processAudioChunk(
        ws.sessionId,
        message.data,
        message.sequence
      );
    } catch (error: any) {
      console.error('Failed to process audio chunk:', error);
      this.sendError(ws, 'AUDIO_PROCESSING_FAILED', error.message);
    }
  }

  private async handleAudioStreamEnd(ws: AuthenticatedWebSocket, message: AudioStreamEndMessage) {
    try {
      if (!ws.sessionId) {
        throw new Error('No session ID');
      }

      // End audio stream
      await this.audioHandler.endStream(ws.sessionId);

      // Send confirmation
      this.sendMessage(ws, {
        type: 'stream_ended',
        duration: message.duration,
        timestamp: Date.now(),
      } as ServerMessage);
    } catch (error: any) {
      console.error('Failed to end audio stream:', error);
      this.sendError(ws, 'STREAM_END_FAILED', error.message);
    }
  }

  private async handleCommand(ws: AuthenticatedWebSocket, message: CommandMessage) {
    try {
      // Handle direct commands (not from audio)
      console.log(`Command received: ${message.command}`, message.context);
      
      // TODO: Implement command handling logic
      // For now, just acknowledge
      this.sendMessage(ws, {
        type: 'command_acknowledged',
        command: message.command,
        timestamp: Date.now(),
      } as ServerMessage);
    } catch (error: any) {
      console.error('Failed to handle command:', error);
      this.sendError(ws, 'COMMAND_FAILED', error.message);
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    console.log(`Client disconnected: sessionId=${ws.sessionId}`);
    
    // Clean up ping timer
    if (ws.pingTimer) {
      clearInterval(ws.pingTimer);
    }

    // End any active audio streams
    if (ws.sessionId) {
      this.audioHandler.endStream(ws.sessionId).catch(error => {
        console.error('Error ending stream on disconnect:', error);
      });
      
      // Remove from clients map
      this.clients.delete(ws.sessionId);
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: AuthenticatedWebSocket, code: string, message: string, details?: any) {
    const errorMessage: ErrorMessage = {
      type: 'error',
      code,
      message,
      details,
      timestamp: Date.now(),
    };
    this.sendMessage(ws, errorMessage);
  }

  private findClientBySessionId(sessionId: string): AuthenticatedWebSocket | undefined {
    return this.clients.get(sessionId);
  }

  /**
   * Broadcast a message to all authenticated clients
   */
  broadcast(message: ServerMessage, filter?: (client: AuthenticatedWebSocket) => boolean) {
    this.clients.forEach((client) => {
      if (client.isAuthenticated && (!filter || filter(client))) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.isAuthenticated).length,
      activeSessions: this.audioHandler.getActiveSessions().length,
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  async shutdown() {
    console.log('Shutting down WebSocket server...');
    
    // Close all client connections
    this.clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });

    // Shutdown audio handler
    await this.audioHandler.shutdown();

    // Close WebSocket server
    this.wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
}