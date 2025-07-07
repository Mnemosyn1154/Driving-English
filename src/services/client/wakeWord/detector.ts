/**
 * Wake Word Detection Service
 * Detects wake words using Web Speech API or custom implementation
 */

import { VoiceActivityDetector, VADConfig } from './voiceActivityDetector';

export interface WakeWordConfig {
  wakeWords: string[];
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  sensitivity?: number; // 0-1, higher = more sensitive
  useVAD?: boolean; // Use Voice Activity Detection
  vadConfig?: VADConfig;
}

export type WakeWordEventType = 'detected' | 'listening' | 'stopped' | 'error';

export interface WakeWordEvent {
  type: WakeWordEventType;
  data?: any;
}

type EventListener = (event: WakeWordEvent) => void;

export class WakeWordDetector {
  private config: WakeWordConfig;
  private recognition: SpeechRecognition | null = null;
  private vad: VoiceActivityDetector | null = null;
  private isListening: boolean = false;
  private listeners: Map<WakeWordEventType, Set<EventListener>> = new Map();
  private lastDetectionTime: number = 0;
  private detectionCooldown: number = 2000; // 2 seconds cooldown
  private isVADActive: boolean = false;

  constructor(config: WakeWordConfig) {
    this.config = {
      language: 'ko-KR',
      continuous: true,
      interimResults: true,
      sensitivity: 0.7,
      useVAD: false,
      ...config,
    };

    // Initialize Web Speech API if available
    this.initializeSpeechRecognition();
    
    // Initialize VAD if requested
    if (this.config.useVAD) {
      this.initializeVAD();
    }
  }

  /**
   * Check if wake word detection is supported
   */
  static isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Initialize Voice Activity Detection
   */
  private async initializeVAD(): Promise<void> {
    try {
      this.vad = new VoiceActivityDetector(this.config.vadConfig);
      await this.vad.initialize();
      
      // Start VAD monitoring
      this.vad.start(
        // On speech start
        () => {
          if (!this.isVADActive && this.recognition) {
            this.isVADActive = true;
            this.recognition.start();
          }
        },
        // On speech end
        () => {
          if (this.isVADActive && this.recognition) {
            this.isVADActive = false;
            // Keep recognition running for a bit to catch the full phrase
            setTimeout(() => {
              if (!this.isVADActive && this.recognition) {
                this.recognition.stop();
              }
            }, 500);
          }
        },
        // On volume change (optional)
        (volume) => {
          // Could emit volume level for UI feedback
        }
      );
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      // Fall back to continuous recognition
      this.config.useVAD = false;
    }
  }

  /**
   * Initialize speech recognition
   */
  private initializeSpeechRecognition(): void {
    if (!WakeWordDetector.isSupported()) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    // Create speech recognition instance
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = this.config.continuous!;
    this.recognition.interimResults = this.config.interimResults!;
    this.recognition.lang = this.config.language!;

    // Set up event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      this.emit('listening', { isListening: true });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('stopped', { isListening: false });
      
      // Restart if continuous mode
      if (this.config.continuous && this.isListening) {
        setTimeout(() => this.start(), 100);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      this.emit('error', { error: event.error });
      
      // Restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setTimeout(() => this.start(), 1000);
      }
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleRecognitionResult(event);
    };
  }

  /**
   * Handle recognition results
   */
  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastDetectionTime < this.detectionCooldown) {
      return;
    }

    // Process all results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.toLowerCase().trim();
      const confidence = result[0].confidence;

      // Check if confidence meets threshold
      if (confidence < this.config.sensitivity!) {
        continue;
      }

      // Check for wake words
      for (const wakeWord of this.config.wakeWords) {
        if (this.containsWakeWord(transcript, wakeWord.toLowerCase())) {
          this.lastDetectionTime = now;
          this.emit('detected', {
            wakeWord,
            transcript,
            confidence,
            isFinal: result.isFinal,
          });
          
          // Stop listening after detection if not continuous
          if (!this.config.continuous) {
            this.stop();
          }
          
          return;
        }
      }
    }
  }

  /**
   * Check if transcript contains wake word
   */
  private containsWakeWord(transcript: string, wakeWord: string): boolean {
    // Simple contains check for now
    // Can be enhanced with fuzzy matching or phonetic matching
    return transcript.includes(wakeWord);
  }

  /**
   * Start listening for wake words
   */
  async start(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    if (this.isListening) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      // Ignore if already started
      if ((error as Error).message.includes('already started')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Add event listener
   */
  on(event: WakeWordEventType, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: WakeWordEventType, listener: EventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: WakeWordEventType, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener({ type: event, data }));
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WakeWordConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if listening
    if (this.isListening) {
      this.stop();
      setTimeout(() => this.start(), 100);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WakeWordConfig {
    return { ...this.config };
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }
}

/**
 * Enhanced wake word detector with custom model support
 * For future implementation with TensorFlow.js or other ML models
 */
export class AdvancedWakeWordDetector extends WakeWordDetector {
  // TODO: Implement custom model-based detection
  // - Load TensorFlow.js model
  // - Process audio in real-time
  // - Run inference on audio chunks
  // - Detect wake words with higher accuracy
}