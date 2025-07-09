/**
 * Wake Word Detection Service
 * Uses Web Audio API for browser-based detection without external dependencies
 */

export interface WakeWordConfig {
  wakeWord?: string;
  threshold?: number;
  bufferSize?: number;
  onDetected?: () => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export class WakeWordDetector {
  private config: Required<WakeWordConfig>;
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;
  private energyBuffer: number[] = [];
  private detectionBuffer: Float32Array[] = [];
  private lastDetectionTime = 0;
  private cooldownPeriod = 2000; // 2 seconds cooldown after detection
  private energyThreshold = 0.01; // Minimum energy for speech
  private silenceThreshold = 0.005; // Energy below this is silence
  private speechStartTime = 0;
  private isSpeaking = false;

  constructor(config: WakeWordConfig = {}) {
    this.config = {
      wakeWord: '헤이 드라이빙',
      threshold: 0.7,
      bufferSize: 50,
      onDetected: () => {},
      onReady: () => {},
      onError: () => {},
      ...config,
    };
  }

  /**
   * Initialize the wake word detector
   */
  async initialize(): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio processing pipeline
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      this.dataArray = new Float32Array(this.analyser.fftSize);
      
      console.log('Wake word detector initialized');
      this.config.onReady();
    } catch (error) {
      console.error('Failed to initialize wake word detector:', error);
      this.config.onError(error as Error);
    }
  }

  /**
   * Start listening for wake word
   */
  async startListening(): Promise<void> {
    if (this.isListening || !this.analyser || !this.dataArray) {
      console.warn('Cannot start listening: detector not ready or already listening');
      return;
    }

    this.isListening = true;
    this.detectWakeWord();
    console.log('Started listening for wake word:', this.config.wakeWord);
  }

  /**
   * Stop listening for wake word
   */
  stopListening(): void {
    this.isListening = false;
    console.log('Stopped listening for wake word');
  }

  /**
   * Continuous wake word detection
   */
  private detectWakeWord(): void {
    if (!this.isListening || !this.analyser || !this.dataArray) return;

    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.dataArray);
    
    // Calculate energy
    const energy = this.calculateEnergy(this.dataArray);
    
    // Update energy buffer
    this.energyBuffer.push(energy);
    if (this.energyBuffer.length > this.config.bufferSize) {
      this.energyBuffer.shift();
    }
    
    // Detect speech onset and offset
    const wasSpeaking = this.isSpeaking;
    
    if (!this.isSpeaking && energy > this.energyThreshold) {
      // Speech started
      this.isSpeaking = true;
      this.speechStartTime = Date.now();
      this.detectionBuffer = [];
      console.log('Speech detected, energy:', energy);
    } else if (this.isSpeaking && energy < this.silenceThreshold) {
      // Speech ended
      this.isSpeaking = false;
      const speechDuration = Date.now() - this.speechStartTime;
      
      console.log('Speech ended, duration:', speechDuration, 'ms');
      
      // Check if duration matches wake word (1-2 seconds for "헤이 드라이빙")
      if (speechDuration > 800 && speechDuration < 2000) {
        // Analyze the collected audio
        if (this.analyzeWakeWordPattern()) {
          this.handleDetection();
        }
      }
      
      // Clear detection buffer
      this.detectionBuffer = [];
    }
    
    // If speaking, collect audio samples
    if (this.isSpeaking) {
      // Store a copy of current audio data
      this.detectionBuffer.push(new Float32Array(this.dataArray));
      
      // Keep only last 2 seconds of audio
      const maxBuffers = Math.floor(2 * this.audioContext!.sampleRate / this.analyser.fftSize);
      if (this.detectionBuffer.length > maxBuffers) {
        this.detectionBuffer.shift();
      }
    }
    
    // Continue detection
    requestAnimationFrame(() => this.detectWakeWord());
  }

  /**
   * Analyze collected audio for wake word pattern
   */
  private analyzeWakeWordPattern(): boolean {
    if (this.detectionBuffer.length < 10) return false;
    
    // Extract features from the audio
    const features = this.extractFeatures();
    
    // Simple pattern matching for "헤이 드라이빙"
    // The phrase typically has:
    // 1. Two distinct syllable groups: "헤이" and "드라이빙"
    // 2. A brief pause between them
    // 3. Rising then falling energy pattern
    
    // Find energy peaks
    const energyPattern = this.detectionBuffer.map(buffer => this.calculateEnergy(buffer));
    const peaks = this.findPeaks(energyPattern);
    
    console.log('Found', peaks.length, 'energy peaks in speech');
    
    // We expect at least 2 peaks for "헤이 드라이빙"
    if (peaks.length < 2) return false;
    
    // Check if the pattern matches our wake word
    // This is a simplified check - in production, use more sophisticated pattern matching
    const score = this.calculatePatternScore(features, peaks);
    
    console.log('Wake word pattern score:', score);
    
    return score > this.config.threshold;
  }

  /**
   * Extract audio features for pattern matching
   */
  private extractFeatures(): {
    avgEnergy: number;
    maxEnergy: number;
    zeroCrossingRate: number;
    spectralCentroid: number;
  } {
    let totalEnergy = 0;
    let maxEnergy = 0;
    let totalZeroCrossings = 0;
    let totalSamples = 0;
    
    for (const buffer of this.detectionBuffer) {
      const energy = this.calculateEnergy(buffer);
      totalEnergy += energy;
      maxEnergy = Math.max(maxEnergy, energy);
      
      // Calculate zero crossing rate
      let crossings = 0;
      for (let i = 1; i < buffer.length; i++) {
        if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
          crossings++;
        }
      }
      totalZeroCrossings += crossings;
      totalSamples += buffer.length;
    }
    
    return {
      avgEnergy: totalEnergy / this.detectionBuffer.length,
      maxEnergy,
      zeroCrossingRate: totalZeroCrossings / totalSamples,
      spectralCentroid: 0, // Simplified - would need FFT for actual calculation
    };
  }

  /**
   * Find peaks in energy pattern
   */
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    const threshold = Math.max(...values) * 0.5; // 50% of max as threshold
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > threshold && 
          values[i] > values[i - 1] && 
          values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    
    // Filter out peaks that are too close together
    const filteredPeaks: number[] = [];
    let lastPeak = -10;
    
    for (const peak of peaks) {
      if (peak - lastPeak > 5) { // At least 5 frames apart
        filteredPeaks.push(peak);
        lastPeak = peak;
      }
    }
    
    return filteredPeaks;
  }

  /**
   * Calculate pattern matching score
   */
  private calculatePatternScore(features: any, peaks: number[]): number {
    let score = 0;
    
    // Check energy levels (speech should have moderate energy)
    if (features.avgEnergy > 0.01 && features.avgEnergy < 0.3) {
      score += 0.3;
    }
    
    // Check zero crossing rate (typical for speech)
    if (features.zeroCrossingRate > 0.05 && features.zeroCrossingRate < 0.25) {
      score += 0.2;
    }
    
    // Check number of peaks (2-4 expected for "헤이 드라이빙")
    if (peaks.length >= 2 && peaks.length <= 4) {
      score += 0.3;
    }
    
    // Check peak spacing (should have a gap between "헤이" and "드라이빙")
    if (peaks.length >= 2) {
      const gap = peaks[1] - peaks[0];
      if (gap > 10 && gap < 30) { // Reasonable gap between syllable groups
        score += 0.2;
      }
    }
    
    return score;
  }

  /**
   * Calculate audio energy
   */
  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Handle wake word detection
   */
  private handleDetection(): void {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastDetectionTime < this.cooldownPeriod) {
      console.log('Wake word detected but in cooldown period');
      return;
    }
    
    this.lastDetectionTime = now;
    this.energyBuffer = [];
    this.detectionBuffer = [];
    
    console.log('Wake word detected!', this.config.wakeWord);
    this.config.onDetected();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopListening();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.energyBuffer = [];
    this.detectionBuffer = [];
  }
}

/**
 * Simple pattern-based wake word detector
 * This is a lightweight alternative that uses energy patterns
 */
export class SimpleWakeWordDetector extends WakeWordDetector {
  private patternHistory: string[] = [];
  
  protected analyzeWakeWordPattern(): boolean {
    // Simple pattern matching based on energy levels
    // "헤이 드라이빙" typically has pattern: HIGH-LOW-HIGH-HIGH-LOW
    
    const pattern = this.getEnergyPattern();
    this.patternHistory.push(pattern);
    
    // Keep only recent patterns
    if (this.patternHistory.length > 5) {
      this.patternHistory.shift();
    }
    
    // Check if recent patterns match expected wake word pattern
    const expectedPatterns = [
      'HLH',    // Simplified pattern for "헤이 드라이빙"
      'HLHH',   // With extended ending
      'HHLH',   // With emphasis on first syllable
      'HLHHL',  // Full pattern
    ];
    
    for (const expected of expectedPatterns) {
      if (this.patternHistory.some(p => p.includes(expected))) {
        console.log('Pattern matched:', expected);
        return true;
      }
    }
    
    return false;
  }
  
  private getEnergyPattern(): string {
    if (this.energyBuffer.length < 10) return '';
    
    // Convert energy levels to pattern string
    const avgEnergy = this.energyBuffer.reduce((a, b) => a + b, 0) / this.energyBuffer.length;
    
    return this.energyBuffer
      .map(energy => energy > avgEnergy * 1.2 ? 'H' : 'L')
      .join('')
      .replace(/(.)\1+/g, '$1'); // Remove consecutive duplicates
  }
}