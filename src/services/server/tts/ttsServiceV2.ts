/**
 * TTS Service V2
 * Unified Text-to-Speech service using the new cache system
 */

import { DomainCacheHelpers, cacheService } from '../cache/CacheService';
import { CACHE_PREFIX, CACHE_TTL } from '../cache';
import { config } from '@/lib/env';
import { uploadToSupabase } from '@/lib/supabase-storage';

interface TTSOptions {
  language?: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  volumeGainDb?: number;
}

interface TTSResult {
  text: string;
  audioUrl: string;
  cached: boolean;
  duration?: number;
  metadata?: {
    voice: string;
    language: string;
    speed: number;
  };
}

export class TTSServiceV2 {
  private static instance: TTSServiceV2;
  private googleTTSClient: any;
  private initialized = false;

  // Voice configurations
  private voiceConfigs = {
    en: {
      languageCode: 'en-US',
      name: 'en-US-Wavenet-D', // Male voice
      ssmlGender: 'MALE',
    },
    ko: {
      languageCode: 'ko-KR',
      name: 'ko-KR-Wavenet-A', // Female voice
      ssmlGender: 'FEMALE',
    },
  };

  private constructor() {}

  static getInstance(): TTSServiceV2 {
    if (!TTSServiceV2.instance) {
      TTSServiceV2.instance = new TTSServiceV2();
    }
    return TTSServiceV2.instance;
  }

  /**
   * Initialize Google TTS client
   */
  private async initialize() {
    if (this.initialized) return;

    try {
      const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
      
      // Use credentials from environment
      const credentials = config.api.googleCredentials ? 
        JSON.parse(config.api.googleCredentials) : undefined;

      this.googleTTSClient = new TextToSpeechClient({
        projectId: credentials?.project_id,
        keyFilename: credentials ? undefined : process.env.GOOGLE_APPLICATION_CREDENTIALS,
        credentials: credentials,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google TTS:', error);
      throw new Error('TTS service initialization failed');
    }
  }

  /**
   * Generate speech from text with caching
   */
  async generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    const {
      language = 'en',
      voice,
      speed = 1.0,
      pitch = 0.0,
      volumeGainDb = 0.0,
    } = options;

    // Create cache key with options
    const cacheKey = this.createCacheKey(text, language, voice, speed);

    // Check cache first
    const cachedUrl = await DomainCacheHelpers.getCachedAudioUrl(cacheKey, language);
    if (cachedUrl) {
      return {
        text,
        audioUrl: cachedUrl,
        cached: true,
        metadata: {
          voice: voice || this.voiceConfigs[language as keyof typeof this.voiceConfigs]?.name || 'default',
          language,
          speed,
        },
      };
    }

    // Initialize if needed
    await this.initialize();

    try {
      // Get voice configuration
      const voiceConfig = this.voiceConfigs[language as keyof typeof this.voiceConfigs] || this.voiceConfigs.en;
      
      // Construct the request
      const request = {
        input: { text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voice || voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: speed,
          pitch,
          volumeGainDb,
        },
      };

      // Generate audio
      const [response] = await this.googleTTSClient.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('No audio content generated');
      }

      // Upload to storage
      const audioBuffer = Buffer.from(response.audioContent, 'base64');
      const fileName = `tts/${language}/${this.generateFileName(text)}.mp3`;
      const audioUrl = await uploadToSupabase(audioBuffer, fileName, 'audio/mpeg');

      // Cache the URL
      await DomainCacheHelpers.cacheAudioUrl(cacheKey, audioUrl, language);

      // Also cache metadata
      await cacheService.set(
        `${cacheKey}:meta`,
        {
          duration: this.estimateDuration(text, speed),
          size: audioBuffer.length,
          voice: voice || voiceConfig.name,
          generatedAt: Date.now(),
        },
        {
          prefix: CACHE_PREFIX.AUDIO,
          ttl: CACHE_TTL.AUDIO,
          tags: ['tts-meta', language],
        }
      );

      return {
        text,
        audioUrl,
        cached: false,
        duration: this.estimateDuration(text, speed),
        metadata: {
          voice: voice || voiceConfig.name,
          language,
          speed,
        },
      };
    } catch (error) {
      console.error('TTS generation error:', error);
      throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch generate speech for multiple texts
   */
  async batchGenerateSpeech(
    texts: string[],
    options: TTSOptions = {}
  ): Promise<TTSResult[]> {
    const results: TTSResult[] = [];
    
    // Process in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(text => this.generateSpeech(text, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate speech for article sentences
   */
  async generateArticleAudio(
    articleId: string,
    options?: {
      includeTranslations?: boolean;
      languages?: string[];
    }
  ): Promise<{
    generatedCount: number;
    cachedCount: number;
    totalDuration: number;
    errors: string[];
  }> {
    const result = {
      generatedCount: 0,
      cachedCount: 0,
      totalDuration: 0,
      errors: [] as string[],
    };

    try {
      const { prisma } = await import('../database/prisma');
      
      // Get sentences
      const sentences = await prisma.sentence.findMany({
        where: { articleId },
        orderBy: { position: 'asc' },
      });

      const languages = options?.languages || ['en'];
      if (options?.includeTranslations) {
        languages.push('ko');
      }

      // Generate audio for each language
      for (const lang of languages) {
        for (const sentence of sentences) {
          try {
            const text = lang === 'ko' ? sentence.translation : sentence.text;
            if (!text) continue;

            const ttsResult = await this.generateSpeech(text, { language: lang });
            
            // Update sentence with audio URL
            const audioField = lang === 'ko' ? 'audioUrlKo' : 'audioUrlEn';
            await prisma.sentence.update({
              where: { id: sentence.id },
              data: { [audioField]: ttsResult.audioUrl },
            });

            if (ttsResult.cached) {
              result.cachedCount++;
            } else {
              result.generatedCount++;
            }

            result.totalDuration += ttsResult.duration || 0;
          } catch (error) {
            result.errors.push(`Failed to generate audio for sentence ${sentence.id} (${lang}): ${error}`);
          }
        }
      }

      // Update article audio status
      await prisma.article.update({
        where: { id: articleId },
        data: {
          hasAudio: true,
          audioGeneratedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Article audio generation error:', error);
      result.errors.push(`Article audio generation failed: ${error}`);
    }

    return result;
  }

  /**
   * Get audio metadata
   */
  async getAudioMetadata(text: string, language: string = 'en'): Promise<any | null> {
    const cacheKey = this.createCacheKey(text, language);
    return cacheService.get(
      `${cacheKey}:meta`,
      { prefix: CACHE_PREFIX.AUDIO }
    );
  }

  /**
   * Clear audio cache
   */
  async clearCache(language?: string): Promise<void> {
    if (language) {
      await cacheService.deleteByTag(`audio:${language}`);
    } else {
      await DomainCacheHelpers.clearAudioUrls();
    }
  }

  /**
   * Get TTS statistics
   */
  async getStatistics(): Promise<{
    totalGenerated: number;
    cachedCount: number;
    totalDuration: number;
    storageUsed: number;
  }> {
    // This would need to be tracked in a database
    // For now, return cache statistics
    const stats = await cacheService.getStats();
    
    return {
      totalGenerated: 0, // Would need database tracking
      cachedCount: stats.patterns.AUDIO || 0,
      totalDuration: 0, // Would need to sum from metadata
      storageUsed: 0, // Would need to query storage service
    };
  }

  /**
   * Create consistent cache key
   */
  private createCacheKey(text: string, language: string, voice?: string, speed?: number): string {
    // Create hash of text for shorter keys
    const crypto = require('crypto');
    const textHash = crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
    
    let key = `${textHash}:${language}`;
    if (voice) key += `:${voice}`;
    if (speed && speed !== 1.0) key += `:${speed}`;
    
    return key;
  }

  /**
   * Generate safe filename from text
   */
  private generateFileName(text: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const timestamp = Date.now();
    return `${hash.substring(0, 8)}_${timestamp}`;
  }

  /**
   * Estimate audio duration based on text length and speed
   */
  private estimateDuration(text: string, speed: number = 1.0): number {
    // Rough estimate: 150 words per minute at normal speed
    const words = text.split(/\s+/).length;
    const baseMinutes = words / 150;
    const adjustedMinutes = baseMinutes / speed;
    return Math.round(adjustedMinutes * 60); // Return seconds
  }
}

// Export singleton instance
export const ttsServiceV2 = TTSServiceV2.getInstance();