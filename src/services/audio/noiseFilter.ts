/**
 * Advanced Noise Filtering for Driving Environment
 * Optimized for car noise, wind, and road sounds
 */

export interface NoiseFilterConfig {
  aggressiveness?: number; // 0-1, higher = more aggressive
  targetSNR?: number; // Target signal-to-noise ratio in dB
  adaptiveMode?: boolean; // Adapt to changing noise conditions
}

export class DrivingNoiseFilter {
  private audioContext: AudioContext;
  private config: NoiseFilterConfig;
  private noiseProfile: Float32Array | null = null;
  private isCalibrating = false;

  constructor(audioContext: AudioContext, config: NoiseFilterConfig = {}) {
    this.audioContext = audioContext;
    this.config = {
      aggressiveness: 0.7,
      targetSNR: 20,
      adaptiveMode: true,
      ...config,
    };
  }

  /**
   * Create a noise-filtered audio node chain
   */
  createFilterChain(source: AudioNode): AudioNode {
    // Multi-band noise gate for different frequency ranges
    const bands = [
      { freq: 80, type: 'highpass' as BiquadFilterType }, // Remove rumble
      { freq: 250, type: 'peaking' as BiquadFilterType, gain: -3 }, // Reduce road noise
      { freq: 500, type: 'peaking' as BiquadFilterType, gain: -2 }, // Engine noise
      { freq: 2000, type: 'peaking' as BiquadFilterType, gain: 2 }, // Boost voice clarity
      { freq: 4000, type: 'peaking' as BiquadFilterType, gain: 1 }, // Presence
      { freq: 8000, type: 'lowpass' as BiquadFilterType }, // Remove high-freq noise
    ];

    let currentNode: AudioNode = source;

    // Apply filters for each band
    bands.forEach(band => {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.freq;
      
      if (band.type === 'peaking' && band.gain) {
        filter.gain.value = band.gain;
        filter.Q.value = 1.5;
      }

      currentNode.connect(filter);
      currentNode = filter;
    });

    // Spectral noise gate
    const noiseGate = this.createSpectralNoiseGate(currentNode);
    
    // Adaptive gain control
    const agc = this.createAdaptiveGainControl(noiseGate);

    return agc;
  }

  /**
   * Create spectral noise gate
   */
  private createSpectralNoiseGate(input: AudioNode): AudioNode {
    const fftSize = 2048;
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.8;

    const scriptProcessor = this.audioContext.createScriptProcessor(fftSize, 1, 1);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 0.3 * this.config.aggressiveness!;

    scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);

      analyser.getByteFrequencyData(freqData);

      // Calculate average energy
      let totalEnergy = 0;
      for (let i = 0; i < freqData.length; i++) {
        totalEnergy += freqData[i] / 255;
      }
      const avgEnergy = totalEnergy / freqData.length;

      // Apply gate based on energy
      const gateOpen = avgEnergy > threshold;
      const gain = gateOpen ? 1 : 0.1;

      // Smooth transition
      for (let i = 0; i < inputBuffer.length; i++) {
        outputBuffer[i] = inputBuffer[i] * gain;
      }
    };

    input.connect(analyser);
    input.connect(scriptProcessor);

    return scriptProcessor;
  }

  /**
   * Create adaptive gain control
   */
  private createAdaptiveGainControl(input: AudioNode): AudioNode {
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;

    const makeupGain = this.audioContext.createGain();
    makeupGain.gain.value = 2;

    input.connect(compressor);
    compressor.connect(makeupGain);

    // Adaptive adjustment based on input level
    if (this.config.adaptiveMode) {
      this.startAdaptiveAdjustment(input, makeupGain);
    }

    return makeupGain;
  }

  /**
   * Start adaptive noise adjustment
   */
  private startAdaptiveAdjustment(input: AudioNode, gainNode: GainNode): void {
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    input.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let smoothedLevel = 0;

    const adjust = () => {
      if (!this.config.adaptiveMode) return;

      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Smooth the level changes
      smoothedLevel = smoothedLevel * 0.9 + rms * 0.1;

      // Adjust gain based on noise level
      const targetLevel = 0.5;
      const currentGain = gainNode.gain.value;
      const desiredGain = targetLevel / (smoothedLevel + 0.001);
      const newGain = Math.max(0.5, Math.min(3, desiredGain));

      // Slowly adjust gain
      gainNode.gain.setTargetAtTime(newGain, this.audioContext.currentTime, 0.5);

      requestAnimationFrame(adjust);
    };

    adjust();
  }

  /**
   * Calibrate noise profile (for future enhancement)
   */
  async calibrateNoiseProfile(duration: number = 2000): Promise<void> {
    this.isCalibrating = true;
    
    // Collect noise samples for the specified duration
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    source.connect(analyser);
    
    const samples: Float32Array[] = [];
    const sampleInterval = 100; // ms
    const numSamples = duration / sampleInterval;
    
    for (let i = 0; i < numSamples; i++) {
      await new Promise(resolve => setTimeout(resolve, sampleInterval));
      
      const freqData = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqData);
      samples.push(freqData);
    }
    
    // Average the samples to create noise profile
    this.noiseProfile = new Float32Array(analyser.frequencyBinCount);
    for (let i = 0; i < this.noiseProfile.length; i++) {
      let sum = 0;
      for (const sample of samples) {
        sum += sample[i];
      }
      this.noiseProfile[i] = sum / samples.length;
    }
    
    // Clean up
    source.disconnect();
    stream.getTracks().forEach(track => track.stop());
    
    this.isCalibrating = false;
  }

  /**
   * Get current noise level estimation
   */
  estimateNoiseLevel(analyser: AnalyserNode): number {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Focus on typical noise frequency ranges
    const noiseRangeStart = Math.floor(20 / (this.audioContext.sampleRate / 2) * analyser.frequencyBinCount);
    const noiseRangeEnd = Math.floor(500 / (this.audioContext.sampleRate / 2) * analyser.frequencyBinCount);

    let sum = 0;
    for (let i = noiseRangeStart; i < noiseRangeEnd; i++) {
      sum += dataArray[i];
    }

    return sum / (noiseRangeEnd - noiseRangeStart) / 255;
  }
}