/**
 * Audio Recorder Service
 * Handles microphone capture and audio streaming
 */

export interface AudioRecorderConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioChunk {
  data: Int16Array;
  timestamp: number;
  sequence: number;
}

type RecorderState = 'idle' | 'requesting-permission' | 'ready' | 'recording' | 'error';
type RecorderEventType = 'stateChange' | 'audioChunk' | 'error' | 'permissionDenied';

interface RecorderEvent {
  type: RecorderEventType;
  data?: any;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private state: RecorderState = 'idle';
  private config: Required<AudioRecorderConfig>;
  private sequenceNumber = 0;
  private eventListeners: Map<RecorderEventType, Set<(event: RecorderEvent) => void>> = new Map();

  constructor(config: AudioRecorderConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate || 16000,
      channelCount: config.channelCount || 1,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
    };
  }

  /**
   * Initialize the audio recorder
   */
  async initialize(): Promise<void> {
    try {
      this.setState('requesting-permission');

      // Check browser compatibility
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
      }

      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        }
      });

      // Create audio context with desired sample rate
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Create media stream source
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for capturing audio
      // Buffer size of 4096 provides good balance between latency and performance
      this.processor = this.audioContext.createScriptProcessor(4096, this.config.channelCount, this.config.channelCount);

      this.processor.onaudioprocess = this.handleAudioProcess.bind(this);

      this.setState('ready');
    } catch (error: any) {
      this.setState('error');
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.emit('permissionDenied', error);
      } else {
        this.emit('error', error);
      }
      
      throw error;
    }
  }

  /**
   * Start recording audio
   */
  start(): void {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start recording in state: ${this.state}`);
    }

    if (!this.mediaStreamSource || !this.processor || !this.audioContext) {
      throw new Error('Audio recorder not properly initialized');
    }

    // Connect the audio graph
    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Reset sequence number
    this.sequenceNumber = 0;

    this.setState('recording');
  }

  /**
   * Stop recording audio
   */
  stop(): void {
    if (this.state !== 'recording') {
      return;
    }

    // Disconnect audio graph
    if (this.processor && this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.processor.disconnect();
    }

    this.setState('ready');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stop();

    // Stop all tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaStreamSource = null;
    this.processor = null;
    this.setState('idle');
  }

  /**
   * Handle audio processing
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (this.state !== 'recording') {
      return;
    }

    const inputBuffer = event.inputBuffer;
    const channelData = inputBuffer.getChannelData(0); // Get first channel

    // Convert Float32Array to Int16Array
    const int16Data = this.float32ToInt16(channelData);

    // Create audio chunk
    const chunk: AudioChunk = {
      data: int16Data,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++
    };

    // Emit audio chunk event
    this.emit('audioChunk', chunk);
  }

  /**
   * Convert Float32Array to Int16Array
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp the value between -1 and 1
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));
      // Convert to 16-bit PCM
      int16Array[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    }
    
    return int16Array;
  }

  /**
   * Set recorder state
   */
  private setState(newState: RecorderState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (oldState !== newState) {
      this.emit('stateChange', { oldState, newState });
    }
  }

  /**
   * Get current state
   */
  getState(): RecorderState {
    return this.state;
  }

  /**
   * Check if recorder is recording
   */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  /**
   * Add event listener
   */
  on(event: RecorderEventType, callback: (event: RecorderEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: RecorderEventType, callback: (event: RecorderEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event
   */
  private emit(type: RecorderEventType, data?: any): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event: RecorderEvent = { type, data };
      listeners.forEach(callback => callback(event));
    }
  }

  /**
   * Get supported constraints
   */
  static async getSupportedConstraints(): Promise<MediaTrackSupportedConstraints> {
    if (!navigator.mediaDevices) {
      throw new Error('MediaDevices API not supported');
    }
    return navigator.mediaDevices.getSupportedConstraints();
  }

  /**
   * Check if audio recording is supported
   */
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || (window as any).webkitAudioContext)
    );
  }
}