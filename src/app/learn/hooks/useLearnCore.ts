import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTTS } from '@/hooks/useTTS';

export interface Sentence {
  id: string;
  text: string;
  translation: string;
  order: number;
}

export interface Article {
  id: string;
  title: string;
  sentences: Sentence[];
}

export interface LearnMessage {
  id: string;
  type: 'system' | 'sentence' | 'translation' | 'user' | 'command';
  content: string;
  timestamp: Date;
  metadata?: {
    sentenceIndex?: number;
    isPlaying?: boolean;
  };
}

export function useLearnCore() {
  const searchParams = useSearchParams();
  const articleId = searchParams.get('articleId');
  
  // State
  const [article, setArticle] = useState<Article | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<LearnMessage[]>([]);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  
  // Refs
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedIndexRef = useRef<number>(-1);
  
  // TTS Hook
  const {
    synthesize,
    isPlaying: isTTSPlaying,
    isSynthesizing,
    stop: stopTTS,
    pause: pauseTTS,
    error: ttsError,
  } = useTTS({
    language: 'en-US',
    autoPlay: true,
    cacheEnabled: true,
  });
  
  // Track if we're playing Korean
  const [isPlayingKorean, setIsPlayingKorean] = useState(false);

  // Add message to chat
  const addMessage = useCallback((
    type: LearnMessage['type'],
    content: string,
    metadata?: LearnMessage['metadata']
  ) => {
    const message: LearnMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
      metadata,
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  // Load article
  useEffect(() => {
    const loadArticle = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const url = articleId
          ? `/api/news/articles/${articleId}`
          : '/api/news/articles?type=recommendations&limit=1';
          
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }
        
        const data = await response.json();
        const articleData = articleId ? data : data.articles?.[0];
        
        if (!articleData) {
          throw new Error('No article found');
        }

        // Validate sentences
        if (articleData.sentences && articleData.sentences.length > 0) {
          const validSentences = articleData.sentences
            .filter((s: any) => s && s.text && s.text.trim().length > 0)
            .map((s: any, index: number) => ({
              ...s,
              id: s.id || `sentence-${index}`,
              text: s.text.trim(),
              translation: s.translation || '',
              order: s.order || index + 1,
            }));
          
          articleData.sentences = validSentences;
          setArticle(articleData);
          
          // Add initial messages
          addMessage('system', `"${articleData.title}" 기사를 시작합니다.`);
          addMessage('system', `총 ${validSentences.length}개의 문장이 있습니다.`);
        } else {
          throw new Error('No valid sentences in article');
        }
      } catch (error) {
        console.error('[useLearnCore] Error loading article:', error);
        setError(error instanceof Error ? error.message : 'Failed to load article');
        addMessage('system', '기사를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadArticle();
  }, [articleId, addMessage]);

  // Get current sentence
  const getCurrentSentence = useCallback(() => {
    if (!article || currentIndex < 0 || currentIndex >= article.sentences.length) {
      return null;
    }
    return article.sentences[currentIndex];
  }, [article, currentIndex]);

  // Play current sentence
  const playCurrentSentence = useCallback(async () => {
    const sentence = getCurrentSentence();
    if (!sentence) return;

    // Clear any existing timeout
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }

    // Avoid playing same sentence twice
    if (lastPlayedIndexRef.current === currentIndex) {
      return;
    }

    console.log('[useLearnCore] Playing sentence:', currentIndex, sentence.text);
    lastPlayedIndexRef.current = currentIndex;

    // Add sentence and translation to chat
    addMessage('sentence', sentence.text, { sentenceIndex: currentIndex, isPlaying: true });
    if (sentence.translation) {
      addMessage('translation', sentence.translation, { sentenceIndex: currentIndex });
    }

    try {
      // Play English first
      await synthesize(sentence.text, { language: 'en-US' });
      
      // Wait a bit before playing Korean
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Play Korean translation if available
      if (sentence.translation) {
        setIsPlayingKorean(true);
        await synthesize(sentence.translation, { language: 'ko-KR' });
        setIsPlayingKorean(false);
      }
    } catch (error) {
      console.error('[useLearnCore] TTS error:', error);
      addMessage('system', 'TTS 재생 중 오류가 발생했습니다.');
      setIsPlayingKorean(false);
    }
  }, [getCurrentSentence, currentIndex, synthesize, addMessage]);

  // Handle playback completion
  useEffect(() => {
    if (!isTTSPlaying && !isSynthesizing && !isPlayingKorean && lastPlayedIndexRef.current === currentIndex && isAutoPlay) {
      console.log('[useLearnCore] Playback completed, auto-advancing...');
      
      // Auto-advance after a delay
      playbackTimeoutRef.current = setTimeout(() => {
        if (article && currentIndex < article.sentences.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          // Reached end
          addMessage('system', '기사 학습을 완료했습니다!');
          setIsAutoPlay(false);
        }
      }, 1500);
    }

    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, [isTTSPlaying, isSynthesizing, isPlayingKorean, currentIndex, article, isAutoPlay, addMessage]);

  // Play when index changes
  useEffect(() => {
    if (article && currentIndex >= 0 && currentIndex < article.sentences.length) {
      playCurrentSentence();
    }
  }, [currentIndex, article, playCurrentSentence]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (!article) return;
    
    if (currentIndex < article.sentences.length - 1) {
      stopTTS();
      setCurrentIndex(prev => prev + 1);
      addMessage('command', '다음 문장으로 이동합니다.');
    } else {
      addMessage('system', '마지막 문장입니다.');
    }
  }, [article, currentIndex, stopTTS, addMessage]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopTTS();
      setCurrentIndex(prev => prev - 1);
      addMessage('command', '이전 문장으로 이동합니다.');
    } else {
      addMessage('system', '첫 번째 문장입니다.');
    }
  }, [currentIndex, stopTTS, addMessage]);

  const repeat = useCallback(() => {
    stopTTS();
    lastPlayedIndexRef.current = -1; // Force replay
    playCurrentSentence();
    addMessage('command', '현재 문장을 다시 재생합니다.');
  }, [stopTTS, playCurrentSentence, addMessage]);

  const togglePlayPause = useCallback(() => {
    if (isTTSPlaying) {
      pauseTTS();
      setIsAutoPlay(false);
      addMessage('command', '일시정지');
    } else {
      setIsAutoPlay(true);
      playCurrentSentence();
      addMessage('command', '재생');
    }
  }, [isTTSPlaying, pauseTTS, playCurrentSentence, addMessage]);

  return {
    // State
    article,
    currentIndex,
    isLoading,
    error,
    messages,
    isPlaying: isTTSPlaying,
    isAutoPlay,
    
    // Functions
    goToNext,
    goToPrevious,
    repeat,
    togglePlayPause,
    addMessage,
    
    // Utilities
    getCurrentSentence,
    totalSentences: article?.sentences.length || 0,
  };
}