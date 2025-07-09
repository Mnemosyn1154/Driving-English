/**
 * Audio Processing Service
 * Handles audio preprocessing, noise filtering, and format conversion
 */

export interface AudioProcessorConfig {
  sampleRate?: number;
  channels?: number;
  noiseSuppressionLevel?: number; // 0-1
  autoGainControl?: boolean;
  echoCancellation?: boolean;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private config: AudioProcessorConfig;
  
  constructor(config: AudioProcessorConfig = {}) {
    this.config = {
      sampleRate: 48000,
      channels: 1,
      noiseSuppressionLevel: 0.7,
      autoGainControl: true,
      echoCancellation: true,
      ...config,
    };
  }

  /**
   * Initialize audio context
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('AudioProcessor requires browser environment');
    }

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.config.sampleRate,
    });

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Create optimized media stream for voice capture
   */
  async createVoiceStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: this.config.channels,
        sampleRate: this.config.sampleRate,
        echoCancellation: this.config.echoCancellation,
        autoGainControl: this.config.autoGainControl,
        noiseSuppression: true,
        // Advanced constraints for better voice capture
        ...(navigator.mediaDevices.getSupportedConstraints() as any).googNoiseSuppression && {
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googEchoCancellation: true,
          googAutoGainControl: true,
        },
      },
      video: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.processStream(stream);
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw error;
    }
  }

  /**
   * Process audio stream with filters
   */
  private processStream(stream: MediaStream): MediaStream {
    if (!this.audioContext) {
      return stream;
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const destination = this.audioContext.createMediaStreamDestination();

    // Create filter chain
    let currentNode: AudioNode = source;

    // High-pass filter to remove low-frequency noise (road noise)
    const highPassFilter = this.audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 200; // Cut off below 200Hz
    currentNode.connect(highPassFilter);
    currentNode = highPassFilter;

    // Compressor for dynamic range control
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    currentNode.connect(compressor);
    currentNode = compressor;

    // Gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.2; // Slight boost for voice
    currentNode.connect(gainNode);
    currentNode = gainNode;

    // Connect to destination
    currentNode.connect(destination);

    return destination.stream;
  }

  /**
   * Convert audio buffer to target format
   */
  async convertAudioFormat(
    audioBuffer: ArrayBuffer,
    targetSampleRate: number = 16000
  ): Promise<ArrayBuffer> {
    if (!this.audioContext) {
      await this.initialize();
    }

    // Decode audio data
    const audioData = await this.audioContext!.decodeAudioData(audioBuffer.slice(0));
    
    // Create offline context for resampling
    const offlineContext = new OfflineAudioContext(
      1, // mono
      audioData.duration * targetSampleRate,
      targetSampleRate
    );

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioData;
    source.connect(offlineContext.destination);
    source.start();

    // Render audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to ArrayBuffer
    return this.audioBufferToArrayBuffer(renderedBuffer);
  }

  /**
   * Extract audio chunks for streaming
   */
  createAudioChunker(
    stream: MediaStream,
    chunkDuration: number = 100, // ms
    onChunk: (chunk: ArrayBuffer, timestamp: number) => void
  ): AudioChunker {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    let chunks: Float32Array[] = [];
    let lastChunkTime = Date.now();

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(inputData));

      const currentTime = Date.now();
      if (currentTime - lastChunkTime >= chunkDuration) {
        // Combine chunks
        const combinedLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedData = new Float32Array(combinedLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          combinedData.set(chunk, offset);
          offset += chunk.length;
        }

        // Convert to ArrayBuffer
        const buffer = this.float32ToArrayBuffer(combinedData);
        onChunk(buffer, currentTime);

        // Reset
        chunks = [];
        lastChunkTime = currentTime;
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    return {
      stop: () => {
        processor.disconnect();
        source.disconnect();
      },
    };
  }

  /**
   * Analyze audio level for visual feedback
   */
  createAudioAnalyzer(stream: MediaStream): AudioAnalyzer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    return {
      getLevel: () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        return sum / (bufferLength * 255); // Normalize to 0-1
      },
      getFrequencyData: () => {
        analyser.getByteFrequencyData(dataArray);
        return dataArray;
      },
      disconnect: () => {
        source.disconnect();
      },
    };
  }

  /**
   * Convert Float32Array to ArrayBuffer
   */
  private float32ToArrayBuffer(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2); // 16-bit PCM
    const view = new DataView(buffer);
    
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, sample * 0x7FFF, true); // Little-endian
    }
    
    return buffer;
  }

  /**
   * Convert AudioBuffer to ArrayBuffer
   */
  private audioBufferToArrayBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length * audioBuffer.numberOfChannels * 2; // 16-bit
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      let offset = channel * 2;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += audioBuffer.numberOfChannels * 2;
      }
    }
    
    return buffer;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Type definitions
export interface AudioChunker {
  stop: () => void;
}

export interface AudioAnalyzer {
  getLevel: () => number;
  getFrequencyData: () => Uint8Array;
  disconnect: () => void;
}