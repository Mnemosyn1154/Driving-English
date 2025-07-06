/**
 * Audio Encoder Service
 * Handles audio encoding to FLAC or LINEAR16 format
 */

// For FLAC encoding, we'll use libflac.js library
// For now, we'll implement PCM/LINEAR16 encoding which is simpler and supported by Gemini

export type AudioFormat = 'LINEAR16' | 'FLAC';

export interface EncoderConfig {
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitsPerSample?: number;
}

export class AudioEncoder {
  private config: Required<EncoderConfig>;
  private flacEncoder: any = null; // Will be initialized if FLAC is used

  constructor(config: EncoderConfig) {
    this.config = {
      format: config.format,
      sampleRate: config.sampleRate,
      channels: config.channels,
      bitsPerSample: config.bitsPerSample || 16,
    };

    if (this.config.format === 'FLAC') {
      // Initialize FLAC encoder (would require libflac.js)
      console.warn('FLAC encoding not yet implemented, using LINEAR16 instead');
      this.config.format = 'LINEAR16';
    }
  }

  /**
   * Encode audio data
   */
  encode(pcmData: Int16Array): ArrayBuffer {
    switch (this.config.format) {
      case 'LINEAR16':
        return this.encodeLinear16(pcmData);
      case 'FLAC':
        // Fallback to LINEAR16 for now
        return this.encodeLinear16(pcmData);
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  /**
   * Encode to LINEAR16 (raw PCM)
   */
  private encodeLinear16(pcmData: Int16Array): ArrayBuffer {
    // LINEAR16 is just raw PCM data in little-endian format
    const buffer = new ArrayBuffer(pcmData.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < pcmData.length; i++) {
      // Write as little-endian
      view.setInt16(i * 2, pcmData[i], true);
    }

    return buffer;
  }

  /**
   * Encode to base64 for transmission
   */
  encodeToBase64(pcmData: Int16Array): string {
    const buffer = this.encode(pcmData);
    return this.arrayBufferToBase64(buffer);
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }

  /**
   * Decode base64 to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes.buffer;
  }

  /**
   * Get WAV header for PCM data (useful for testing)
   */
  static createWavHeader(pcmData: Int16Array, sampleRate: number, channels: number): ArrayBuffer {
    const length = pcmData.length * 2; // 2 bytes per sample
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true); // File size - 8
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, channels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * channels * 2, true); // ByteRate
    view.setUint16(32, channels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length, true); // Subchunk2Size

    return buffer;
  }

  /**
   * Create a complete WAV file from PCM data
   */
  static createWavFile(pcmData: Int16Array, sampleRate: number, channels: number): ArrayBuffer {
    const header = AudioEncoder.createWavHeader(pcmData, sampleRate, channels);
    const wavBuffer = new ArrayBuffer(header.byteLength + pcmData.length * 2);
    
    // Copy header
    new Uint8Array(wavBuffer).set(new Uint8Array(header), 0);
    
    // Copy PCM data
    const dataView = new DataView(wavBuffer);
    for (let i = 0; i < pcmData.length; i++) {
      dataView.setInt16(44 + i * 2, pcmData[i], true);
    }
    
    return wavBuffer;
  }

  /**
   * Resample audio data (simple linear interpolation)
   */
  static resample(pcmData: Int16Array, fromSampleRate: number, toSampleRate: number): Int16Array {
    if (fromSampleRate === toSampleRate) {
      return pcmData;
    }

    const ratio = fromSampleRate / toSampleRate;
    const outputLength = Math.floor(pcmData.length / ratio);
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.ceil(srcIndex);
      
      if (srcIndexCeil >= pcmData.length) {
        output[i] = pcmData[pcmData.length - 1];
      } else {
        const fraction = srcIndex - srcIndexFloor;
        output[i] = Math.round(
          pcmData[srcIndexFloor] * (1 - fraction) + 
          pcmData[srcIndexCeil] * fraction
        );
      }
    }

    return output;
  }

  /**
   * Apply gain to audio data
   */
  static applyGain(pcmData: Int16Array, gain: number): Int16Array {
    const output = new Int16Array(pcmData.length);
    
    for (let i = 0; i < pcmData.length; i++) {
      const amplified = pcmData[i] * gain;
      // Clamp to prevent overflow
      output[i] = Math.max(-32768, Math.min(32767, Math.round(amplified)));
    }
    
    return output;
  }

  /**
   * Calculate RMS (Root Mean Square) level
   */
  static calculateRMS(pcmData: Int16Array): number {
    let sum = 0;
    
    for (let i = 0; i < pcmData.length; i++) {
      const normalized = pcmData[i] / 32768; // Normalize to [-1, 1]
      sum += normalized * normalized;
    }
    
    return Math.sqrt(sum / pcmData.length);
  }

  /**
   * Detect if audio contains speech (simple voice activity detection)
   */
  static detectVoiceActivity(pcmData: Int16Array, threshold: number = 0.01): boolean {
    const rms = AudioEncoder.calculateRMS(pcmData);
    return rms > threshold;
  }
}