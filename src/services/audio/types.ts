/**
 * Audio Service Types and Interfaces
 */

import { STTResult } from '@/types/stt';
import { ConversationMessage } from '@/types/websocket';

// Audio Service Configuration
export interface AudioServiceConfig {
  sttProvider: 'google' | 'gemini';
  ttsProvider: 'google' | 'gemini';
  defaultLanguage: string;
  enableNoiseFilter: boolean;
  enableAutoGainControl: boolean;
  commandTimeout: number;
  geminiApiKey?: string;
  googleCredentials?: string;
}

// Audio Stream Configuration
export interface AudioStreamConfig {
  sampleRate: number;
  format: 'FLAC' | 'LINEAR16' | 'WEBM_OPUS';
  language: string;
  enableInterimResults: boolean;
  enablePunctuation: boolean;
  singleUtterance: boolean;
  speechContexts?: SpeechContext[];
}

// Speech Context for better recognition
export interface SpeechContext {
  phrases: string[];
  boost?: number;
}

// Audio Service Mode
export type AudioServiceMode = 'command' | 'conversation' | 'idle';

// Command Action Types
export type ActionType = 
  | 'search_news'
  | 'select_article'
  | 'navigation'
  | 'playback_control'
  | 'volume_control'
  | 'help'
  | 'start_conversation'
  | 'end_conversation'
  | 'unknown';

// Command Action
export interface Action {
  type: ActionType;
  params?: Record<string, any>;
  confidence: number;
  source: 'pattern' | 'gemini';
}

// Audio Service Events
export interface AudioServiceEvents {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onCommand: (command: string, action: Action) => void;
  onAudioResponse: (audioData: string, text: string) => void;
  onModeChange: (mode: AudioServiceMode) => void;
  onError: (error: AudioServiceError) => void;
  onConversationUpdate: (messages: ConversationMessage[]) => void;
  onStreamStatusChange: (status: StreamStatus) => void;
}

// Stream Status
export type StreamStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'error';

// Audio Service Error
export class AudioServiceError extends Error {
  constructor(
    message: string,
    public code: AudioServiceErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

// Error Codes
export enum AudioServiceErrorCode {
  // Provider errors
  PROVIDER_NOT_AVAILABLE = 'PROVIDER_NOT_AVAILABLE',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  
  // Stream errors
  STREAM_NOT_STARTED = 'STREAM_NOT_STARTED',
  STREAM_ALREADY_ACTIVE = 'STREAM_ALREADY_ACTIVE',
  STREAM_ERROR = 'STREAM_ERROR',
  
  // Processing errors
  TRANSCRIPTION_ERROR = 'TRANSCRIPTION_ERROR',
  TTS_ERROR = 'TTS_ERROR',
  COMMAND_PROCESSING_ERROR = 'COMMAND_PROCESSING_ERROR',
  
  // Mode errors
  INVALID_MODE = 'INVALID_MODE',
  MODE_TRANSITION_ERROR = 'MODE_TRANSITION_ERROR',
  
  // General errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Provider Interfaces
export interface AudioProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  initialize(config: any): Promise<void>;
  cleanup(): void;
}

export interface STTProvider extends AudioProvider {
  startStream(config: AudioStreamConfig): Promise<void>;
  processAudioChunk(chunk: Buffer): Promise<void>;
  endStream(): Promise<void>;
  onResult: (result: STTResult) => void;
}

export interface TTSProvider extends AudioProvider {
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
}

export interface TTSOptions {
  language: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export interface TTSResult {
  audioData: string; // base64
  format: string;
  duration: number;
}

// Command Parser Result
export interface CommandParseResult {
  text: string;
  action: Action;
  requiresGemini: boolean;
  metadata?: Record<string, any>;
}

// Conversation Context
export interface ConversationContext {
  mode: AudioServiceMode;
  history: ConversationMessage[];
  currentCommand?: string;
  lastAction?: Action;
  metadata: Record<string, any>;
}