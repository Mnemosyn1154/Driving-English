/**
 * Text-to-Speech Hook
 * Handles TTS synthesis with caching and playback control
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface TTSOptions {
  language: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  autoPlay?: boolean;
  cacheEnabled?: boolean;
}

export interface UseTTSReturn {
  isSynthesizing: boolean;
  isPlaying: boolean;
  error: Error | null;
  currentText: string | null;
  synthesize: (text: string, options?: Partial<TTSOptions>) => Promise<void>;
  synthesizeBatch: (texts: Array<{ id: string; text: string; language: string }>) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  preload: (text: string, options?: Partial<TTSOptions>) => Promise<void>;
}

interface AudioCache {
  [key: string]: {
    url: string;
    audio: HTMLAudioElement;
    timestamp: number;
  };
}

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export function useTTS(defaultOptions: TTSOptions): UseTTSReturn {
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentText, setCurrentText] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<AudioCache>({});
  const optionsRef = useRef<TTSOptions>(defaultOptions);

  // Update options
  useEffect(() => {
    optionsRef.current = defaultOptions;
  }, [defaultOptions]);

  // Clean up old cache entries
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(cacheRef.current).forEach(key => {
        if (now - cacheRef.current[key].timestamp > CACHE_DURATION) {
          delete cacheRef.current[key];
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  /**
   * Generate cache key
   */
  const getCacheKey = (text: string, options: TTSOptions): string => {
    return `${text}_${options.language}_${options.voice || 'default'}_${options.speed || 1}_${options.pitch || 0}`;
  };

  /**
   * Synthesize single text
   */
  const synthesize = useCallback(async (text: string, options?: Partial<TTSOptions>) => {
    try {
      setError(null);
      setCurrentText(text);
      
      const finalOptions = { ...optionsRef.current, ...options };
      const cacheKey = getCacheKey(text, finalOptions);

      // Check cache
      if (finalOptions.cacheEnabled !== false && cacheRef.current[cacheKey]) {
        const cached = cacheRef.current[cacheKey];
        audioRef.current = cached.audio;
        
        if (finalOptions.autoPlay !== false) {
          play();
        }
        return;
      }

      setIsSynthesizing(true);

      // Call TTS API
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language: finalOptions.language,
          voice: finalOptions.voice,
          speed: finalOptions.speed,
          pitch: finalOptions.pitch,
          volumeGain: finalOptions.volume,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS synthesis failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'TTS synthesis failed');
      }

      // Create audio element
      const audio = new Audio();
      
      if (result.data.audioBase64) {
        // Use base64 audio if available
        audio.src = `data:audio/mp3;base64,${result.data.audioBase64}`;
      } else if (result.data.audioUrl) {
        // Use audio URL
        audio.src = result.data.audioUrl;
      } else {
        throw new Error('No audio data received');
      }

      // Set audio properties
      audio.volume = finalOptions.volume || 1;
      audio.playbackRate = finalOptions.speed || 1;

      // Add event listeners
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentText(null);
      });
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setError(new Error('Audio playback failed'));
      });

      // Cache the audio
      if (finalOptions.cacheEnabled !== false) {
        cacheRef.current[cacheKey] = {
          url: audio.src,
          audio,
          timestamp: Date.now(),
        };
      }

      audioRef.current = audio;
      
      // Auto-play if requested
      if (finalOptions.autoPlay !== false) {
        await audio.play();
      }
    } catch (err) {
      console.error('TTS synthesis error:', err);
      setError(err as Error);
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  /**
   * Synthesize batch of texts
   */
  const synthesizeBatch = useCallback(async (
    texts: Array<{ id: string; text: string; language: string }>
  ) => {
    try {
      setError(null);
      setIsSynthesizing(true);

      const response = await fetch('/api/tts/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: texts.map(item => ({
            id: item.id,
            text: item.text,
            language: item.language,
            speed: optionsRef.current.speed,
            pitch: optionsRef.current.pitch,
            volumeGain: optionsRef.current.volume,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Batch TTS synthesis failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Batch TTS synthesis failed');
      }

      // Cache all results
      result.data.audioFiles.forEach((file: any, index: number) => {
        const text = texts[index];
        const cacheKey = getCacheKey(text.text, {
          ...optionsRef.current,
          language: text.language,
        });

        const audio = new Audio(file.audioUrl);
        audio.volume = optionsRef.current.volume || 1;
        audio.playbackRate = optionsRef.current.speed || 1;

        cacheRef.current[cacheKey] = {
          url: file.audioUrl,
          audio,
          timestamp: Date.now(),
        };
      });
    } catch (err) {
      console.error('Batch TTS synthesis error:', err);
      setError(err as Error);
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  /**
   * Play audio
   */
  const play = useCallback(() => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
        setError(new Error('Failed to play audio'));
      });
    }
  }, [isPlaying]);

  /**
   * Pause audio
   */
  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  /**
   * Stop audio
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentText(null);
    }
  }, []);

  /**
   * Set volume
   */
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    optionsRef.current.volume = clampedVolume;
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.5, Math.min(2, speed));
    if (audioRef.current) {
      audioRef.current.playbackRate = clampedSpeed;
    }
    optionsRef.current.speed = clampedSpeed;
  }, []);

  /**
   * Preload audio without playing
   */
  const preload = useCallback(async (text: string, options?: Partial<TTSOptions>) => {
    const finalOptions = { ...optionsRef.current, ...options, autoPlay: false };
    await synthesize(text, finalOptions);
  }, [synthesize]);

  return {
    isSynthesizing,
    isPlaying,
    error,
    currentText,
    synthesize,
    synthesizeBatch,
    play,
    pause,
    stop,
    setVolume,
    setSpeed,
    preload,
  };
}