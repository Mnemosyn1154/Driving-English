import { useState, useEffect, useCallback } from 'react';
import { offlineDB, offlineHelpers, CachedArticle } from '@/utils/indexedDB';
import { useToast } from '@/hooks/useToast';

interface OfflineState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  pendingSyncCount: number;
  failedSyncCount: number;
  lastSyncTime: number | null;
  cachedArticleCount: number;
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isServiceWorkerReady: false,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    lastSyncTime: null,
    cachedArticleCount: 0,
  });
  const { toast } = useToast();

  // Update sync status
  const updateSyncStatus = useCallback(async () => {
    try {
      const status = await offlineHelpers.getSyncStatus();
      const articles = await offlineHelpers.getCachedArticles();
      
      setState(prev => ({
        ...prev,
        pendingSyncCount: status.pending,
        failedSyncCount: status.failed,
        lastSyncTime: status.lastSync,
        cachedArticleCount: articles.length,
      }));
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      toast.success('온라인 모드: 인터넷에 다시 연결되었습니다.');
      
      // Trigger sync when back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'TRIGGER_SYNC',
        });
      }
      
      updateSyncStatus();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
      toast.warning('오프라인 모드: 캐시된 콘텐츠를 표시합니다.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setState(prev => ({ ...prev, isServiceWorkerReady: true }));
      });
    }

    // Initial status update
    updateSyncStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, updateSyncStatus]);

  // Listen for sync updates
  useEffect(() => {
    const handleSyncUpdate = () => {
      updateSyncStatus();
    };

    window.addEventListener('sw-sync-completed', handleSyncUpdate);
    
    // Periodic status update
    const interval = setInterval(updateSyncStatus, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('sw-sync-completed', handleSyncUpdate);
      clearInterval(interval);
    };
  }, [toast, updateSyncStatus]);

  // Cache article for offline reading
  const cacheArticle = useCallback(async (article: CachedArticle) => {
    try {
      await offlineHelpers.cacheArticle(article);
      
      // Preload audio files
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const audioUrls = article.sentences
          .filter(s => s.audioUrl)
          .map(s => s.audioUrl!);
        
        navigator.serviceWorker.controller.postMessage({
          type: 'PRELOAD_NEXT_AUDIO',
          payload: { audioUrls },
        });
      }
      
      toast.success('오프라인 저장 완료: 기사가 오프라인에서도 이용할 수 있습니다.');
      updateSyncStatus();
    } catch (error) {
      console.error('Failed to cache article:', error);
      toast.error('저장 실패: 기사를 오프라인 저장하는 데 실패했습니다.');
    }
  }, [toast, updateSyncStatus]);

  // Get cached articles
  const getCachedArticles = useCallback(async (category?: string) => {
    try {
      return await offlineHelpers.getCachedArticles(category);
    } catch (error) {
      console.error('Failed to get cached articles:', error);
      return [];
    }
  }, []);

  // Save progress with offline support
  const saveProgress = useCallback(async (
    articleId: string,
    sentenceIndex: number,
    userId: string,
    completed: boolean = false
  ) => {
    try {
      if (state.isOnline) {
        // Try to save online first
        const response = await fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            sentenceIndex,
            completed,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save progress online');
        }
      } else {
        // Save offline
        await offlineHelpers.saveProgressOffline({
          userId,
          articleId,
          sentenceIndex,
          completed,
        });
        
        updateSyncStatus();
      }
    } catch (error) {
      // Fallback to offline save
      console.error('Failed to save progress online, saving offline:', error);
      await offlineHelpers.saveProgressOffline({
        userId,
        articleId,
        sentenceIndex,
        completed,
      });
      
      updateSyncStatus();
    }
  }, [state.isOnline, toast, updateSyncStatus]);

  // Force sync
  const forceSync = useCallback(async () => {
    if (!state.isOnline) {
      toast.error('동기화 불가: 오프라인 상태에서는 동기화할 수 없습니다.');
      return;
    }

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'FORCE_SYNC',
        });
      }

      toast.info('동기화 시작: 데이터를 동기화하고 있습니다...');

      // Wait a bit for sync to start
      setTimeout(updateSyncStatus, 1000);
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast.error('동기화 실패: 동기화를 시작하는 데 실패했습니다.');
    }
  }, [state.isOnline, toast, updateSyncStatus]);

  // Clear offline cache
  const clearOfflineCache = useCallback(async () => {
    try {
      await offlineDB.clear('cachedArticles');
      await offlineDB.clear('syncQueue');
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE',
        });
      }

      toast.success('캐시 삭제 완료: 오프라인 캐시가 삭제되었습니다.');
      updateSyncStatus();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('캐시 삭제 실패: 캐시를 삭제하는 데 실패했습니다.');
    }
  }, [toast, updateSyncStatus]);

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_STATS') {
          resolve(event.data.stats);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_STATS' },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }, []);

  return {
    ...state,
    cacheArticle,
    getCachedArticles,
    saveProgress,
    forceSync,
    clearOfflineCache,
    getCacheStats,
  };
}