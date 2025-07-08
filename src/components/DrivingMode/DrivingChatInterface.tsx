'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import styles from './DrivingChatInterface.module.css';

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
  difficulty: number;
  url: string;
  selectionNumber: number;
}

interface DrivingChatInterfaceProps {
  currentSentence?: {
    text: string;
    translation: string;
  };
  onCommand: (command: string) => void;
  isPlaying: boolean;
}

export const DrivingChatInterface: React.FC<DrivingChatInterfaceProps> = ({
  currentSentence,
  onCommand,
  isPlaying
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

  // Speech recognition
  const {
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
    isSupported,
    isListening
  } = useSpeechRecognition('ko-KR');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show current sentence when it changes
  useEffect(() => {
    if (currentSentence) {
      const sentenceMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '현재 문장:',
        englishText: currentSentence.text,
        koreanText: currentSentence.translation,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, sentenceMessage]);
    }
  }, [currentSentence]);

  // Process command and get response
  const processCommand = async (text: string): Promise<{ response: string; newsResults?: NewsSearchResult[] }> => {
    const lowerText = text.toLowerCase();
    let response = '';
    let commandExecuted = '';
    let newsResults: NewsSearchResult[] | undefined = undefined;

    // 뉴스 검색 명령 확인
    if (lowerText.includes('검색') || lowerText.includes('찾아') || 
        (lowerText.includes('관련') && lowerText.includes('뉴스'))) {
      // 음성 검색 API 호출
      try {
        const searchResponse = await fetch('/api/news/voice-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transcript: text,
            userId: localStorage.getItem('deviceId') // 임시 사용자 ID
          })
        });
        
        if (searchResponse.ok) {
          const data = await searchResponse.json();
          newsResults = data.articles;
          response = `"${data.keywords.join(', ')}" 관련 뉴스 ${data.articles.length}개를 찾았습니다. 번호를 말씀해주시면 해당 뉴스를 선택할 수 있습니다.`;
        } else {
          response = '뉴스 검색 중 오류가 발생했습니다.';
        }
      } catch (error) {
        console.error('Search error:', error);
        response = '검색 서비스에 연결할 수 없습니다.';
      }
    } else if (lowerText.includes('다음') || lowerText.includes('next')) {
      commandExecuted = 'next';
      response = '다음 문장으로 이동합니다.';
    } else if (lowerText.includes('이전') || lowerText.includes('previous')) {
      commandExecuted = 'previous';
      response = '이전 문장으로 돌아갑니다.';
    } else if (lowerText.includes('반복') || lowerText.includes('repeat')) {
      commandExecuted = 'repeat';
      response = '현재 문장을 다시 재생합니다.';
    } else if (lowerText.includes('일시정지') || lowerText.includes('pause')) {
      commandExecuted = 'pause';
      response = '재생을 일시정지합니다.';
    } else if (lowerText.includes('재생') || lowerText.includes('play')) {
      commandExecuted = 'play';
      response = '재생을 시작합니다.';
    } else if (lowerText.includes('도움말') || lowerText.includes('help')) {
      response = '사용 가능한 명령어: 검색, 다음, 이전, 반복, 재생, 일시정지';
    } else if (/[0-9]+번째?/.test(text)) {
      // 숫자 + "번째" 패턴 확인 (뉴스 선택)
      const match = text.match(/([0-9]+)번째?/);
      if (match) {
        const number = parseInt(match[1]);
        commandExecuted = `select:${number}`;
        response = `${number}번째 뉴스를 선택했습니다.`;
      }
    } else {
      response = '명령을 이해하지 못했습니다. "도움말"이라고 말해보세요.';
    }

    if (commandExecuted) {
      onCommand(commandExecuted);
    }

    return { response, newsResults };
  };

  // Handle speech recognition result
  useEffect(() => {
    if (transcript && transcript.trim()) {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: transcript,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Process and respond
      setIsProcessing(true);
      processCommand(transcript).then(({ response, newsResults }) => {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response,
          timestamp: new Date(),
          newsResults
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
      });

      resetTranscript();
    }
  }, [transcript, resetTranscript, onCommand]);

  // Handle text input
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
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
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response,
          timestamp: new Date(),
          newsResults
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
      });
    }
  };

  // Toggle voice recognition
  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
                          <span className={styles.newsSource}>{news.source}</span>
                          <span 
                            className={styles.newsDifficulty}
                            style={{ backgroundColor: getDifficultyColor(news.difficulty) }}
                          >
                            {getDifficultyLabel(news.difficulty)}
                          </span>
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
        {isListening && interimTranscript && (
          <div className={`${styles.message} ${styles.user} ${styles.interim}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{interimTranscript}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className={styles.inputContainer} onSubmit={handleSubmit}>
        <button
          type="button"
          className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
          onClick={toggleVoice}
          disabled={!isSupported}
          aria-label={isListening ? '음성 인식 중지' : '음성 인식 시작'}
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
          placeholder={isListening ? '듣는 중...' : '메시지를 입력하세요...'}
          className={styles.input}
          disabled={isProcessing || isListening}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || isProcessing || isListening}
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