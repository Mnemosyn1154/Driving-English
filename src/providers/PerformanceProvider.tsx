'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { initPerformanceMonitor, getPerformanceMonitor, destroyPerformanceMonitor } from '@/services/client/performanceMonitor';

interface PerformanceContextType {
  trackApiCall: (url: string, startTime: number, endTime: number, success: boolean) => void;
  trackVoicePerformance: (type: 'stt' | 'tts', startTime: number, endTime: number, success: boolean, metadata?: any) => void;
  trackCustomMetric: (name: string, value: number) => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const monitorRef = useRef<ReturnType<typeof initPerformanceMonitor>>(null);

  useEffect(() => {
    // Initialize performance monitor on client side only
    monitorRef.current = initPerformanceMonitor();

    // Track initial page load
    if (monitorRef.current) {
      monitorRef.current.trackPageLoad();
    }

    return () => {
      destroyPerformanceMonitor();
    };
  }, []);

  const contextValue: PerformanceContextType = {
    trackApiCall: (url, startTime, endTime, success) => {
      const monitor = getPerformanceMonitor();
      monitor?.trackApiCall(url, startTime, endTime, success);
    },
    trackVoicePerformance: (type, startTime, endTime, success, metadata) => {
      const monitor = getPerformanceMonitor();
      monitor?.trackVoicePerformance(type, startTime, endTime, success, metadata);
    },
    trackCustomMetric: (name, value) => {
      const monitor = getPerformanceMonitor();
      monitor?.trackCustomMetric(name, value);
    }
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
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