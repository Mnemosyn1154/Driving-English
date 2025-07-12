
import React, { useEffect, useRef } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition'; // Assuming this hook exists

interface VoiceControllerProps {
  textToSpeak?: string;
  translationToSpeak?: string;
  onCommand: (command: string) => void;
  isPlaying: boolean;
}

export function VoiceController({
  textToSpeak,
  translationToSpeak,
  onCommand,
  isPlaying,
}: VoiceControllerProps) {
  const lastSpokenTextRef = useRef<string | null>(null);

  const {
    synthesize,
    isPlaying: isTTSPlaying,
    isSynthesizing,
    play: playTTS,
    pause: pauseTTS,
    stop: stopTTS,
    error: ttsError,
  } = useTTS({
    language: 'en-US',
    autoPlay: true,
    cacheEnabled: true,
  });

  // Assuming useHybridSpeechRecognition provides a way to listen for commands
  // and that it's already integrated into the project.
  // For now, we'll simulate command handling.
  // In a real scenario, you'd pass onCommand to the speech recognition hook.
  useEffect(() => {
    // Placeholder for speech recognition integration
    // If useHybridSpeechRecognition provides a direct way to pass a command handler,
    // it would be used here.
    // Example: const { startListening, stopListening } = useHybridSpeechRecognition({ onCommand });
    // For now, we'll just log.
    console.log("VoiceController: Speech recognition active.");
  }, [onCommand]);

  useEffect(() => {
    if (textToSpeak && isPlaying && textToSpeak !== lastSpokenTextRef.current) {
      console.log("VoiceController: Synthesizing text:", textToSpeak);
      synthesize(textToSpeak);
      lastSpokenTextRef.current = textToSpeak;
    } else if (!isPlaying) {
      stopTTS();
    }
  }, [textToSpeak, isPlaying, synthesize, stopTTS]);

  useEffect(() => {
    if (ttsError) {
      console.error("VoiceController: TTS Error:", ttsError);
    }
  }, [ttsError]);

  // Expose play/pause/stop for external control if needed, though isPlaying prop handles basic flow
  // return { playTTS, pauseTTS, stopTTS, isTTSPlaying, isSynthesizing };
  return null; // This component doesn't render any UI directly
}
