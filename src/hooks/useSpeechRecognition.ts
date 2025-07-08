/**
 * Browser Speech Recognition API Hook
 * 브라우저 내장 음성 인식 기능 사용
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  error: Error | null;
  isSupported: boolean;
}

export function useSpeechRecognition(lang: string = 'ko-KR'): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(new Error(event.error));
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript(prev => prev + ' ' + finalText);
      }
      setInterimTranscript(interimText);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    };
  }, [lang, isSupported, isListening]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError(new Error('Speech recognition not supported'));
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError(err as Error);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
    isSupported
  };
}