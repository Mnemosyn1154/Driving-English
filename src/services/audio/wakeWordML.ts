/**
 * Enhanced Wake Word Detection using TensorFlow.js
 * Provides ML-based wake word detection for "헤이 드라이빙" (Hey Driving)
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';

interface WakeWordConfig {
  modelUrl?: string;
  threshold?: number;
  windowSize?: number;
  hopSize?: number;
  melBands?: number;
  sampleRate?: number;
  preEmphasis?: number;
  minFrequency?: number;
  maxFrequency?: number;
}

export class WakeWordDetectorML extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private config: Required<WakeWordConfig>;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isListening = false;
  private audioBuffer: Float32Array[] = [];
  private readonly maxBufferSize = 100; // Store last 100 frames
  private detectionThreshold: number;
  private lastDetectionTime = 0;
  private readonly cooldownPeriod = 2000; // 2 seconds between detections

  constructor(config: WakeWordConfig = {}) {
    super();
    
    this.config = {
      modelUrl: '/models/wake-word/model.json',
      threshold: 0.85,
      windowSize: 400, // 25ms at 16kHz
      hopSize: 160,    // 10ms at 16kHz
      melBands: 40,
      sampleRate: 16000,
      preEmphasis: 0.97,
      minFrequency: 20,
      maxFrequency: 8000,
      ...config
    };

    this.detectionThreshold = this.config.threshold;
  }

  /**
   * Initialize the detector and load the model
   */
  async initialize(): Promise<void> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('WakeWordDetectorML requires a browser environment');
      }

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Try to load the pre-trained model
      try {
        this.model = await tf.loadLayersModel(this.config.modelUrl);
        console.log('Wake word model loaded successfully');
      } catch (error) {
        console.warn('Failed to load pre-trained model, using simple model instead');
        this.model = this.createSimpleModel();
      }

      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize wake word detector:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a simple model for wake word detection
   */
  private createSimpleModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [this.config.melBands, 50, 1], // 500ms window
          filters: 32,
          kernelSize: [4, 4],
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({
          poolSize: [2, 2]
        }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: [4, 4],
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({
          poolSize: [2, 2]
        }),
        tf.layers.flatten(),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Start listening for the wake word
   */
  async startListening(stream?: MediaStream): Promise<void> {
    if (this.isListening) return;

    try {
      if (!this.audioContext) {
        await this.initialize();
      }

      const audioStream = stream || await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const source = this.audioContext!.createMediaStreamSource(audioStream);
      this.analyser = this.audioContext!.createAnalyser();
      this.analyser.fftSize = 2048;
      
      source.connect(this.analyser);

      this.isListening = true;
      this.processAudioLoop();
      
      this.emit('listening');
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process audio in a loop
   */
  private async processAudioLoop(): Promise<void> {
    if (!this.isListening || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const processFrame = async () => {
      if (!this.isListening) return;

      this.analyser!.getFloatTimeDomainData(dataArray);
      
      // Add to buffer
      this.audioBuffer.push(new Float32Array(dataArray));
      if (this.audioBuffer.length > this.maxBufferSize) {
        this.audioBuffer.shift();
      }

      // Process every 10 frames (100ms)
      if (this.audioBuffer.length % 10 === 0 && this.audioBuffer.length >= 50) {
        await this.detectWakeWord();
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  /**
   * Detect wake word in the audio buffer
   */
  private async detectWakeWord(): Promise<void> {
    if (!this.model || this.audioBuffer.length < 50) return;

    // Check cooldown period
    const now = Date.now();
    if (now - this.lastDetectionTime < this.cooldownPeriod) return;

    try {
      // Extract features from audio buffer
      const features = await this.extractFeatures();
      
      // Run inference
      const prediction = await tf.tidy(() => {
        const input = tf.expandDims(features, 0);
        const output = this.model!.predict(input) as tf.Tensor;
        return output.dataSync()[0];
      });

      // Check if wake word detected
      if (prediction > this.detectionThreshold) {
        this.lastDetectionTime = now;
        this.emit('wakeWordDetected', {
          confidence: prediction,
          timestamp: now
        });
        
        // Clear buffer after detection
        this.audioBuffer = [];
      }

      // Emit confidence for monitoring
      this.emit('confidence', prediction);
    } catch (error) {
      console.error('Error during wake word detection:', error);
    }
  }

  /**
   * Extract mel-spectrogram features from audio buffer
   */
  private async extractFeatures(): Promise<tf.Tensor3D> {
    return tf.tidy(() => {
      // Concatenate audio buffer
      const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      const concatenated = new Float32Array(totalLength);
      let offset = 0;
      
      for (const buffer of this.audioBuffer) {
        concatenated.set(buffer, offset);
        offset += buffer.length;
      }

      // Apply pre-emphasis
      const preEmphasized = this.applyPreEmphasis(concatenated);

      // Convert to tensor
      const audioTensor = tf.tensor1d(preEmphasized);

      // Compute STFT
      const stft = tf.signal.stft(
        audioTensor,
        this.config.windowSize,
        this.config.hopSize,
        this.config.windowSize,
        tf.signal.hannWindow
      );

      // Compute magnitude
      const magnitude = tf.abs(stft);

      // Convert to mel-scale
      const melSpectrogram = this.linearToMelScale(magnitude);

      // Convert to log scale
      const logMel = tf.log(tf.add(melSpectrogram, 1e-6));

      // Normalize
      const mean = tf.mean(logMel);
      const std = tf.sqrt(tf.mean(tf.square(tf.sub(logMel, mean))));
      const normalized = tf.div(tf.sub(logMel, mean), std);

      // Reshape for CNN input [height, width, channels]
      return tf.expandDims(normalized, -1) as tf.Tensor3D;
    });
  }

  /**
   * Apply pre-emphasis filter
   */
  private applyPreEmphasis(audio: Float32Array): Float32Array {
    const filtered = new Float32Array(audio.length);
    filtered[0] = audio[0];
    
    for (let i = 1; i < audio.length; i++) {
      filtered[i] = audio[i] - this.config.preEmphasis * audio[i - 1];
    }
    
    return filtered;
  }

  /**
   * Convert linear spectrogram to mel-scale
   */
  private linearToMelScale(spectrogram: tf.Tensor2D): tf.Tensor2D {
    return tf.tidy(() => {
      const [fftBins, timeSteps] = spectrogram.shape;
      
      // Create mel filterbank
      const melMatrix = this.createMelFilterbank(
        fftBins,
        this.config.melBands,
        this.config.sampleRate,
        this.config.minFrequency,
        this.config.maxFrequency
      );

      // Apply mel filterbank
      return tf.matMul(melMatrix, spectrogram);
    });
  }

  /**
   * Create mel filterbank matrix
   */
  private createMelFilterbank(
    fftBins: number,
    melBins: number,
    sampleRate: number,
    minFreq: number,
    maxFreq: number
  ): tf.Tensor2D {
    const minMel = this.frequencyToMel(minFreq);
    const maxMel = this.frequencyToMel(maxFreq);
    
    // Create mel points
    const melPoints = tf.linspace(minMel, maxMel, melBins + 2);
    const frequencies = melPoints.arraySync().map((mel: number) => this.melToFrequency(mel));
    
    // Convert to FFT bin indices
    const bins = frequencies.map(freq => 
      Math.floor((fftBins + 1) * freq / (sampleRate / 2))
    );

    // Create filterbank matrix
    const filterbank = tf.buffer([melBins, fftBins]);
    
    for (let i = 1; i <= melBins; i++) {
      const start = bins[i - 1];
      const center = bins[i];
      const end = bins[i + 1];
      
      // Rising edge
      for (let j = start; j < center; j++) {
        if (j >= 0 && j < fftBins) {
          filterbank.set(
            (j - start) / (center - start),
            i - 1,
            j
          );
        }
      }
      
      // Falling edge
      for (let j = center; j < end; j++) {
        if (j >= 0 && j < fftBins) {
          filterbank.set(
            (end - j) / (end - center),
            i - 1,
            j
          );
        }
      }
    }
    
    return filterbank.toTensor() as tf.Tensor2D;
  }

  /**
   * Convert frequency to mel scale
   */
  private frequencyToMel(frequency: number): number {
    return 2595 * Math.log10(1 + frequency / 700);
  }

  /**
   * Convert mel scale to frequency
   */
  private melToFrequency(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.isListening = false;
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.audioBuffer = [];
    this.emit('stopped');
  }

  /**
   * Update detection threshold
   */
  setThreshold(threshold: number): void {
    this.detectionThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.detectionThreshold;
  }

  /**
   * Train the model with new samples (for future enhancement)
   */
  async trainWithSamples(
    positiveExamples: Float32Array[],
    negativeExamples: Float32Array[]
  ): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // This is a placeholder for future implementation
    // Would require converting audio samples to features and training
    console.log('Training with', positiveExamples.length, 'positive and', negativeExamples.length, 'negative examples');
    
    // TODO: Implement training logic
  }

  /**
   * Save the current model
   */
  async saveModel(path: string = 'downloads://wake-word-model'): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    await this.model.save(path);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopListening();
    
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.removeAllListeners();
  }
}

// Export factory function
export function createWakeWordDetector(config?: WakeWordConfig): WakeWordDetectorML {
  return new WakeWordDetectorML(config);
}