/**
 * Text-to-Speech Service
 * Uses Gemini for SSML generation and Google Cloud TTS for audio
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
import {
  ITTSService,
  TTSRequest,
  TTSResponse,
  BatchTTSRequest,
  BatchTTSResponse,
  TTSError,
  SSMLOptions,
} from '@/types/translation';
import { SSML_PROMPTS } from '@/config/gemini-prompts';
import { GeminiTranslator } from '../translation/geminiTranslator';
import { AudioCache } from './audioCache';
import { v4 as uuidv4 } from 'uuid';

type SsmlVoiceGender = google.cloud.texttospeech.v1.SsmlVoiceGender;
type AudioEncoding = google.cloud.texttospeech.v1.AudioEncoding;

export class TextToSpeechService implements ITTSService {
  private ttsClient: TextToSpeechClient;
  private geminiTranslator: GeminiTranslator;
  private audioCache: AudioCache;
  private storageBaseUrl: string;

  constructor() {
    this.ttsClient = new TextToSpeechClient();
    this.geminiTranslator = new GeminiTranslator();
    this.audioCache = new AudioCache();
    this.storageBaseUrl = process.env.AUDIO_STORAGE_URL || '/audio';
  }

  /**
   * Synthesize speech for a single text
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(request);
      const cached = await this.audioCache.get(cacheKey);
      if (cached) {
        return {
          id: request.id,
          audioUrl: cached.audioUrl,
          duration: cached.duration,
          format: cached.format as 'mp3',
          sampleRate: 24000,
          timestamp: new Date(),
        };
      }

      // Generate SSML if needed
      let textToSynthesize = request.text;
      if (request.ssml || this.shouldUseSSML(request.text)) {
        textToSynthesize = await this.generateSSML(request.text, request.language);
      }

      // Prepare TTS request
      const ttsRequest = {
        input: request.ssml || textToSynthesize.startsWith('<speak>') 
          ? { ssml: textToSynthesize }
          : { text: textToSynthesize },
        voice: this.getVoiceConfig(request.language, request.voice),
        audioConfig: {
          audioEncoding: 'MP3' as AudioEncoding,
          speakingRate: request.speed || 1.0,
          pitch: request.pitch || 0,
          volumeGainDb: request.volumeGain || 0,
          sampleRateHertz: 24000,
        },
      };

      // Call Google TTS
      const [response] = await this.ttsClient.synthesizeSpeech(ttsRequest);
      
      if (!response.audioContent) {
        throw new Error('No audio content in TTS response');
      }

      // Save audio file
      const audioId = uuidv4();
      const audioUrl = await this.saveAudioFile(audioId, response.audioContent);
      
      // Calculate duration (approximate based on text length and speed)
      const duration = this.estimateDuration(request.text, request.speed || 1.0);

      // Cache the result
      await this.audioCache.set(cacheKey, {
        text: request.text,
        language: request.language,
        audioUrl,
        duration,
        format: 'mp3',
      });

      return {
        id: request.id,
        audioUrl,
        audioBase64: response.audioContent.toString('base64'),
        duration,
        format: 'mp3',
        sampleRate: 24000,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('TTS synthesis error:', error);
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }
  }

  /**
   * Synthesize speech for multiple texts
   */
  async synthesizeBatch(request: BatchTTSRequest): Promise<BatchTTSResponse> {
    const batchId = `tts_batch_${Date.now()}`;
    const audioFiles: TTSResponse[] = [];
    const errors: TTSError[] = [];
    let totalDuration = 0;

    // Process in parallel with concurrency limit
    const concurrencyLimit = 3; // Limit TTS API calls
    const chunks = this.chunkArray(request.requests, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (req) => {
        try {
          const result = await this.synthesize(req);
          audioFiles.push(result);
          totalDuration += result.duration;
        } catch (error: any) {
          errors.push({
            id: req.id,
            code: 'TTS_FAILED',
            message: error.message,
          });
        }
      });

      await Promise.all(promises);
    }

    return {
      batchId,
      audioFiles,
      successCount: audioFiles.length,
      failureCount: errors.length,
      totalDuration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate SSML markup using Gemini
   */
  async generateSSML(text: string, language: string, options?: SSMLOptions): Promise<string> {
    try {
      // Use Gemini to generate SSML
      const prompt = language === 'ko' 
        ? SSML_PROMPTS.korean(text)
        : SSML_PROMPTS.english(text);

      const response = await this.geminiTranslator.translate({
        id: 'ssml',
        text: prompt,
        sourceLanguage: 'en',
        targetLanguage: 'en', // SSML generation, not translation
        type: 'sentence',
      });

      const ssml = response.translatedText;

      // Validate SSML
      if (!ssml.startsWith('<speak>') || !ssml.endsWith('</speak>')) {
        // Wrap in speak tags if not present
        return `<speak>${ssml}</speak>`;
      }

      return ssml;
    } catch (error) {
      console.error('SSML generation error:', error);
      // Fallback to simple SSML
      return this.generateSimpleSSML(text, options);
    }
  }

  /**
   * Generate simple SSML without Gemini
   */
  private generateSimpleSSML(text: string, options?: SSMLOptions): string {
    let ssml = '<speak>';
    
    // 문장 시작 전 짧은 휴지 추가 (자연스러움)
    ssml += '<break time="200ms"/>';
    
    if (options?.pauseBefore) {
      ssml += `<break time="${options.pauseBefore}ms"/>`;
    }
    
    if (options?.rate || options?.pitch || options?.volume) {
      ssml += '<prosody';
      if (options.rate) ssml += ` rate="${options.rate}"`;
      if (options.pitch) ssml += ` pitch="${options.pitch}"`;
      if (options.volume) ssml += ` volume="${options.volume}"`;
      ssml += '>';
    }
    
    if (options?.emphasis) {
      ssml += `<emphasis level="${options.emphasis}">`;
    }
    
    // 문장 내용 처리 - 쉬표와 마침표에 break 추가
    let processedText = this.escapeSSML(text);
    processedText = processedText.replace(/,/g, ',<break time="150ms"/>');
    processedText = processedText.replace(/\./g, '.<break time="250ms"/>');
    processedText = processedText.replace(/\?/g, '?<break time="300ms"/>');
    processedText = processedText.replace(/!/g, '!<break time="300ms"/>');
    
    ssml += processedText;
    
    if (options?.emphasis) {
      ssml += '</emphasis>';
    }
    
    if (options?.rate || options?.pitch || options?.volume) {
      ssml += '</prosody>';
    }
    
    if (options?.pauseAfter) {
      ssml += `<break time="${options.pauseAfter}ms"/>`;
    }
    
    // 문장 끝 휴지 추가
    ssml += '<break time="300ms"/>';
    
    ssml += '</speak>';
    
    return ssml;
  }

  /**
   * Escape text for SSML
   */
  private escapeSSML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get voice configuration
   */
  private getVoiceConfig(language: string, voiceName?: string) {
    if (language === 'ko' || language === 'ko-KR') {
      return {
        languageCode: 'ko-KR',
        name: voiceName || 'ko-KR-WaveNet-A', // WaveNet Female voice (고품질)
        ssmlGender: 'FEMALE' as SsmlVoiceGender,
      };
    } else {
      return {
        languageCode: 'en-US',
        name: voiceName || 'en-US-Studio-O', // Studio voice - 최고 품질 음성
        ssmlGender: 'FEMALE' as SsmlVoiceGender,
      };
    }
  }

  /**
   * Check if text should use SSML
   */
  private shouldUseSSML(text: string): boolean {
    // Use SSML for texts with:
    // - Numbers
    // - Abbreviations
    // - Special punctuation
    // - Long sentences
    return (
      /\d/.test(text) ||
      /[A-Z]{2,}/.test(text) ||
      /[;:—]/.test(text) ||
      text.length > 100
    );
  }

  /**
   * Estimate audio duration
   */
  private estimateDuration(text: string, speed: number): number {
    // Average speaking rate: 150 words per minute
    const words = text.split(/\s+/).length;
    const baseMinutes = words / 150;
    const adjustedMinutes = baseMinutes / speed;
    return Math.ceil(adjustedMinutes * 60); // Convert to seconds
  }

  /**
   * Save audio file (stub - implement with actual storage)
   */
  private async saveAudioFile(audioId: string, audioContent: string | Uint8Array): Promise<string> {
    // TODO: Implement actual file storage (S3, GCS, etc.)
    // For now, return a mock URL
    const audioBuffer = typeof audioContent === 'string' 
      ? Buffer.from(audioContent, 'base64')
      : audioContent;
    
    // In production, save to cloud storage
    // await saveToS3(audioId, audioBuffer);
    
    return `${this.storageBaseUrl}/${audioId}.mp3`;
  }

  /**
   * Get cache key
   */
  private getCacheKey(request: TTSRequest): string {
    return `${request.language}_${request.voice || 'default'}_${
      request.speed || 1
    }_${request.pitch || 0}_${this.hashText(request.text)}`;
  }

  /**
   * Hash text for caching
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Generate audio for news article
   */
  async generateNewsAudio(
    sentences: Array<{ id: string; english: string; korean: string }>
  ): Promise<Array<{ sentenceId: string; englishAudio: string; koreanAudio: string }>> {
    const results = [];

    for (const sentence of sentences) {
      // Generate English audio
      const englishAudio = await this.synthesize({
        id: `${sentence.id}_en`,
        text: sentence.english,
        language: 'en',
        speed: 0.85, // 학습자를 위해 더 천천히
        pitch: -1.0, // 약간 낮은 톤으로 더 편안하게
        ssml: true,
      });

      // Generate Korean audio
      const koreanAudio = await this.synthesize({
        id: `${sentence.id}_ko`,
        text: sentence.korean,
        language: 'ko',
        speed: 0.9, // 한국어는 약간만 느리게
        ssml: true,
      });

      results.push({
        sentenceId: sentence.id,
        englishAudio: englishAudio.audioUrl!,
        koreanAudio: koreanAudio.audioUrl!,
      });
    }

    return results;
  }
}