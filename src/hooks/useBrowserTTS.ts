/**
 * Browser Text-to-Speech Hook
 * Uses Web Speech API as a fallback for TTS
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseBrowserTTSReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, options?: BrowserTTSOptions) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  voices: SpeechSynthesisVoice[];
}

export interface BrowserTTSOptions {
  lang?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useBrowserTTS(): UseBrowserTTSReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);

  // Check if Web Speech API is supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      speechSynthRef.current = window.speechSynthesis;

      // Load voices
      const loadVoices = () => {
        const availableVoices = speechSynthRef.current!.getVoices();
        setVoices(availableVoices);
      };

      // Voices might not be loaded immediately
      loadVoices();
      speechSynthRef.current.addEventListener('voiceschanged', loadVoices);

      return () => {
        speechSynthRef.current?.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

  // Monitor speaking state
  useEffect(() => {
    if (!isSupported) return;

    const checkSpeaking = setInterval(() => {
      setIsSpeaking(speechSynthRef.current!.speaking);
    }, 100);

    return () => clearInterval(checkSpeaking);
  }, [isSupported]);

  const speak = useCallback((text: string, options?: BrowserTTSOptions) => {
    if (!isSupported || !speechSynthRef.current) {
      console.warn('[BrowserTTS] Web Speech API not supported');
      return;
    }

    console.log('[BrowserTTS] Speaking:', text, options);

    // Cancel any ongoing speech
    speechSynthRef.current.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply options
    if (options?.lang) {
      utterance.lang = options.lang;
    } else {
      // Default to English for better pronunciation
      utterance.lang = 'en-US';
    }

    if (options?.rate !== undefined) {
      utterance.rate = options.rate;
    }

    if (options?.pitch !== undefined) {
      utterance.pitch = options.pitch;
    }

    if (options?.volume !== undefined) {
      utterance.volume = options.volume;
    }

    // Find matching voice
    if (options?.voice) {
      const voice = voices.find(v => 
        v.name === options.voice || 
        v.lang.startsWith(options.lang || 'en')
      );
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      // Try to find a good English voice
      const englishVoice = voices.find(v => 
        v.lang === 'en-US' && v.name.includes('Google')
      ) || voices.find(v => v.lang === 'en-US');
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    // Event handlers
    utterance.onstart = () => {
      console.log('[BrowserTTS] Started speaking');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('[BrowserTTS] Finished speaking');
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('[BrowserTTS] Speech error:', event);
      setIsSpeaking(false);
    };

    // Speak
    speechSynthRef.current.speak(utterance);
  }, [isSupported, voices]);

  const pause = useCallback(() => {
    if (isSupported && speechSynthRef.current) {
      speechSynthRef.current.pause();
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (isSupported && speechSynthRef.current) {
      speechSynthRef.current.resume();
    }
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (isSupported && speechSynthRef.current) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    speak,
    pause,
    resume,
    cancel,
    voices,
  };
}