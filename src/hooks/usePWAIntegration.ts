'use client';

import { useState, useEffect, useCallback } from 'react';
import { serviceWorkerManager } from '@/utils/serviceWorker';

export interface PWAIntegrationConfig {
  enableVoiceCache?: boolean;
  enableNewsCache?: boolean;
  enableProgressSync?: boolean;
  maxCacheSize?: number;
}

export interface CacheStats {
  STATIC?: { count: number; size: number; sizeFormatted: string };
  RUNTIME?: { count: number; size: number; sizeFormatted: string };
  API?: { count: number; size: number; sizeFormatted: string };
  AUDIO?: { count: number; size: number; sizeFormatted: string };
}

export interface PWAIntegrationState {
  isOnline: boolean;
  isOfflineReady: boolean;
  cacheStats: CacheStats | null;
  pendingSyncCount: number;
  updateAvailable: boolean;
  installing: boolean;
}

export function usePWAIntegration(config: PWAIntegrationConfig = {}) {
  const [state, setState] = useState<PWAIntegrationState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOfflineReady: false,
    cacheStats: null,
    pendingSyncCount: 0,
    updateAvailable: false,
    installing: false,
  });

  // Check offline capability
  const checkOfflineCapability = useCallback(async () => {
    if (!serviceWorkerManager) return false;
    
    try {
      const isReady = await serviceWorkerManager.checkOfflineCapability();
      setState(prev => ({ ...prev, isOfflineReady: isReady }));
      return isReady;
    } catch (error) {
      console.error('Failed to check offline capability:', error);
      return false;
    }
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    if (!serviceWorkerManager) return null;
    
    try {
      const stats = await serviceWorkerManager.getCacheStatsFromSW();
      setState(prev => ({ ...prev, cacheStats: stats }));
      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }, []);

  // Preload audio files for TTS
  const preloadAudioFiles = useCallback(async (audioUrls: string[]) => {
    if (!serviceWorkerManager || !config.enableVoiceCache) return;
    
    try {
      await serviceWorkerManager.preloadNextAudio(audioUrls);
      console.log('Audio files preloaded:', audioUrls.length);
    } catch (error) {
      console.error('Failed to preload audio files:', error);
    }
  }, [config.enableVoiceCache]);

  // Cache news articles
  const cacheNewsArticles = useCallback(async (newsUrls: string[]) => {
    if (!serviceWorkerManager || !config.enableNewsCache) return;
    
    try {
      await serviceWorkerManager.cacheUrls(newsUrls);
      console.log('News articles cached:', newsUrls.length);
    } catch (error) {
      console.error('Failed to cache news articles:', error);
    }
  }, [config.enableNewsCache]);

  // Clear cache
  const clearCache = useCallback(async (cacheName?: string) => {
    if (!serviceWorkerManager) return;
    
    try {
      await serviceWorkerManager.clearCache(cacheName);
      console.log('Cache cleared:', cacheName || 'all');
      await getCacheStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [getCacheStats]);

  // Update app
  const updateApp = useCallback(async () => {
    if (!serviceWorkerManager) return;
    
    try {
      setState(prev => ({ ...prev, installing: true }));
      await serviceWorkerManager.skipWaiting();
      console.log('App update initiated');
    } catch (error) {
      console.error('Failed to update app:', error);
      setState(prev => ({ ...prev, installing: false }));
    }
  }, []);

  // Sync offline data
  const syncOfflineData = useCallback(async () => {
    if (!serviceWorkerManager || !state.isOnline) return;
    
    try {
      await serviceWorkerManager.triggerSync('sync-api-requests');
      await serviceWorkerManager.triggerSync('sync-user-progress');
      console.log('Offline data sync triggered');
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }, [state.isOnline]);

  // Initialize PWA integration
  useEffect(() => {
    if (!serviceWorkerManager) return;

    // Check initial offline capability
    checkOfflineCapability();

    // Set up network listeners
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      if (config.enableProgressSync) {
        syncOfflineData();
      }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkOfflineCapability, syncOfflineData, config.enableProgressSync]);

  // Periodic cache stats update
  useEffect(() => {
    if (!serviceWorkerManager) return;

    const updateStats = async () => {
      await getCacheStats();
    };

    // Initial stats
    updateStats();

    // Update every 30 seconds
    const interval = setInterval(updateStats, 30000);

    return () => clearInterval(interval);
  }, [getCacheStats]);

  return {
    // State
    ...state,
    
    // Actions
    checkOfflineCapability,
    getCacheStats,
    preloadAudioFiles,
    cacheNewsArticles,
    clearCache,
    updateApp,
    syncOfflineData,
    
    // Utilities
    formatCacheSize: (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Network info
    getNetworkInfo: () => serviceWorkerManager?.getNetworkStatus() || null,
  };
}

// Export helper function for voice integration
export function useVoicePWAIntegration() {
  const pwa = usePWAIntegration({
    enableVoiceCache: true,
    enableNewsCache: true,
    enableProgressSync: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
  });

  // Enhanced preload with voice context
  const preloadVoiceContent = useCallback(async (
    audioUrls: string[],
    newsUrls: string[] = []
  ) => {
    const promises = [];
    
    if (audioUrls.length > 0) {
      promises.push(pwa.preloadAudioFiles(audioUrls));
    }
    
    if (newsUrls.length > 0) {
      promises.push(pwa.cacheNewsArticles(newsUrls));
    }
    
    try {
      await Promise.all(promises);
      console.log('Voice content preloaded successfully');
    } catch (error) {
      console.error('Failed to preload voice content:', error);
    }
  }, [pwa]);

  return {
    ...pwa,
    preloadVoiceContent,
  };
}