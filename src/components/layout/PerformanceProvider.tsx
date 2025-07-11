'use client';

import { useEffect, createContext, useContext, useCallback } from 'react';
import { usePerformance } from '@/hooks/usePerformance';
import { performanceMonitor } from '@/utils/performance';

interface PerformanceContextType {
  trackApiCall: (url: string, startTime: number, endTime: number, success: boolean) => void;
  trackVoicePerformance: (type: 'stt' | 'tts', startTime: number, endTime: number, success: boolean) => void;
  trackCustomMetric: (name: string, value: number) => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const { preconnect, preloadResources } = usePerformance({
    enableMonitoring: true,
    reportMetrics: true,
    lazyLoadImages: true,
    prefetchLinks: true,
  });

  useEffect(() => {
    // Preconnect to external services
    preconnect([
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://www.googleapis.com', // Google APIs
      'https://storage.googleapis.com', // Google Cloud Storage
    ]);

    // Preload critical resources only on pages that use them
    // Commenting out to avoid preload warnings
    // preloadResources([
    //   { url: '/icon.svg', as: 'image' },
    //   { url: '/icons/icon-192x192.png', as: 'image' },
    // ]);
  }, [preconnect, preloadResources]);

  const contextValue: PerformanceContextType = {
    trackApiCall: useCallback((url, startTime, endTime, success) => {
      performanceMonitor.trackApiCall(url, startTime, endTime, success);
    }, []),
    trackVoicePerformance: useCallback((type, startTime, endTime, success) => {
      performanceMonitor.trackVoicePerformance(type, startTime, endTime, success);
    }, []),
    trackCustomMetric: useCallback((name, value) => {
      performanceMonitor.trackCustomMetric(name, value);
    }, [])
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformanceTracking() {
  const context = useContext(PerformanceContext);
  if (!context) {
    // Return no-op functions if context is not available
    return {
      trackApiCall: () => {},
      trackVoicePerformance: () => {},
      trackCustomMetric: () => {}
    };
  }
  return context;
}