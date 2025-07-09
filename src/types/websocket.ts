// WebSocket message types for client-server communication
export interface BaseMessage {
  type: string;
  timestamp: number;
}

export interface AuthMessage extends BaseMessage {
  type: 'auth';
  token: string;
}

export interface AudioStreamStartMessage extends BaseMessage {
  type: 'audio_stream_start';
  config: {
    sampleRate: number;
    format: 'FLAC' | 'LINEAR16';
    language: string;
  };
}

export interface AudioChunkMessage extends BaseMessage {
  type: 'audio_chunk';
  data: string; // base64 encoded
  sequence: number;
}

export interface AudioStreamEndMessage extends BaseMessage {
  type: 'audio_stream_end';
  duration: number;
}

export interface CommandMessage extends BaseMessage {
  type: 'command';
  command: string;
  context?: Record<string, any>;
}

export interface HybridModeMessage extends BaseMessage {
  type: 'hybrid_mode';
  enabled: boolean;
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export type ClientMessage =
  | AuthMessage
  | AudioStreamStartMessage
  | AudioChunkMessage
  | AudioStreamEndMessage
  | CommandMessage
  | HybridModeMessage
  | PingMessage;

// Server response types
export interface AuthSuccessMessage extends BaseMessage {
  type: 'auth_success';
  sessionId: string;
  userId: string;
}

export interface RecognitionResultMessage extends BaseMessage {
  type: 'recognition_result';
  transcript: string;
  confidence: number;
  command?: string;
  isFinal: boolean;
}

export interface AudioResponseMessage extends BaseMessage {
  type: 'audio_response';
  data: string; // base64 encoded
  format: string;
  duration: number;
  text: string;
  language: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
  details?: any;
}

export interface AuthRequiredMessage extends BaseMessage {
  type: 'auth_required';
  message: string;
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

export interface StreamStatusMessage extends BaseMessage {
  type: 'stream_status';
  status: 'started' | 'stopped' | 'paused' | 'resumed';
  message?: string;
}

export type ServerMessage =
  | AuthSuccessMessage
  | AuthRequiredMessage
  | RecognitionResultMessage
  | AudioResponseMessage
  | ErrorMessage
  | PongMessage
  | StreamStatusMessage;

// WebSocket Connection States
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';

// Gemini Audio Service Configuration
export interface GeminiAudioConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Error Codes
export const WebSocketErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_LOST: 'CONNECTION_LOST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Audio processing errors
  AUDIO_PROCESSING_FAILED: 'AUDIO_PROCESSING_FAILED',
  STREAM_START_FAILED: 'STREAM_START_FAILED',
  STREAM_END_FAILED: 'STREAM_END_FAILED',
  STREAM_NOT_STARTED: 'STREAM_NOT_STARTED',
  
  // Gemini API errors
  GEMINI_ERROR: 'GEMINI_ERROR',
  GEMINI_QUOTA_EXCEEDED: 'GEMINI_QUOTA_EXCEEDED',
  GEMINI_UNAVAILABLE: 'GEMINI_UNAVAILABLE',
  
  // General errors
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNKNOWN_MESSAGE_TYPE: 'UNKNOWN_MESSAGE_TYPE',
  COMMAND_PROCESSING_FAILED: 'COMMAND_PROCESSING_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;