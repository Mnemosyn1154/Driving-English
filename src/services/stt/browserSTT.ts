/**
 * Browser-based Speech Recognition Service
 * Uses Web Speech API as fallback
 */

import {
  STTService,
  STTStream,
  STTConfig,
  STTResult,
  StreamingSTTConfig,
  AudioChunk,
  STTError,
  STTErrorCodes,
} from '@/types/stt';

export class BrowserSTTService implements STTService {
  private recognition: any;
  
  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
      }
    }
  }

  async recognize(audio: ArrayBuffer | Buffer, config: STTConfig): Promise<STTResult[]> {
    throw new STTError(
      'Browser STT does not support audio buffer input',
      STTErrorCodes.INVALID_AUDIO
    );
  }

  createStream(config: StreamingSTTConfig): STTStream {
    if (!this.recognition) {
      throw new STTError(
        'Speech recognition not supported in this browser',
        STTErrorCodes.SERVICE_UNAVAILABLE
      );
    }

    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = config.enableInterimResults !== false;
    this.recognition.lang = config.language || 'ko-KR';
    this.recognition.maxAlternatives = config.maxAlternatives || 1;

    const stream = new BrowserSTTStream(this.recognition, config);
    return stream;
  }

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 
           (!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }

  getSupportedLanguages(): string[] {
    // Common languages supported by most browsers
    return [
      'ko-KR', 'en-US', 'en-GB', 'ja-JP', 'zh-CN', 
      'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR'
    ];
  }

  getServiceName(): string {
    return 'Browser Speech Recognition';
  }
}

class BrowserSTTStream implements STTStream {
  private recognition: any;
  private config: StreamingSTTConfig;
  private isActive = false;
  private isPausedState = false;

  constructor(recognition: any, config: StreamingSTTConfig) {
    this.recognition = recognition;
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.recognition.onstart = () => {
      this.isActive = true;
      console.log('Browser speech recognition started');
    };

    this.recognition.onend = () => {
      this.isActive = false;
      if (this.config.onEnd) {
        this.config.onEnd();
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Browser speech recognition error:', event.error);
      if (this.config.onError) {
        this.config.onError(new STTError(
          event.error,
          STTErrorCodes.UNKNOWN_ERROR,
          event
        ));
      }
    };

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.9;

        const sttResult: STTResult = {
          transcript,
          confidence,
          isFinal: result.isFinal,
          timestamp: new Date(),
          language: this.config.language,
        };

        // Add alternatives if available
        if (result.length > 1) {
          sttResult.alternatives = Array.from(result).slice(1).map((alt: any) => ({
            transcript: alt.transcript,
            confidence: alt.confidence || 0,
          }));
        }

        if (result.isFinal && this.config.onFinalResult) {
          this.config.onFinalResult(sttResult);
        } else if (!result.isFinal && this.config.onInterimResult) {
          this.config.onInterimResult(sttResult);
        }
      }
    };
  }

  write(chunk: AudioChunk): void {
    // Browser STT doesn't support audio chunks
    // It works directly with microphone
    if (!this.isActive && !this.isPausedState) {
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  }

  end(): void {
    if (this.isActive) {
      this.recognition.stop();
    }
  }

  destroy(): void {
    this.end();
    // Remove event handlers
    this.recognition.onstart = null;
    this.recognition.onend = null;
    this.recognition.onerror = null;
    this.recognition.onresult = null;
  }

  isPaused(): boolean {
    return this.isPausedState;
  }

  pause(): void {
    if (this.isActive) {
      this.recognition.stop();
      this.isPausedState = true;
    }
  }

  resume(): void {
    if (this.isPausedState) {
      this.isPausedState = false;
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Failed to resume recognition:', error);
      }
    }
  }
}