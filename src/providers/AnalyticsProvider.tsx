'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, getAnalytics, destroyAnalytics } from '@/services/client/analyticsService';
import { AnalyticsConfig, VoiceCommandMetrics, LearningProgressMetrics, DrivingModeMetrics } from '@/types/analytics';

interface AnalyticsContextType {
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackVoiceCommand: (metrics: VoiceCommandMetrics) => void;
  trackLearningProgress: (metrics: LearningProgressMetrics) => void;
  trackDrivingMode: (metrics: DrivingModeMetrics) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

const defaultConfig: AnalyticsConfig = {
  enabled: process.env.NODE_ENV !== 'development', // Disable in development
  debug: process.env.NODE_ENV === 'development',
  sampleRate: 1, // Track all events
  sessionTimeout: 30, // 30 minutes
  enabledEvents: [
    'page_view',
    'page_exit',
    'voice_command',
    'button_click',
    'feature_usage',
    'error',
    'offline_transition',
    'online_transition',
    'session_start',
    'session_end',
    'learning_progress',
    'driving_mode_toggle'
  ]
};

export function AnalyticsProvider({ 
  children,
  config = defaultConfig 
}: { 
  children: React.ReactNode;
  config?: AnalyticsConfig;
}) {
  const pathname = usePathname();
  const analyticsRef = useRef<ReturnType<typeof initAnalytics> | null>(null);
  const lastPathname = useRef(pathname);

  useEffect(() => {
    // Initialize analytics
    analyticsRef.current = initAnalytics(config);

    // Track initial page view
    analyticsRef.current.trackPageView();

    return () => {
      destroyAnalytics();
    };
  }, [config]);

  // Track page views on route change
  useEffect(() => {
    if (pathname !== lastPathname.current) {
      const analytics = getAnalytics();
      if (analytics) {
        analytics.trackPageView({
          from: lastPathname.current,
          to: pathname
        });
      }
      lastPathname.current = pathname;
    }
  }, [pathname]);

  const contextValue: AnalyticsContextType = {
    trackEvent: (eventName, properties) => {
      const analytics = getAnalytics();
      analytics?.track(eventName, properties);
    },
    trackVoiceCommand: (metrics) => {
      const analytics = getAnalytics();
      analytics?.trackVoiceCommand(metrics);
    },
    trackLearningProgress: (metrics) => {
      const analytics = getAnalytics();
      analytics?.trackLearningProgress(metrics);
    },
    trackDrivingMode: (metrics) => {
      const analytics = getAnalytics();
      analytics?.trackDrivingMode(metrics);
    }
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    // Return no-op functions if context is not available
    return {
      trackEvent: () => {},
      trackVoiceCommand: () => {},
      trackLearningProgress: () => {},
      trackDrivingMode: () => {}
    };
  }
  return context;
}