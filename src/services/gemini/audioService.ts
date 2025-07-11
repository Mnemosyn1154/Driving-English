/**
 * Gemini Audio API Service
 * Handles real-time audio streaming with Gemini's Audio API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAudioConfig, ConversationMessage } from '@/types/websocket';
import { GeminiLiveAudioClient, LiveAudioResponse, createGeminiLiveAudioClient } from './liveAudioClient';

export interface GeminiAudioServiceConfig {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onAudioResponse?: (audioData: string) => void;
  onError?: (error: Error) => void;
  onConversationUpdate?: (messages: ConversationMessage[]) => void;
  onCommand?: (command: string, transcript: string) => void;
  onVoiceActivity?: (isActive: boolean) => void;
  hybridMode?: boolean; // Enable hybrid STT/Gemini processing
  useLiveAPI?: boolean; // Use Gemini Live Audio API
}

export class GeminiAudioService {
  private config: GeminiAudioServiceConfig;
  private geminiConfig: GeminiAudioConfig;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private liveAudioClient: GeminiLiveAudioClient | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private isStreaming = false;
  private currentAudioBuffer: Buffer[] = [];
  private audioSampleRate = 16000;
  private hybridMode: boolean;
  private useLiveAPI: boolean;
  private systemPrompt = `You are a helpful AI assistant for a driving English learning application. 
Users will speak to you in Korean or English while driving. Your responses should be:
1. Concise and clear for driving safety
2. Helpful for English learning
3. Responsive to voice commands about news, learning, and navigation
4. Always respond in Korean unless specifically asked to speak English

Available commands you can help with:
- "다음 뉴스" (next news)
- "이전 뉴스" (previous news)
- "뉴스 읽어줘" (read news)
- "일시정지" (pause)
- "재생" (play)
- "반복" (repeat)
- "종료" (exit)

When users ask for news, help them find relevant English news articles for learning.
When they ask questions about English, provide helpful explanations.
Keep responses under 20 seconds for driving safety.`;

  constructor(config: GeminiAudioServiceConfig) {
    this.config = config;
    this.hybridMode = config.hybridMode || false;
    this.useLiveAPI = config.useLiveAPI || false;
    this.geminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      maxTokens: 150,
      systemPrompt: this.systemPrompt,
    };

    if (!this.geminiConfig.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(this.geminiConfig.apiKey);
    this.initializeModel();
    
    // Initialize Live Audio client if enabled
    if (this.useLiveAPI) {
      this.initializeLiveAudioClient();
    }
  }

  /**
   * Initialize Gemini model
   */
  private initializeModel(): void {
    try {
      this.model = this.genAI.getGenerativeModel({
        model: this.geminiConfig.model!,
        generationConfig: {
          temperature: this.geminiConfig.temperature,
          maxOutputTokens: this.geminiConfig.maxTokens,
        },
      });
    } catch (error) {
      console.error('Failed to initialize Gemini model:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Initialize Live Audio client
   */
  private initializeLiveAudioClient(): void {
    try {
      this.liveAudioClient = createGeminiLiveAudioClient({
        apiKey: this.geminiConfig.apiKey!,
        model: this.geminiConfig.model,
        language: 'ko-KR',
        sampleRate: this.audioSampleRate,
        enableVAD: true,
        interimResults: true,
        context: this.systemPrompt,
      });

      // Set up event handlers
      this.liveAudioClient.on('transcript', (response: LiveAudioResponse) => {
        if (response.data.text) {
          this.config.onTranscript?.(response.data.text, response.data.isFinal || false);
        }
      });

      this.liveAudioClient.on('response', (response: LiveAudioResponse) => {
        if (response.data.text) {
          // Add to conversation history
          this.conversationHistory.push({
            role: 'assistant',
            content: response.data.text,
            timestamp: Date.now(),
          });
          
          // Generate audio response
          this.generateAudioResponse(response.data.text);
          this.config.onConversationUpdate?.(this.conversationHistory);
        }
      });

      this.liveAudioClient.on('vad', (response: LiveAudioResponse) => {
        this.config.onVoiceActivity?.(response.data.speechDetected || false);
      });

      this.liveAudioClient.on('toolCall', (toolCall: any) => {
        // Handle tool calls (commands)
        if (toolCall.name === 'driving_assistant' && toolCall.parameters?.commands) {
          const command = toolCall.parameters.commands[0];
          const transcript = this.conversationHistory[this.conversationHistory.length - 1]?.content || '';
          this.config.onCommand?.(command, transcript);
        }
      });

      this.liveAudioClient.on('error', (error: Error) => {
        console.error('Live Audio client error:', error);
        this.config.onError?.(error);
      });

      this.liveAudioClient.on('disconnected', ({ code, reason }: any) => {
        console.log('Live Audio client disconnected:', code, reason);
        this.isStreaming = false;
      });

    } catch (error) {
      console.error('Failed to initialize Live Audio client:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Start audio streaming
   */
  async startStream(streamConfig: any): Promise<void> {
    try {
      this.isStreaming = true;
      this.currentAudioBuffer = [];
      
      // Set up audio configuration
      if (streamConfig.sampleRate) {
        this.audioSampleRate = streamConfig.sampleRate;
      }

      // Use Live API if enabled
      if (this.useLiveAPI && this.liveAudioClient) {
        await this.liveAudioClient.connect();
        console.log('Gemini Live Audio stream started');
      } else {
        console.log('Gemini audio stream started (standard mode)');
      }
      
      // Initialize conversation with system prompt
      if (this.conversationHistory.length === 0) {
        this.conversationHistory.push({
          role: 'system',
          content: this.systemPrompt,
          timestamp: Date.now(),
        });
      }

    } catch (error) {
      console.error('Failed to start Gemini audio stream:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Process audio chunk
   */
  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.isStreaming) {
      throw new Error('Audio stream not started');
    }

    try {
      // Use Live API if enabled
      if (this.useLiveAPI && this.liveAudioClient?.connected) {
        // Convert Buffer to ArrayBuffer for Live API
        const arrayBuffer = audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength
        );
        await this.liveAudioClient.sendAudio(arrayBuffer);
      } else {
        // Original buffering approach
        this.currentAudioBuffer.push(audioData);

        // Process accumulated audio every 2 seconds
        const totalDuration = this.currentAudioBuffer.length * 1024 / this.audioSampleRate;
        
        if (totalDuration >= 2.0) {
          await this.processAccumulatedAudio();
        }
      }

    } catch (error) {
      console.error('Failed to process audio chunk:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Process accumulated audio (simulated transcription)
   */
  private async processAccumulatedAudio(): Promise<void> {
    try {
      // Combine audio buffers
      const combinedAudio = Buffer.concat(this.currentAudioBuffer);
      
      if (this.hybridMode) {
        // Use hybrid processing
        await this.processWithHybridMode(combinedAudio);
      } else {
        // Original flow - simulate transcription
        const simulatedTranscript = this.simulateTranscription(combinedAudio);
        
        if (simulatedTranscript) {
          // Send interim result
          this.config.onTranscript?.(simulatedTranscript, false);
          
          // Process with Gemini
          await this.processTextWithGemini(simulatedTranscript);
        }
      }

      // Clear buffer
      this.currentAudioBuffer = [];

    } catch (error) {
      console.error('Failed to process accumulated audio:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Process with hybrid mode (STT first, then Gemini if needed)
   */
  private async processWithHybridMode(audioData: Buffer): Promise<void> {
    try {
      // Convert audio to base64
      const base64Audio = `data:audio/webm;base64,${audioData.toString('base64')}`;
      
      // 1. Try STT first
      console.log('Hybrid mode: Trying STT first...');
      const sttResponse = await fetch('/api/stt-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (!sttResponse.ok) {
        throw new Error('STT request failed');
      }

      const sttResult = await sttResponse.json();

      if (sttResult.type === 'command') {
        // Clear command detected
        console.log('Hybrid mode: Command detected:', sttResult.payload);
        this.config.onTranscript?.(sttResult.transcript, true);
        this.config.onCommand?.(sttResult.payload, sttResult.transcript);
        
        // Add to conversation history
        this.conversationHistory.push({
          role: 'user',
          content: sttResult.transcript,
          timestamp: Date.now(),
        });
        
        this.config.onConversationUpdate?.(this.conversationHistory);
        return;
      }

      // 2. Fallback to Gemini
      console.log('Hybrid mode: Falling back to Gemini...');
      const geminiResponse = await fetch('/api/gemini-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audio: base64Audio,
          context: {
            previousTranscripts: this.conversationHistory
              .filter(msg => msg.role === 'user')
              .slice(-3)
              .map(msg => msg.content),
          }
        }),
      });

      if (!geminiResponse.ok) {
        throw new Error('Gemini request failed');
      }

      const geminiResult = await geminiResponse.json();
      
      // Process Gemini result
      this.config.onTranscript?.(geminiResult.transcription, true);
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: geminiResult.transcription,
        timestamp: Date.now(),
      });

      if (geminiResult.response) {
        this.conversationHistory.push({
          role: 'assistant',
          content: geminiResult.response,
          timestamp: Date.now(),
        });
        
        // Generate audio response
        await this.generateAudioResponse(geminiResult.response);
      }

      // Check if there's a command in context
      if (geminiResult.context?.command) {
        this.config.onCommand?.(geminiResult.context.command, geminiResult.transcription);
      }

      this.config.onConversationUpdate?.(this.conversationHistory);

    } catch (error) {
      console.error('Hybrid processing failed:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Simulate transcription (placeholder)
   */
  private simulateTranscription(audioData: Buffer): string | null {
    // This is a placeholder - in a real implementation, you would:
    // 1. Convert audio to the format expected by Gemini
    // 2. Send to Gemini's audio API
    // 3. Return the transcription
    
    // For now, we'll return null to indicate no transcription
    // The actual implementation would use Gemini's multimodal capabilities
    return null;
  }

  /**
   * Process text with Gemini
   */
  private async processTextWithGemini(text: string): Promise<void> {
    try {
      // Add user message to conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(userMessage);

      // Prepare conversation context
      const conversationContext = this.conversationHistory
        .filter(msg => msg.role !== 'system')
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = `${this.systemPrompt}\n\n이전 대화:\n${conversationContext}\n\n사용자: ${text}\n\n응답:`;

      // Generate response
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();

      // Add assistant response to conversation
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(assistantMessage);

      // Send final transcript
      this.config.onTranscript?.(text, true);

      // Convert response to audio and send back
      await this.generateAudioResponse(responseText);

      // Update conversation
      this.config.onConversationUpdate?.(this.conversationHistory);

    } catch (error) {
      console.error('Failed to process text with Gemini:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Generate audio response
   */
  private async generateAudioResponse(text: string): Promise<void> {
    try {
      // For now, we'll use the existing TTS API
      // In a full implementation, you might use Gemini's audio generation
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language: 'ko-KR',
          voice: 'ko-KR-Standard-A',
        }),
      });

      if (!response.ok) {
        throw new Error('TTS generation failed');
      }

      const result = await response.json();
      
      if (result.audioUrl) {
        // Fetch audio data
        const audioResponse = await fetch(result.audioUrl);
        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        
        // Send audio response
        this.config.onAudioResponse?.(audioBase64);
      }

    } catch (error) {
      console.error('Failed to generate audio response:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Process command
   */
  async processCommand(command: string, context?: Record<string, any>): Promise<void> {
    try {
      console.log('Processing command:', command, context);
      
      // Process command as text
      await this.processTextWithGemini(command);

    } catch (error) {
      console.error('Failed to process command:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * End audio stream
   */
  async endStream(): Promise<void> {
    try {
      this.isStreaming = false;
      
      // Disconnect Live API if used
      if (this.useLiveAPI && this.liveAudioClient) {
        this.liveAudioClient.disconnect();
      } else {
        // Process any remaining audio in standard mode
        if (this.currentAudioBuffer.length > 0) {
          await this.processAccumulatedAudio();
        }
      }

      console.log('Gemini audio stream ended');

    } catch (error) {
      console.error('Failed to end audio stream:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory.filter(msg => msg.role !== 'system');
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: this.systemPrompt,
        timestamp: Date.now(),
      }
    ];
  }

  /**
   * Set system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    this.geminiConfig.systemPrompt = prompt;
    
    // Update conversation history
    if (this.conversationHistory.length > 0 && this.conversationHistory[0].role === 'system') {
      this.conversationHistory[0].content = prompt;
      this.conversationHistory[0].timestamp = Date.now();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GeminiAudioConfig>): void {
    this.geminiConfig = { ...this.geminiConfig, ...config };
    
    // Re-initialize model if needed
    if (config.model || config.temperature || config.maxTokens) {
      this.initializeModel();
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.geminiConfig.apiKey && !!this.model;
  }

  /**
   * Send text message (for testing or fallback)
   */
  async sendText(text: string): Promise<void> {
    if (this.useLiveAPI && this.liveAudioClient?.connected) {
      this.liveAudioClient.sendText(text);
    } else {
      // Process as regular text
      await this.processTextWithGemini(text);
    }
  }

  /**
   * Update live context
   */
  updateLiveContext(context: string): void {
    if (this.liveAudioClient) {
      this.liveAudioClient.updateContext(context);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.isStreaming = false;
    this.currentAudioBuffer = [];
    this.conversationHistory = [];
    
    if (this.liveAudioClient) {
      this.liveAudioClient.disconnect();
      this.liveAudioClient = null;
    }
  }
}