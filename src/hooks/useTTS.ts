/**
 * Text-to-Speech Hook
 * Handles TTS synthesis with caching and playback control
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePerformanceTracking } from '@/components/layout/PerformanceProvider';
import { useBrowserTTS } from './useBrowserTTS';

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

  // Performance tracking
  const { trackVoicePerformance } = usePerformanceTracking();
  
  // Browser TTS fallback
  const browserTTS = useBrowserTTS();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<AudioCache>({});
  const optionsRef = useRef<TTSOptions>(defaultOptions);
  const ttsStartTimeRef = useRef<number>(0);
  const synthesisIdRef = useRef<number>(0); // 중복 호출 추적용
  const abortControllerRef = useRef<AbortController | null>(null); // fetch 요청 취소용
  const audioEventListenersRef = useRef<{ [key: string]: EventListener }>({});

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
    // 중복 호출 방지를 위한 ID 생성
    const currentSynthesisId = ++synthesisIdRef.current;
    console.log(`[useTTS] 📢 Synthesize #${currentSynthesisId}:`, text.substring(0, 50) + '...');
    
    // 이전 fetch 요청 취소
    if (abortControllerRef.current) {
      console.log(`[useTTS] 🛑 Aborting previous request #${currentSynthesisId}`);
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // 이전 오디오 정리
    if (audioRef.current) {
      console.log(`[useTTS] 🔇 Cleaning previous audio #${currentSynthesisId}`);
      
      // 모든 이벤트 리스너 제거
      Object.entries(audioEventListenersRef.current).forEach(([event, listener]) => {
        audioRef.current?.removeEventListener(event, listener);
      });
      audioEventListenersRef.current = {};
      
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
      setIsPlaying(false);
    }
    
    // 브라우저 TTS도 정리
    if (browserTTS.isSpeaking) {
      console.log(`[useTTS] 브라우저 TTS 정리 #${currentSynthesisId}`);
      browserTTS.cancel();
    }
    
    try {
      setError(null);
      setCurrentText(text);
      
      const finalOptions = { ...optionsRef.current, ...options };
      const cacheKey = getCacheKey(text, finalOptions);
      console.log(`[useTTS] 옵션 #${currentSynthesisId}:`, finalOptions);

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

      // Track TTS start time
      ttsStartTimeRef.current = performance.now();

      // 새 AbortController 생성
      abortControllerRef.current = new AbortController();

      console.log('[useTTS] TTS API 호출 시작');
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
        signal: abortControllerRef.current.signal,
      });
      
      console.log('[useTTS] TTS API 응답:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useTTS] TTS API 에러:', errorText);
        throw new Error(`TTS synthesis failed: ${response.status}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('[useTTS] JSON 파싱 에러:', jsonError);
        throw new Error('TTS 응답 파싱 실패');
      }
      
      console.log('[useTTS] TTS API 결과:', result);
      
      if (!result.success) {
        console.error('[useTTS] TTS 실패:', result.error);
        throw new Error(result.error || 'TTS synthesis failed');
      }

      // Create audio element
      const audio = new Audio();
      
      console.log('[useTTS] 오디오 데이터 확인:', {
        hasBase64: !!result.data.audioBase64,
        base64Length: result.data.audioBase64?.length || 0,
        hasUrl: !!result.data.audioUrl,
        url: result.data.audioUrl
      });
      
      if (result.data.audioBase64) {
        // Use base64 audio if available
        audio.src = `data:audio/mp3;base64,${result.data.audioBase64}`;
        console.log('[useTTS] Base64 오디오 사용');
      } else if (result.data.audioUrl) {
        // Use audio URL
        audio.src = result.data.audioUrl;
        console.log('[useTTS] 오디오 URL 사용:', result.data.audioUrl);
      } else {
        throw new Error('No audio data received');
      }

      // Set audio properties
      audio.volume = finalOptions.volume || 1;
      audio.playbackRate = finalOptions.speed || 1;

      // Add event listeners with cleanup tracking
      const playListener = () => {
        console.log('[useTTS] 오디오 재생 시작');
        setIsPlaying(true);
      };
      const pauseListener = () => {
        console.log('[useTTS] 오디오 일시정지');
        setIsPlaying(false);
      };
      const endedListener = () => {
        console.log('[useTTS] 오디오 재생 완료');
        setIsPlaying(false);
        setCurrentText(null);
      };
      const errorListener = (e: Event) => {
        console.error('[useTTS] Audio playback error:', e);
        const audioError = e.target as HTMLAudioElement;
        console.error('[useTTS] Audio error details:', {
          error: audioError.error,
          src: audioError.src,
          readyState: audioError.readyState,
          networkState: audioError.networkState
        });
        setError(new Error('Audio playback failed'));
      };
      
      // 이벤트 리스너 등록 및 추적
      audio.addEventListener('play', playListener);
      audio.addEventListener('pause', pauseListener);
      audio.addEventListener('ended', endedListener);
      audio.addEventListener('error', errorListener);
      
      audioEventListenersRef.current = {
        play: playListener,
        pause: pauseListener,
        ended: endedListener,
        error: errorListener
      };

      // Cache the audio
      if (finalOptions.cacheEnabled !== false) {
        cacheRef.current[cacheKey] = {
          url: audio.src,
          audio,
          timestamp: Date.now(),
        };
      }

      audioRef.current = audio;

      // Track TTS success
      if (ttsStartTimeRef.current > 0) {
        const endTime = performance.now();
        trackVoicePerformance('tts', ttsStartTimeRef.current, endTime, true);
      }
      
      // Auto-play if requested
      if (finalOptions.autoPlay !== false) {
        console.log('[useTTS] 자동 재생 시도');
        try {
          await audio.play();
          console.log('[useTTS] 자동 재생 성공');
        } catch (playError) {
          console.error('[useTTS] 자동 재생 실패:', playError);
          // 브라우저 정책으로 자동 재생이 차단될 수 있음
          // 사용자 상호작용 후 재생 필요
        }
      }
    } catch (err: any) {
      // Abort 에러는 무시 (abort() 호출로 인한 정상적인 취소)
      if (err.name === 'AbortError') {
        console.log(`[useTTS] Request aborted #${currentSynthesisId}`);
        return;
      }
      
      console.error('[useTTS] TTS synthesis error:', err);
      
      // Track TTS error
      if (ttsStartTimeRef.current > 0) {
        const endTime = performance.now();
        trackVoicePerformance('tts', ttsStartTimeRef.current, endTime, false);
      }
      
      // Try browser TTS as fallback
      if (browserTTS.isSupported) {
        console.log(`[useTTS] 🔄 Fallback to browser TTS #${currentSynthesisId}`);
        browserTTS.speak(text, {
          lang: finalOptions.language,
          rate: finalOptions.speed,
          pitch: finalOptions.pitch,
          volume: finalOptions.volume,
        });
        setIsPlaying(true);
        // Don't set error if browser TTS works
      } else {
        setError(err as Error);
      }
    } finally {
      setIsSynthesizing(false);
      // AbortController 참조 정리
      if (abortControllerRef.current?.signal.aborted) {
        abortControllerRef.current = null;
      }
    }
  }, [browserTTS, trackVoicePerformance]);

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
    } else if (browserTTS.isSupported && browserTTS.isSpeaking) {
      browserTTS.resume();
    }
  }, [isPlaying, browserTTS]);

  /**
   * Pause audio
   */
  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
    }
    if (browserTTS.isSupported && browserTTS.isSpeaking) {
      browserTTS.pause();
    }
  }, [isPlaying, browserTTS]);

  /**
   * Stop audio
   */
  const stop = useCallback(() => {
    // 진행 중인 fetch 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (audioRef.current) {
      // 이벤트 리스너 제거
      Object.entries(audioEventListenersRef.current).forEach(([event, listener]) => {
        audioRef.current?.removeEventListener(event, listener);
      });
      audioEventListenersRef.current = {};
      
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
      setIsPlaying(false);
      setCurrentText(null);
    }
    if (browserTTS.isSupported && browserTTS.isSpeaking) {
      browserTTS.cancel();
    }
  }, [browserTTS]);

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

  // Update playing state based on browser TTS
  useEffect(() => {
    if (browserTTS.isSpeaking && !audioRef.current?.src) {
      setIsPlaying(true);
    } else if (!browserTTS.isSpeaking && !audioRef.current?.src) {
      setIsPlaying(false);
    }
  }, [browserTTS.isSpeaking]);

  return {
    isSynthesizing,
    isPlaying: isPlaying || browserTTS.isSpeaking,
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