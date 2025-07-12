
import { useState, useEffect } from 'react';
import { Article } from '@/types/article';

export function useArticleData(articleId?: string) {
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const url = articleId
          ? `/api/news/articles/${articleId}`
          : '/api/news/articles?type=recommendations&limit=1';
          
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch article');
        }
        
        const data = await response.json();
        
        const loadedArticle = articleId ? data : (data.articles && data.articles[0]);

        if (!loadedArticle) {
          throw new Error('No articles available');
        }

        // Validate and clean sentences
        if (loadedArticle.sentences && loadedArticle.sentences.length > 0) {
          const validSentences = loadedArticle.sentences
            .filter((s: any) => s && s.text && typeof s.text === 'string' && s.text.trim().length > 0)
            .map((s: any, index: number) => ({
              ...s,
              id: s.id || `sentence-${index}`,
              text: s.text.trim(),
              translation: s.translation || '',
              order: s.order || index + 1,
            }));
          
          loadedArticle.sentences = validSentences;
        }

        setArticle(loadedArticle);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  return { article, isLoading, error };
}
