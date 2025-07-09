/**
 * Google Cloud Speech-to-Text Service
 */

import { SpeechClient } from '@google-cloud/speech';
import { google } from '@google-cloud/speech/build/protos/protos';
import {
  STTService,
  STTStream,
  STTConfig,
  STTResult,
  StreamingSTTConfig,
  AudioChunk,
  STTError,
  STTErrorCodes,
  STTProviderConfig,
  WordInfo,
} from '@/types/stt';

type RecognitionConfig = google.cloud.speech.v1.IRecognitionConfig;
type StreamingRecognitionConfig = google.cloud.speech.v1.IStreamingRecognitionConfig;

export class GoogleSTTService implements STTService {
  private client: SpeechClient;
  private config: STTProviderConfig;

  constructor(config: STTProviderConfig) {
    this.config = config;
    this.client = new SpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  async recognize(audio: ArrayBuffer | Buffer, config: STTConfig): Promise<STTResult[]> {
    try {
      const audioBytes = Buffer.isBuffer(audio) 
        ? audio.toString('base64') 
        : Buffer.from(audio).toString('base64');

      const request = {
        audio: {
          content: audioBytes,
        },
        config: this.buildRecognitionConfig(config),
      };

      const [response] = await this.client.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        return [];
      }

      return response.results
        .filter(result => result.alternatives && result.alternatives.length > 0)
        .map(result => this.convertToSTTResult(result, config.language));
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  createStream(config: StreamingSTTConfig): STTStream {
    return new GoogleSTTStream(this.client, config);
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if credentials are available
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return false;
      }
      
      // Try a simple API call to verify connection
      const [operations] = await this.client.listOperations({});
      return true;
    } catch {
      return false;
    }
  }

  getSupportedLanguages(): string[] {
    // Google STT supports many languages
    return [
      'ko-KR', 'en-US', 'en-GB', 'en-AU', 'en-CA', 
      'ja-JP', 'zh', 'zh-TW', 'es-ES', 'es-MX',
      'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'pt-PT',
      'ru-RU', 'ar-SA', 'hi-IN', 'th-TH', 'vi-VN'
    ];
  }

  getServiceName(): string {
    return 'Google Cloud Speech-to-Text';
  }

  private buildRecognitionConfig(config: STTConfig): RecognitionConfig {
    const recognitionConfig: RecognitionConfig = {
      encoding: google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
      sampleRateHertz: 48000,
      languageCode: config.language || 'ko-KR',
      maxAlternatives: config.maxAlternatives || 1,
      profanityFilter: config.profanityFilter !== false,
      enableWordTimeOffsets: config.enableWordTimeOffsets || false,
      enableAutomaticPunctuation: config.enablePunctuation !== false,
      model: config.model || 'latest_long',
    };

    // Add speech contexts for better recognition
    if (config.speechContexts && config.speechContexts.length > 0) {
      recognitionConfig.speechContexts = config.speechContexts.map(context => ({
        phrases: context.phrases,
        boost: context.boost || 10,
      }));
    }

    return recognitionConfig;
  }

  private convertToSTTResult(
    result: google.cloud.speech.v1.ISpeechRecognitionResult,
    language?: string
  ): STTResult {
    const alternative = result.alternatives![0];
    
    const sttResult: STTResult = {
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      isFinal: true,
      timestamp: new Date(),
      language,
    };

    // Add word timing information if available
    if (alternative.words && alternative.words.length > 0) {
      sttResult.words = alternative.words.map(word => ({
        word: word.word || '',
        startTime: this.convertToSeconds(word.startTime),
        endTime: this.convertToSeconds(word.endTime),
        confidence: word.confidence,
      }));
    }

    // Add alternatives if available
    if (result.alternatives && result.alternatives.length > 1) {
      sttResult.alternatives = result.alternatives.slice(1).map(alt => ({
        transcript: alt.transcript || '',
        confidence: alt.confidence || 0,
      }));
    }

    return sttResult;
  }

  private convertToSeconds(duration: any): number {
    if (!duration) return 0;
    const seconds = parseInt(duration.seconds || '0');
    const nanos = parseInt(duration.nanos || '0');
    return seconds + nanos / 1e9;
  }

  private handleError(error: any): STTError {
    if (error.code === 7) {
      return new STTError(
        'Permission denied. Check your Google Cloud credentials.',
        STTErrorCodes.AUTH_ERROR,
        error
      );
    } else if (error.code === 14) {
      return new STTError(
        'Service unavailable. Please try again later.',
        STTErrorCodes.SERVICE_UNAVAILABLE,
        error
      );
    } else if (error.code === 8) {
      return new STTError(
        'Resource exhausted. You may have exceeded your quota.',
        STTErrorCodes.QUOTA_EXCEEDED,
        error
      );
    }
    
    return new STTError(
      error.message || 'Unknown error occurred',
      STTErrorCodes.UNKNOWN_ERROR,
      error
    );
  }
}

class GoogleSTTStream implements STTStream {
  private stream: any;
  private config: StreamingSTTConfig;
  private isPausedState = false;
  private isEnded = false;

  constructor(client: SpeechClient, config: StreamingSTTConfig) {
    this.config = config;
    this.initializeStream(client);
  }

  private initializeStream(client: SpeechClient): void {
    const streamingConfig: StreamingRecognitionConfig = {
      config: {
        encoding: google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sampleRateHertz: 48000,
        languageCode: this.config.language || 'ko-KR',
        maxAlternatives: this.config.maxAlternatives || 1,
        profanityFilter: this.config.profanityFilter !== false,
        enableAutomaticPunctuation: this.config.enablePunctuation !== false,
        model: this.config.model || 'latest_long',
      },
      interimResults: this.config.enableInterimResults !== false,
      singleUtterance: this.config.singleUtterance || false,
    };

    // Add speech contexts
    if (this.config.speechContexts && this.config.speechContexts.length > 0) {
      streamingConfig.config!.speechContexts = this.config.speechContexts.map(context => ({
        phrases: context.phrases,
        boost: context.boost || 10,
      }));
    }

    this.stream = client.streamingRecognize()
      .on('error', (error: any) => {
        console.error('Google STT stream error:', error);
        if (this.config.onError) {
          this.config.onError(new STTError(
            error.message,
            STTErrorCodes.UNKNOWN_ERROR,
            error
          ));
        }
      })
      .on('data', (data: any) => {
        if (!data.results || data.results.length === 0) return;

        data.results.forEach((result: any) => {
          if (!result.alternatives || result.alternatives.length === 0) return;

          const alternative = result.alternatives[0];
          const sttResult: STTResult = {
            transcript: alternative.transcript || '',
            confidence: alternative.confidence || 0,
            isFinal: result.isFinal || false,
            timestamp: new Date(),
            language: this.config.language,
          };

          // Add word timing if available
          if (alternative.words && alternative.words.length > 0) {
            sttResult.words = alternative.words.map((word: any) => ({
              word: word.word || '',
              startTime: this.convertToSeconds(word.startTime),
              endTime: this.convertToSeconds(word.endTime),
              confidence: word.confidence,
            }));
          }

          if (result.isFinal && this.config.onFinalResult) {
            this.config.onFinalResult(sttResult);
          } else if (!result.isFinal && this.config.onInterimResult) {
            this.config.onInterimResult(sttResult);
          }
        });
      })
      .on('end', () => {
        if (this.config.onEnd) {
          this.config.onEnd();
        }
      });

    // Send initial config
    this.stream.write({
      streamingConfig,
    });
  }

  write(chunk: AudioChunk): void {
    if (!this.isEnded && !this.isPausedState && this.stream) {
      const audioData = Buffer.isBuffer(chunk.data) 
        ? chunk.data 
        : Buffer.from(chunk.data);
      
      this.stream.write({
        audioContent: audioData.toString('base64'),
      });
    }
  }

  end(): void {
    if (this.stream && !this.isEnded) {
      this.isEnded = true;
      this.stream.end();
    }
  }

  destroy(): void {
    this.end();
    if (this.stream) {
      this.stream.destroy();
      this.stream = null;
    }
  }

  isPaused(): boolean {
    return this.isPausedState;
  }

  pause(): void {
    this.isPausedState = true;
  }

  resume(): void {
    this.isPausedState = false;
  }

  private convertToSeconds(duration: any): number {
    if (!duration) return 0;
    const seconds = parseInt(duration.seconds || '0');
    const nanos = parseInt(duration.nanos || '0');
    return seconds + nanos / 1e9;
  }
}