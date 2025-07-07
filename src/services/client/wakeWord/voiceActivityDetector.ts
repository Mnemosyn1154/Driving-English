/**
 * Voice Activity Detector (VAD)
 * Detects when the user is speaking to save battery and improve accuracy
 */

export interface VADConfig {
  threshold?: number; // 0-1, default 0.01
  debounceTime?: number; // milliseconds, default 300
  silenceTime?: number; // milliseconds, default 1000
}

export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isActive: boolean = false;
  private isSpeaking: boolean = false;
  private config: Required<VADConfig>;
  private silenceTimer: NodeJS.Timeout | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;

  // Callbacks
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;
  private onVolumeChange?: (volume: number) => void;

  constructor(config: VADConfig = {}) {
    this.config = {
      threshold: config.threshold || 0.01,
      debounceTime: config.debounceTime || 300,
      silenceTime: config.silenceTime || 1000,
    };
  }

  /**
   * Initialize VAD with microphone stream
   */
  async initialize(): Promise<void> {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect source to analyser
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      
      // Create data array for frequency data
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.isActive = true;
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      throw error;
    }
  }

  /**
   * Start monitoring voice activity
   */
  start(
    onSpeechStart?: () => void,
    onSpeechEnd?: () => void,
    onVolumeChange?: (volume: number) => void
  ): void {
    if (!this.isActive) {
      throw new Error('VAD not initialized');
    }

    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onVolumeChange = onVolumeChange;

    this.monitor();
  }

  /**
   * Monitor audio levels
   */
  private monitor(): void {
    if (!this.isActive || !this.analyser || !this.dataArray) {
      return;
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    const normalizedVolume = average / 255; // Normalize to 0-1
    
    // Emit volume change
    this.onVolumeChange?.(normalizedVolume);
    
    // Check if speaking
    if (normalizedVolume > this.config.threshold) {
      if (!this.isSpeaking) {
        this.handleSpeechStart();
      }
      
      // Reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isSpeaking) {
      // Start silence timer if not already started
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.handleSpeechEnd();
        }, this.config.silenceTime);
      }
    }
    
    // Continue monitoring
    this.animationId = requestAnimationFrame(() => this.monitor());
  }

  /**
   * Handle speech start
   */
  private handleSpeechStart(): void {
    this.isSpeaking = true;
    this.onSpeechStart?.();
  }

  /**
   * Handle speech end
   */
  private handleSpeechEnd(): void {
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.onSpeechEnd?.();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.isSpeaking = false;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.isActive = false;
    this.dataArray = null;
  }

  /**
   * Get current speaking state
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }
}