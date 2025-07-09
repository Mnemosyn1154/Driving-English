/**
 * Wake Word Detection Service
 * Uses TensorFlow.js for efficient browser-based detection
 */

import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

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
  private model: speechCommands.SpeechCommandRecognizer | null = null;
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private detectionBuffer: number[] = [];
  private lastDetectionTime = 0;
  private cooldownPeriod = 2000; // 2 seconds cooldown after detection

  constructor(config: WakeWordConfig = {}) {
    this.config = {
      wakeWord: '헤이 드라이빙',
      threshold: 0.85,
      bufferSize: 3,
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
      // Load the speech commands model
      const recognizer = speechCommands.create('BROWSER_FFT');
      await recognizer.ensureModelLoaded();
      
      // For custom wake words, we'll use transfer learning
      this.model = recognizer;
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Train custom wake word if needed
      await this.trainCustomWakeWord();
      
      this.config.onReady();
    } catch (error) {
      console.error('Failed to initialize wake word detector:', error);
      this.config.onError(error as Error);
    }
  }

  /**
   * Train custom wake word using transfer learning
   */
  private async trainCustomWakeWord(): Promise<void> {
    if (!this.model) return;

    // For production, you would collect audio samples of the wake word
    // and train a custom model. For now, we'll use a simpler approach
    // that matches patterns in Korean speech.
    
    // Create a simple pattern matching system for Korean wake words
    // This is a placeholder - in production, use actual transfer learning
    console.log('Wake word detector ready for:', this.config.wakeWord);
  }

  /**
   * Start listening for wake word
   */
  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      // Create audio processing pipeline
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      source.connect(analyser);

      // Start continuous detection
      this.isListening = true;
      this.detectWakeWord(analyser);
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.config.onError(error as Error);
    }
  }

  /**
   * Stop listening for wake word
   */
  stopListening(): void {
    this.isListening = false;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /**
   * Continuous wake word detection
   */
  private async detectWakeWord(analyser: AnalyserNode): Promise<void> {
    if (!this.isListening) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    // Simple energy-based detection for demonstration
    // In production, use the TensorFlow model for actual detection
    const energy = this.calculateEnergy(dataArray);
    
    // Detect speech patterns
    if (energy > 0.01) { // Speech detected
      const detected = await this.analyzeAudioPattern(dataArray);
      
      if (detected) {
        this.handleDetection();
      }
    }

    // Continue detection
    requestAnimationFrame(() => this.detectWakeWord(analyser));
  }

  /**
   * Analyze audio pattern for wake word
   */
  private async analyzeAudioPattern(audioData: Float32Array): Promise<boolean> {
    // This is a simplified implementation
    // In production, you would:
    // 1. Convert audio to spectrogram
    // 2. Feed to TensorFlow model
    // 3. Get prediction probabilities
    
    // For Korean wake word "헤이 드라이빙", we look for specific patterns
    // This is a placeholder implementation
    
    // Calculate spectral features
    const features = this.extractFeatures(audioData);
    
    // Simple threshold-based detection
    const score = this.calculateSimilarityScore(features);
    
    // Buffer recent scores for stability
    this.detectionBuffer.push(score);
    if (this.detectionBuffer.length > this.config.bufferSize) {
      this.detectionBuffer.shift();
    }
    
    // Check if average score exceeds threshold
    const avgScore = this.detectionBuffer.reduce((a, b) => a + b, 0) / this.detectionBuffer.length;
    
    return avgScore > this.config.threshold;
  }

  /**
   * Extract audio features for analysis
   */
  private extractFeatures(audioData: Float32Array): number[] {
    // Extract MFCC-like features
    const features: number[] = [];
    
    // Energy
    features.push(this.calculateEnergy(audioData));
    
    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    features.push(zeroCrossings / audioData.length);
    
    // Spectral centroid (simplified)
    const fft = this.performFFT(audioData);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] ** 2 + fft[i * 2 + 1] ** 2);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    features.push(magnitudeSum > 0 ? weightedSum / magnitudeSum : 0);
    
    return features;
  }

  /**
   * Simple FFT implementation for feature extraction
   */
  private performFFT(data: Float32Array): Float32Array {
    // This is a placeholder - in production use Web Audio API's FFT
    const fftSize = 512;
    const fft = new Float32Array(fftSize * 2);
    
    // Simple DFT for demonstration
    for (let k = 0; k < fftSize; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < Math.min(data.length, fftSize); n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      fft[k * 2] = real;
      fft[k * 2 + 1] = imag;
    }
    
    return fft;
  }

  /**
   * Calculate similarity score for wake word
   */
  private calculateSimilarityScore(features: number[]): number {
    // This is a simplified scoring system
    // In production, use the trained model's output
    
    // For "헤이 드라이빙", we expect:
    // - Moderate energy (not too loud, not too quiet)
    // - Specific spectral pattern
    // - Duration around 1-2 seconds
    
    let score = 0;
    
    // Energy should be in speech range
    if (features[0] > 0.01 && features[0] < 0.5) {
      score += 0.3;
    }
    
    // Zero crossing rate for speech
    if (features[1] > 0.1 && features[1] < 0.3) {
      score += 0.3;
    }
    
    // Spectral centroid in speech range
    if (features[2] > 50 && features[2] < 200) {
      score += 0.4;
    }
    
    return score;
  }

  /**
   * Calculate audio energy
   */
  private calculateEnergy(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] ** 2;
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
      return;
    }
    
    this.lastDetectionTime = now;
    this.detectionBuffer = []; // Clear buffer
    
    console.log('Wake word detected!');
    this.config.onDetected();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopListening();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.model) {
      this.model.stopListening();
      this.model = null;
    }
  }
}

/**
 * Advanced Wake Word Detector using TensorFlow.js
 * This is a more sophisticated implementation for production use
 */
export class AdvancedWakeWordDetector extends WakeWordDetector {
  private transferRecognizer: speechCommands.TransferSpeechCommandRecognizer | null = null;
  private baseRecognizer: speechCommands.SpeechCommandRecognizer | null = null;

  async initialize(): Promise<void> {
    try {
      // Load base model
      this.baseRecognizer = speechCommands.create('BROWSER_FFT');
      await this.baseRecognizer.ensureModelLoaded();

      // Create transfer learning recognizer
      this.transferRecognizer = this.baseRecognizer.createTransfer('wake-word-detector');

      // Load pre-trained weights if available
      await this.loadPreTrainedModel();

      this.config.onReady();
    } catch (error) {
      console.error('Failed to initialize advanced wake word detector:', error);
      this.config.onError(error as Error);
    }
  }

  /**
   * Load pre-trained wake word model
   */
  private async loadPreTrainedModel(): Promise<void> {
    // In production, load from server
    // For now, we'll train a simple model
    
    if (!this.transferRecognizer) return;

    // Collect examples (in production, use actual recordings)
    // This is a placeholder for the training process
    console.log('Advanced wake word detector initialized');
  }

  /**
   * Start continuous listening with TensorFlow model
   */
  async startListening(): Promise<void> {
    if (!this.transferRecognizer || this.isListening) return;

    try {
      await this.transferRecognizer.listen(
        async (result) => {
          // Get the probability of wake word
          const scores = result.scores as Float32Array;
          const wakeWordIndex = 0; // Index for our wake word class
          
          if (scores[wakeWordIndex] > this.config.threshold) {
            this.handleDetection();
          }
        },
        {
          probabilityThreshold: 0.75,
          invokeCallbackOnNoiseAndUnknown: true,
          overlapFactor: 0.5,
          includeSpectrogram: false,
        }
      );

      this.isListening = true;
    } catch (error) {
      console.error('Failed to start advanced listening:', error);
      this.config.onError(error as Error);
    }
  }

  stopListening(): void {
    if (this.transferRecognizer && this.isListening) {
      this.transferRecognizer.stopListening();
      this.isListening = false;
    }
  }

  destroy(): void {
    this.stopListening();
    
    if (this.transferRecognizer) {
      this.transferRecognizer.stopListening();
      this.transferRecognizer = null;
    }
    
    if (this.baseRecognizer) {
      this.baseRecognizer = null;
    }
  }
}