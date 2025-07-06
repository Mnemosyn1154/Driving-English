/**
 * Translation and TTS Type Definitions
 */

// Translation types
export interface TranslationRequest {
  id: string;
  text: string;
  sourceLanguage: 'en' | 'ko';
  targetLanguage: 'en' | 'ko';
  context?: string;
  type: 'title' | 'summary' | 'sentence' | 'full_article';
}

export interface TranslationResponse {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
  alternativeTranslations?: string[];
  timestamp: Date;
}

export interface BatchTranslationRequest {
  requests: TranslationRequest[];
  priority?: 'high' | 'normal' | 'low';
  deadline?: Date;
}

export interface BatchTranslationResponse {
  batchId: string;
  translations: TranslationResponse[];
  successCount: number;
  failureCount: number;
  errors?: TranslationError[];
}

// TTS types
export interface TTSRequest {
  id: string;
  text: string;
  language: 'en' | 'ko';
  voice?: string;
  speed?: number; // 0.5 to 2.0
  pitch?: number; // -20 to 20
  volumeGain?: number; // -20 to 20
  ssml?: boolean;
}

export interface TTSResponse {
  id: string;
  audioUrl?: string;
  audioBase64?: string;
  duration: number; // in seconds
  format: 'mp3' | 'wav' | 'ogg';
  sampleRate: number;
  timestamp: Date;
}

export interface BatchTTSRequest {
  requests: TTSRequest[];
  outputFormat?: 'mp3' | 'wav' | 'ogg';
  quality?: 'low' | 'medium' | 'high';
}

export interface BatchTTSResponse {
  batchId: string;
  audioFiles: TTSResponse[];
  successCount: number;
  failureCount: number;
  totalDuration: number;
  errors?: TTSError[];
}

// SSML types
export interface SSMLOptions {
  emphasis?: 'strong' | 'moderate' | 'reduced';
  pauseAfter?: number; // milliseconds
  pauseBefore?: number;
  rate?: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast';
  pitch?: 'x-low' | 'low' | 'medium' | 'high' | 'x-high';
  volume?: 'silent' | 'x-soft' | 'soft' | 'medium' | 'loud' | 'x-loud';
}

export interface SSMLBuilder {
  text(content: string, options?: SSMLOptions): SSMLBuilder;
  pause(duration: number): SSMLBuilder;
  emphasis(content: string, level?: 'strong' | 'moderate' | 'reduced'): SSMLBuilder;
  phoneme(text: string, ph: string, alphabet?: string): SSMLBuilder;
  sayAs(text: string, interpretAs: string): SSMLBuilder;
  break(time?: number, strength?: 'x-weak' | 'weak' | 'medium' | 'strong' | 'x-strong'): SSMLBuilder;
  build(): string;
}

// Cache types
export interface TranslationCache {
  key: string;
  originalText: string;
  translatedText: string;
  language: string;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

export interface AudioCache {
  key: string;
  text: string;
  language: string;
  audioUrl: string;
  duration: number;
  format: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
}

// Gemini specific types
export interface GeminiTranslationConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  systemPrompt?: string;
}

export interface GeminiPromptOptions {
  includeExamples?: boolean;
  formalityLevel?: 'formal' | 'neutral' | 'informal';
  preserveFormatting?: boolean;
  technicalTermHandling?: 'preserve' | 'translate' | 'explain';
  targetAudience?: 'general' | 'beginner' | 'intermediate' | 'advanced';
}

// Error types
export interface TranslationError {
  id: string;
  code: string;
  message: string;
  details?: any;
}

export interface TTSError {
  id: string;
  code: string;
  message: string;
  details?: any;
}

// Service interfaces
export interface ITranslationService {
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResponse>;
  reviewTranslation(original: string, translation: string): Promise<{
    isAccurate: boolean;
    suggestions?: string[];
    confidence: number;
  }>;
}

export interface ITTSService {
  synthesize(request: TTSRequest): Promise<TTSResponse>;
  synthesizeBatch(request: BatchTTSRequest): Promise<BatchTTSResponse>;
  generateSSML(text: string, language: string, options?: SSMLOptions): string;
}