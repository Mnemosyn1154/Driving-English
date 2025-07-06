import { SpeechClient } from '@google-cloud/speech';

export interface FallbackOptions {
  useSTT: boolean;
  useTextNLP: boolean;
}

/**
 * Fallback system for when Gemini Audio API fails
 */
export class GeminiFallback {
  private speechClient: SpeechClient;

  constructor() {
    this.speechClient = new SpeechClient();
  }

  /**
   * Process audio using traditional STT + NLP pipeline
   */
  async processWithSTT(audioBuffer: Buffer, config: {
    encoding: 'FLAC' | 'LINEAR16';
    sampleRate: number;
    language: string;
  }): Promise<{
    transcript: string;
    command?: string;
    confidence: number;
  }> {
    try {
      // Step 1: Speech to Text
      const [response] = await this.speechClient.recognize({
        config: {
          encoding: config.encoding,
          sampleRateHertz: config.sampleRate,
          languageCode: config.language,
          enableAutomaticPunctuation: true,
          model: 'command_and_search',
        },
        audio: {
          content: audioBuffer.toString('base64'),
        },
      });

      if (!response.results || response.results.length === 0) {
        throw new Error('No recognition results');
      }

      const result = response.results[0];
      const alternative = result.alternatives?.[0];
      
      if (!alternative) {
        throw new Error('No alternatives in recognition result');
      }

      const transcript = alternative.transcript || '';
      const confidence = alternative.confidence || 0;

      // Step 2: Extract command from transcript
      const command = await this.extractCommandFromText(transcript);

      return {
        transcript,
        command,
        confidence,
      };
    } catch (error) {
      console.error('Fallback STT failed:', error);
      throw error;
    }
  }

  /**
   * Extract command using Gemini text API
   */
  private async extractCommandFromText(text: string): Promise<string | undefined> {
    try {
      // Use Gemini Pro for text understanding
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a voice command parser for a driving English learning app. 
              Extract the command from this user input: "${text}"
              
              Available commands:
              - next_news: go to next news article
              - previous_news: go to previous news article
              - stop: stop playback
              - play: start or resume playback
              - restart: restart from beginning
              - speed_up: increase playback speed
              - slow_down: decrease playback speed
              - explain: explain current sentence
              
              Respond with ONLY the command name or "unknown" if no command matches.`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const command = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      
      return command === 'unknown' ? undefined : command;
    } catch (error) {
      console.error('Failed to extract command with Gemini:', error);
      // Fallback to simple keyword matching
      return this.simpleCommandExtraction(text);
    }
  }

  /**
   * Simple keyword-based command extraction
   */
  private simpleCommandExtraction(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    
    const commandMap: Record<string, string[]> = {
      'next_news': ['다음', 'next', '넥스트'],
      'previous_news': ['이전', 'previous', '전'],
      'stop': ['정지', '멈춰', 'stop', '스톱'],
      'play': ['재생', '시작', 'play', '플레이'],
      'restart': ['처음부터', '다시', 'restart', '리스타트'],
      'speed_up': ['빠르게', 'faster', '빨리'],
      'slow_down': ['천천히', 'slower', '느리게'],
      'explain': ['무슨 뜻', '설명', 'explain', 'what does it mean'],
    };

    for (const [command, keywords] of Object.entries(commandMap)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return command;
      }
    }

    return undefined;
  }

  /**
   * Check if fallback should be used based on error type
   */
  static shouldUseFallback(error: any): boolean {
    // Use fallback for specific error codes
    const fallbackErrorCodes = [
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'RESOURCE_EXHAUSTED',
      'INTERNAL',
    ];

    return fallbackErrorCodes.some(code => 
      error.code === code || error.message?.includes(code)
    );
  }
}