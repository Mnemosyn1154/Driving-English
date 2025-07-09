/**
 * Speech-to-Text Service Types and Interfaces
 */

export interface STTConfig {
  language: string;
  model?: string;
  enableInterimResults?: boolean;
  enablePunctuation?: boolean;
  enableWordTimeOffsets?: boolean;
  maxAlternatives?: number;
  profanityFilter?: boolean;
  speechContexts?: SpeechContext[];
  singleUtterance?: boolean;
  metadata?: Record<string, any>;
}

export interface SpeechContext {
  phrases: string[];
  boost?: number;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: STTAlternative[];
  words?: WordInfo[];
  language?: string;
  timestamp: Date;
}

export interface STTAlternative {
  transcript: string;
  confidence: number;
}

export interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface StreamingSTTConfig extends STTConfig {
  onInterimResult?: (result: STTResult) => void;
  onFinalResult?: (result: STTResult) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
}

export interface AudioChunk {
  data: ArrayBuffer | Buffer;
  timestamp: number;
  duration?: number;
}

export interface STTService {
  // Basic recognition
  recognize(audio: ArrayBuffer | Buffer, config: STTConfig): Promise<STTResult[]>;
  
  // Streaming recognition
  createStream(config: StreamingSTTConfig): STTStream;
  
  // Service management
  isAvailable(): Promise<boolean>;
  getSupportedLanguages(): string[];
  getServiceName(): string;
}

export interface STTStream {
  write(chunk: AudioChunk): void;
  end(): void;
  destroy(): void;
  isPaused(): boolean;
  pause(): void;
  resume(): void;
}

export type STTProvider = 'google' | 'gemini' | 'browser' | 'mock';

export interface STTProviderConfig {
  provider: STTProvider;
  apiKey?: string;
  credentials?: any;
  baseUrl?: string;
  timeout?: number;
}

// Error types
export class STTError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'STTError';
  }
}

export const STTErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_AUDIO: 'INVALID_AUDIO',
  LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;