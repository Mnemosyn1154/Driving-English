/**
 * Hybrid Wake Word Detector
 * Combines ML-based and energy-based detection for improved accuracy
 */

import { EventEmitter } from 'events';
import { WakeWordDetector } from './wakeWord';
import { WakeWordDetectorML } from './wakeWordML';

interface HybridWakeWordConfig {
  mlModelUrl?: string;
  mlThreshold?: number;
  energyThreshold?: number;
  useML?: boolean;
  useEnergy?: boolean;
  requireBoth?: boolean; // If true, both detectors must agree
  sampleRate?: number;
}

interface DetectionResult {
  detected: boolean;
  confidence: number;
  method: 'ml' | 'energy' | 'hybrid';
  details: {
    mlConfidence?: number;
    energyConfidence?: number;
  };
}

export class HybridWakeWordDetector extends EventEmitter {
  private mlDetector: WakeWordDetectorML | null = null;
  private energyDetector: WakeWordDetector | null = null;
  private config: Required<HybridWakeWordConfig>;
  private isInitialized = false;
  private isListening = false;
  private lastDetectionTime = 0;
  private readonly cooldownPeriod = 2000;

  constructor(config: HybridWakeWordConfig = {}) {
    super();
    
    this.config = {
      mlModelUrl: '/models/wake-word/model.json',
      mlThreshold: 0.85,
      energyThreshold: 0.7,
      useML: true,
      useEnergy: true,
      requireBoth: false,
      sampleRate: 16000,
      ...config
    };
  }

  /**
   * Initialize both detectors
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const initPromises = [];

      // Initialize ML detector
      if (this.config.useML) {
        this.mlDetector = new WakeWordDetectorML({
          modelUrl: this.config.mlModelUrl,
          threshold: this.config.mlThreshold,
          sampleRate: this.config.sampleRate
        });

        this.setupMLHandlers();
        
        // Try to initialize ML detector, but don't fail if it doesn't work
        initPromises.push(
          this.mlDetector.initialize().catch(error => {
            console.warn('ML detector initialization failed, falling back to energy-based detection:', error);
            this.config.useML = false;
            this.mlDetector = null;
          })
        );
      }

      // Initialize energy detector
      if (this.config.useEnergy) {
        this.energyDetector = new WakeWordDetector();
        this.setupEnergyHandlers();
        initPromises.push(this.energyDetector.initialize());
      }

      await Promise.all(initPromises);

      // Ensure at least one detector is available
      if (!this.config.useML && !this.config.useEnergy) {
        throw new Error('No wake word detectors available');
      }

      this.isInitialized = true;
      this.emit('initialized', {
        mlEnabled: this.config.useML,
        energyEnabled: this.config.useEnergy
      });
    } catch (error) {
      console.error('Failed to initialize hybrid wake word detector:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup ML detector event handlers
   */
  private setupMLHandlers(): void {
    if (!this.mlDetector) return;

    this.mlDetector.on('wakeWordDetected', (data) => {
      this.handleDetection({
        detected: true,
        confidence: data.confidence,
        method: 'ml',
        details: {
          mlConfidence: data.confidence
        }
      });
    });

    this.mlDetector.on('confidence', (confidence) => {
      this.emit('mlConfidence', confidence);
    });

    this.mlDetector.on('error', (error) => {
      console.error('ML detector error:', error);
      this.emit('mlError', error);
    });
  }

  /**
   * Setup energy detector event handlers
   */
  private setupEnergyHandlers(): void {
    if (!this.energyDetector) return;

    this.energyDetector.on('wakeWordDetected', () => {
      this.handleDetection({
        detected: true,
        confidence: this.config.energyThreshold,
        method: 'energy',
        details: {
          energyConfidence: this.config.energyThreshold
        }
      });
    });

    this.energyDetector.on('speechStart', () => {
      this.emit('speechStart');
    });

    this.energyDetector.on('speechEnd', () => {
      this.emit('speechEnd');
    });

    this.energyDetector.on('volumeChange', (volume) => {
      this.emit('volumeChange', volume);
    });

    this.energyDetector.on('error', (error) => {
      console.error('Energy detector error:', error);
      this.emit('energyError', error);
    });
  }

  /**
   * Handle detection from either detector
   */
  private handleDetection(result: DetectionResult): void {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastDetectionTime < this.cooldownPeriod) {
      return;
    }

    // Store detection for potential correlation
    if (this.config.requireBoth) {
      this.correlateDetections(result);
    } else {
      // Single detector is sufficient
      this.lastDetectionTime = now;
      this.emit('wakeWordDetected', result);
    }
  }

  /**
   * Correlate detections from both detectors
   */
  private pendingDetections = new Map<string, DetectionResult>();
  private correlationTimeout: NodeJS.Timeout | null = null;

  private correlateDetections(result: DetectionResult): void {
    this.pendingDetections.set(result.method, result);

    // Clear any existing timeout
    if (this.correlationTimeout) {
      clearTimeout(this.correlationTimeout);
    }

    // Wait for correlation window (300ms)
    this.correlationTimeout = setTimeout(() => {
      const mlDetection = this.pendingDetections.get('ml');
      const energyDetection = this.pendingDetections.get('energy');

      if (mlDetection && energyDetection) {
        // Both detectors agreed
        const combinedResult: DetectionResult = {
          detected: true,
          confidence: (mlDetection.confidence + energyDetection.confidence) / 2,
          method: 'hybrid',
          details: {
            mlConfidence: mlDetection.details.mlConfidence,
            energyConfidence: energyDetection.details.energyConfidence
          }
        };

        this.lastDetectionTime = Date.now();
        this.emit('wakeWordDetected', combinedResult);
      }

      // Clear pending detections
      this.pendingDetections.clear();
      this.correlationTimeout = null;
    }, 300);
  }

  /**
   * Start listening for wake word
   */
  async startListening(stream?: MediaStream): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isListening) return;

    try {
      const promises = [];

      if (this.mlDetector && this.config.useML) {
        promises.push(this.mlDetector.startListening(stream));
      }

      if (this.energyDetector && this.config.useEnergy) {
        promises.push(this.energyDetector.startListening());
      }

      await Promise.all(promises);

      this.isListening = true;
      this.emit('listening');
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.isListening) return;

    if (this.mlDetector) {
      this.mlDetector.stopListening();
    }

    if (this.energyDetector) {
      this.energyDetector.stopListening();
    }

    this.isListening = false;
    this.pendingDetections.clear();
    
    if (this.correlationTimeout) {
      clearTimeout(this.correlationTimeout);
      this.correlationTimeout = null;
    }

    this.emit('stopped');
  }

  /**
   * Update ML threshold
   */
  setMLThreshold(threshold: number): void {
    this.config.mlThreshold = threshold;
    if (this.mlDetector) {
      this.mlDetector.setThreshold(threshold);
    }
  }

  /**
   * Update energy threshold
   */
  setEnergyThreshold(threshold: number): void {
    this.config.energyThreshold = threshold;
    if (this.energyDetector) {
      this.energyDetector.setThreshold(threshold);
    }
  }

  /**
   * Set detection mode
   */
  setMode(mode: 'ml' | 'energy' | 'hybrid'): void {
    switch (mode) {
      case 'ml':
        this.config.useML = true;
        this.config.useEnergy = false;
        this.config.requireBoth = false;
        break;
      case 'energy':
        this.config.useML = false;
        this.config.useEnergy = true;
        this.config.requireBoth = false;
        break;
      case 'hybrid':
        this.config.useML = true;
        this.config.useEnergy = true;
        this.config.requireBoth = true;
        break;
    }

    // Restart listening if needed
    if (this.isListening) {
      this.stopListening();
      this.startListening();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridWakeWordConfig {
    return { ...this.config };
  }

  /**
   * Get detector status
   */
  getStatus(): {
    initialized: boolean;
    listening: boolean;
    mlEnabled: boolean;
    energyEnabled: boolean;
    mode: 'ml' | 'energy' | 'hybrid';
  } {
    let mode: 'ml' | 'energy' | 'hybrid' = 'energy';
    
    if (this.config.useML && !this.config.useEnergy) {
      mode = 'ml';
    } else if (this.config.useML && this.config.useEnergy) {
      mode = 'hybrid';
    }

    return {
      initialized: this.isInitialized,
      listening: this.isListening,
      mlEnabled: this.config.useML,
      energyEnabled: this.config.useEnergy,
      mode
    };
  }

  /**
   * Train ML model with examples
   */
  async trainWithExamples(
    positiveExamples: Float32Array[],
    negativeExamples: Float32Array[]
  ): Promise<void> {
    if (!this.mlDetector) {
      throw new Error('ML detector not available');
    }

    await this.mlDetector.trainWithSamples(positiveExamples, negativeExamples);
  }

  /**
   * Save ML model
   */
  async saveModel(path?: string): Promise<void> {
    if (!this.mlDetector) {
      throw new Error('ML detector not available');
    }

    await this.mlDetector.saveModel(path);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopListening();

    if (this.mlDetector) {
      this.mlDetector.dispose();
      this.mlDetector = null;
    }

    if (this.energyDetector) {
      this.energyDetector.dispose();
      this.energyDetector = null;
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}

// Export factory function
export function createHybridWakeWordDetector(config?: HybridWakeWordConfig): HybridWakeWordDetector {
  return new HybridWakeWordDetector(config);
}