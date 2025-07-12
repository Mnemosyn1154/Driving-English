import { useState, useCallback, useEffect } from 'react';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';

export type InputMode = 'voice' | 'text' | 'hybrid';

interface UseInputHandlerProps {
  onCommand: (command: string, source: 'voice' | 'text') => void;
  addMessage: (type: any, content: string) => void;
}

export function useInputHandler({ onCommand, addMessage }: UseInputHandlerProps) {
  const [inputMode, setInputMode] = useState<InputMode>('hybrid');
  const [textInput, setTextInput] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  
  // Voice recognition hook
  const {
    isRecording,
    status: voiceStatus,
    lastTranscript,
    lastIntent,
    startRecording,
    stopRecording,
    clearError,
  } = useHybridSpeechRecognition({
    onCommand: (command, transcript) => {
      console.log('[useInputHandler] Voice command:', command, transcript);
      
      // Ignore unclear or ambiguous commands
      if (command === 'UNCLEAR' || command === 'unclear') {
        console.log('[useInputHandler] Ignoring unclear command');
        return;
      }
      
      // Map voice commands
      const commandMap: Record<string, string> = {
        'NEXT_NEWS': 'next',
        'PREV_NEWS': 'previous',
        'PAUSE': 'pause',
        'RESUME': 'play',
        'PLAY': 'play',
        'REPEAT': 'repeat',
        'EXIT': 'exit',
        'STOP': 'pause',
      };
      
      const mappedCommand = commandMap[command] || command.toLowerCase();
      
      // Only process known commands
      const validCommands = ['next', 'previous', 'pause', 'play', 'repeat', 'exit', 'stop'];
      if (!validCommands.includes(mappedCommand)) {
        console.log('[useInputHandler] Ignoring unknown command:', mappedCommand);
        return;
      }
      
      // Add user message to chat
      addMessage('user', transcript || mappedCommand);
      
      // Process command
      onCommand(mappedCommand, 'voice');
    },
    onGeminiResponse: (result) => {
      console.log('[useInputHandler] Gemini response:', result);
      
      // Only handle clear intent with high confidence
      if (result.intent && result.intent !== 'UNCLEAR' && result.confidence > 0.7) {
        const intent = result.intent.toLowerCase();
        
        // Map Gemini intents to commands
        const intentMap: Record<string, string> = {
          'navigate_news': 'next',
          'navigate_previous': 'previous',
          'pause_audio': 'pause',
          'play_audio': 'play',
          'repeat_audio': 'repeat',
          'exit_mode': 'exit',
        };
        
        const command = intentMap[intent];
        if (command) {
          addMessage('user', result.transcription || intent);
          onCommand(command, 'voice');
        }
      }
    },
    onError: (error) => {
      console.error('[useInputHandler] Voice error:', error);
      // Don't show error messages for every small issue
    },
    silenceThreshold: 3000, // Increase silence threshold to 3 seconds
  });

  // Check microphone permission on mount
  useEffect(() => {
    if (inputMode !== 'text') {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          setIsVoiceEnabled(true);
          // Don't auto-start recording on mount
          // User should manually start with button
        })
        .catch(() => {
          setIsVoiceEnabled(false);
          if (inputMode === 'voice') {
            setInputMode('text');
            addMessage('system', '마이크 권한이 없어 텍스트 모드로 전환합니다.');
          }
        });
    }
    
    // Stop recording when switching to text mode
    if (inputMode === 'text' && isRecording) {
      stopRecording();
    }
  }, [inputMode]); // Remove dependencies that cause re-runs

  // Handle text input submission
  const handleTextSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    const input = textInput.trim().toLowerCase();
    if (!input) return;
    
    // Add user message
    addMessage('user', textInput);
    
    // Process text commands
    const textCommandMap: Record<string, string> = {
      '다음': 'next',
      'next': 'next',
      '이전': 'previous',
      'previous': 'previous',
      'prev': 'previous',
      '다시': 'repeat',
      'repeat': 'repeat',
      '일시정지': 'pause',
      'pause': 'pause',
      '재생': 'play',
      'play': 'play',
      '정지': 'pause',
      'stop': 'pause',
      '나가기': 'exit',
      'exit': 'exit',
      '종료': 'exit',
    };
    
    const command = textCommandMap[input] || input;
    onCommand(command, 'text');
    
    // Clear input
    setTextInput('');
  }, [textInput, onCommand, addMessage]);

  // Toggle voice recognition
  const toggleVoiceRecognition = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Switch input mode
  const switchInputMode = useCallback((mode: InputMode) => {
    setInputMode(mode);
    
    // Always stop recording when switching modes
    if (isRecording) {
      stopRecording();
    }
    
    // Don't auto-start recording, user should manually start
  }, [isRecording, stopRecording]);

  return {
    // State
    inputMode,
    textInput,
    isVoiceEnabled,
    isRecording,
    voiceStatus,
    
    // Functions
    setTextInput,
    handleTextSubmit,
    toggleVoiceRecognition,
    switchInputMode,
    
    // Voice state
    lastTranscript,
    clearError,
  };
}