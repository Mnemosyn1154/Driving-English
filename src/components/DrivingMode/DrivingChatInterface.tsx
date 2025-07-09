'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';
import styles from './DrivingChatInterface.module.css';

// Generate unique IDs for messages
let messageIdCounter = 0;
const generateMessageId = () => {
  return `msg-${Date.now()}-${++messageIdCounter}`;
};

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  englishText?: string;
  koreanText?: string;
  newsResults?: NewsSearchResult[];
}

interface NewsSearchResult {
  id: string;
  title: string;
  summary: string;
  source: string;
  difficulty?: number;
  url: string;
  selectionNumber: number;
  category?: string;
  publishedAt?: string;
}

interface DrivingChatInterfaceProps {
  currentSentence?: {
    text: string;
    translation: string;
  };
  onCommand: (command: string) => void;
  isPlaying: boolean;
  isWakeWordDetected?: boolean;
}

export const DrivingChatInterface: React.FC<DrivingChatInterfaceProps> = ({
  currentSentence,
  onCommand,
  isPlaying,
  isWakeWordDetected = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '안녕하세요! 운전 중 영어 학습을 도와드리겠습니다. 음성이나 텍스트로 명령해주세요. "AI 뉴스 검색"과 같이 말해보세요.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hybrid speech recognition
  const {
    isRecording,
    status,
    lastTranscript,
    lastIntent,
    lastError,
    startRecording,
    stopRecording,
    clearError,
  } = useHybridSpeechRecognition({
    onCommand: (command, transcript) => {
      console.log('Command detected:', command, transcript);
      // Handle direct commands
      handleVoiceCommand(command);
      
      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'user',
        content: transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
    },
    onGeminiResponse: (result) => {
      console.log('Gemini response:', result);
      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'user',
        content: result.transcription,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Add AI response
      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: result.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    },
    onError: (error) => {
      console.error('Voice error:', error);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show current sentence when it changes
  useEffect(() => {
    if (currentSentence) {
      const sentenceMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: '현재 문장:',
        englishText: currentSentence.text,
        koreanText: currentSentence.translation,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, sentenceMessage]);
    }
  }, [currentSentence]);

  // Handle voice command from hybrid recognition
  const handleVoiceCommand = (command: string) => {
    // Map STT commands to navigation commands
    const commandMap: { [key: string]: string } = {
      'NEXT_NEWS': 'next',
      'PREV_NEWS': 'previous',
      'PAUSE': 'pause',
      'RESUME': 'play',
      'REPEAT': 'repeat',
      'EXIT': 'exit',
      'RESTART': 'restart',
      'SPEED_UP': 'speed_up',
      'SPEED_DOWN': 'speed_down',
      'VOLUME_UP': 'volume_up',
      'VOLUME_DOWN': 'volume_down',
      'TRANSLATE': 'translate',
      'EXPLAIN': 'explain',
      'SIMPLIFY': 'simplify',
    };

    const mappedCommand = commandMap[command] || command.toLowerCase();
    onCommand(mappedCommand);
    
    // Add system message for command feedback
    const commandMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'system',
      content: `명령 실행: ${mappedCommand}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, commandMessage]);
  };

  // Process command and get response
  const processCommand = async (text: string): Promise<{ response: string; newsResults?: NewsSearchResult[] }> => {
    const { analyzeCommand, RESPONSE_TEMPLATES } = await import('@/utils/command-patterns');
    const analysis = analyzeCommand(text);
    
    let response = '';
    let commandExecuted = '';
    let newsResults: NewsSearchResult[] | undefined = undefined;

    try {
      switch (analysis.type) {
        // RSS 피드 특정 검색
        case 'source_with_count':
        case 'source_news': {
          const searchResponse = await fetch('/api/news/rss-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              source: analysis.source,
              count: analysis.count || 5,
              userId: localStorage.getItem('userId'),
              deviceId: localStorage.getItem('deviceId')
            })
          });
          
          if (searchResponse.ok) {
            const data = await searchResponse.json();
            newsResults = data.articles;
            response = RESPONSE_TEMPLATES.sourceFound(analysis.source!, data.articles.length);
          } else {
            const error = await searchResponse.json();
            response = error.error || RESPONSE_TEMPLATES.error();
          }
          break;
        }

        // 카테고리별 검색
        case 'category_with_count':
        case 'category_recommend': {
          const searchResponse = await fetch('/api/news/rss-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              category: analysis.category,
              count: analysis.count || 5,
              userId: localStorage.getItem('userId'),
              deviceId: localStorage.getItem('deviceId')
            })
          });
          
          if (searchResponse.ok) {
            const data = await searchResponse.json();
            newsResults = data.articles;
            response = RESPONSE_TEMPLATES.categoryFound(analysis.category!, data.articles.length);
          } else {
            const error = await searchResponse.json();
            response = error.error || RESPONSE_TEMPLATES.error();
          }
          break;
        }

        // 일반 키워드 검색
        case 'general_search':
        case 'natural_request': {
          const searchResponse = await fetch('/api/news/voice-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transcript: text,
              userId: localStorage.getItem('userId'),
              deviceId: localStorage.getItem('deviceId')
            })
          });
          
          if (searchResponse.ok) {
            const data = await searchResponse.json();
            newsResults = data.articles;
            response = RESPONSE_TEMPLATES.searchResults(data.keywords, data.articles.length);
          } else {
            response = RESPONSE_TEMPLATES.error();
          }
          break;
        }

        // 숫자 선택
        case 'number_selection': {
          commandExecuted = `select:${analysis.number}`;
          response = RESPONSE_TEMPLATES.numberSelected(analysis.number!);
          break;
        }

        // 네비게이션
        case 'navigation': {
          commandExecuted = analysis.keyword!;
          response = analysis.keyword === 'next' ? '다음 문장으로 이동합니다.' : '이전 문장으로 돌아갑니다.';
          break;
        }

        // 재생 제어
        case 'playback': {
          commandExecuted = analysis.keyword!;
          if (analysis.keyword === 'pause') response = '재생을 일시정지합니다.';
          else if (analysis.keyword === 'play') response = '재생을 시작합니다.';
          else if (analysis.keyword === 'repeat') response = '현재 문장을 다시 재생합니다.';
          break;
        }

        // 도움말
        case 'help': {
          response = RESPONSE_TEMPLATES.helpMessage();
          break;
        }

        // 알 수 없는 명령
        default: {
          response = '명령을 이해하지 못했습니다. "도움말"이라고 말해보세요.';
        }
      }
    } catch (error) {
      console.error('Command processing error:', error);
      response = RESPONSE_TEMPLATES.error();
    }

    if (commandExecuted) {
      onCommand(commandExecuted);
    }

    return { response, newsResults };
  };

  // Handle error display
  useEffect(() => {
    if (lastError) {
      console.error('Voice recognition error:', lastError);
      // Optionally show error to user
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'system',
        content: `음성 인식 오류: ${lastError.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [lastError]);

  // Handle text input
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'user',
        content: inputText.trim(),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Process and respond
      setIsProcessing(true);
      const messageText = inputText.trim();
      setInputText('');

      processCommand(messageText).then(({ response, newsResults }) => {
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'assistant',
          content: response,
          timestamp: new Date(),
          newsResults
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
      }).catch(error => {
        console.error('Command processing error:', error);
        setIsProcessing(false);
      });
    }
  };

  // Toggle voice recognition
  const toggleVoice = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 난이도 표시 함수
  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['초급', '초중급', '중급', '중상급', '상급'];
    return labels[difficulty - 1] || '중급';
  };

  const getDifficultyColor = (difficulty: number) => {
    const colors = ['#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#F44336'];
    return colors[difficulty - 1] || '#FFC107';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Driving English</h1>
        <div className={styles.status}>
          {isPlaying ? '🎵 재생 중' : '⏸️ 일시정지'}
          {status !== 'idle' && status !== 'success' && (
            <span className={styles.processingStatus}>
              {status === 'recording' && ' 🎤 녹음 중'}
              {status === 'processing_stt' && ' 🔍 음성 분석 중'}
              {status === 'processing_gemini' && ' 🤖 AI 처리 중'}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.type]}`}
          >
            {message.type === 'assistant' && (
              <div className={styles.avatar}>AI</div>
            )}
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{message.content}</div>
              {message.englishText && (
                <div className={styles.sentenceBox}>
                  <div className={styles.englishText}>{message.englishText}</div>
                  <div className={styles.koreanText}>{message.koreanText}</div>
                </div>
              )}
              {message.newsResults && message.newsResults.length > 0 && (
                <div className={styles.newsResults}>
                  {message.newsResults.map((news) => (
                    <div key={news.id} className={styles.newsCard}>
                      <div className={styles.newsNumber}>{news.selectionNumber}</div>
                      <div className={styles.newsContent}>
                        <h4 className={styles.newsTitle}>{news.title}</h4>
                        <p className={styles.newsSummary}>{news.summary}</p>
                        <div className={styles.newsMetadata}>
                          <span className={styles.newsSource}>📰 {news.source}</span>
                          {news.category && (
                            <span className={styles.newsCategory}>
                              {news.category}
                            </span>
                          )}
                          {news.difficulty && (
                            <span 
                              className={styles.newsDifficulty}
                              style={{ backgroundColor: getDifficultyColor(news.difficulty) }}
                            >
                              {getDifficultyLabel(news.difficulty)}
                            </span>
                          )}
                          {news.publishedAt && (
                            <span className={styles.newsDate}>
                              {new Date(news.publishedAt).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.messageTime}>
                {message.timestamp.toLocaleTimeString('ko-KR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.avatar}>AI</div>
            <div className={styles.messageContent}>
              <div className={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        {isRecording && lastTranscript && (
          <div className={`${styles.message} ${styles.user} ${styles.interim}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{lastTranscript}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className={styles.inputContainer} onSubmit={handleSubmit}>
        <button
          type="button"
          className={`${styles.voiceButton} ${isRecording ? styles.listening : ''}`}
          onClick={toggleVoice}
          disabled={status === 'processing_stt' || status === 'processing_gemini'}
          aria-label={isRecording ? '음성 인식 중지' : '음성 인식 시작'}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isRecording ? '듣는 중...' : '메시지를 입력하세요...'}
          className={styles.input}
          disabled={isProcessing || isRecording}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || isProcessing || isRecording}
          aria-label="메시지 전송"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
};