
import { useState, useEffect, useCallback } from 'react';
import { Article, Sentence } from '@/types/article';
import { useProgressTracking } from './useProgressTracking';

interface UseSentenceControlProps {
  article: Article | null;
  initialIndex?: number;
}

export function useSentenceControl({ article, initialIndex = 0 }: UseSentenceControlProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentSentence, setCurrentSentence] = useState<Sentence | null>(null);

  const { updateArticleProgress, getArticleProgress } = useProgressTracking({ mode: 'learn', autoSave: true });

  useEffect(() => {
    if (article?.id) {
      getArticleProgress(article.id).then(progress => {
        setCurrentIndex(progress.currentSentence || 0);
      }).catch(err => {
        console.error('Failed to load article progress:', err);
      });
    }
  }, [article?.id, getArticleProgress]);

  useEffect(() => {
    if (article && article.sentences.length > 0) {
      setCurrentSentence(article.sentences[currentIndex]);
    }
  }, [article, currentIndex]);

  const goToNext = useCallback(() => {
    if (article && currentIndex < article.sentences.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      updateArticleProgress(article.id, newIndex, article.sentences.length);
    }
  }, [article, currentIndex, updateArticleProgress]);

  const goToPrev = useCallback(() => {
    if (article && currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      updateArticleProgress(article.id, newIndex, article.sentences.length);
    }
  }, [article, currentIndex, updateArticleProgress]);

  const repeat = useCallback(() => {
    // Logic to repeat the current sentence will be handled by the VoiceController
    // This function can be used to trigger the repetition
  }, []);

  return { currentSentence, currentIndex, goToNext, goToPrev, repeat, setCurrentIndex };
}
