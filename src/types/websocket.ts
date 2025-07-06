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

export type ClientMessage =
  | AuthMessage
  | AudioStreamStartMessage
  | AudioChunkMessage
  | AudioStreamEndMessage
  | CommandMessage;

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

export type ServerMessage =
  | AuthSuccessMessage
  | RecognitionResultMessage
  | AudioResponseMessage
  | ErrorMessage;