/**
 * Simplified audio recorder hook for testing
 */

import { useState, useCallback } from 'react';

export interface UseSimpleAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: Error | null;
}

export function useSimpleAudioRecorder(): UseSimpleAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Handle data available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes');
          // TODO: Send to server
        }
      };

      // Handle errors
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError(new Error('Recording failed'));
        setIsRecording(false);
      };

      // Start recording
      recorder.start(100); // Get data every 100ms
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err as Error);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      
      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      
      setMediaRecorder(null);
      setIsRecording(false);
      
      console.log('Recording stopped');
    }
  }, [mediaRecorder]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error
  };
}