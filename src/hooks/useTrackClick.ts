'use client';

import { useCallback } from 'react';
import { useAnalytics } from '@/providers/AnalyticsProvider';

export function useTrackClick() {
  const { trackEvent } = useAnalytics();

  const trackClick = useCallback((
    action: string, 
    label?: string, 
    value?: number,
    metadata?: Record<string, any>
  ) => {
    trackEvent('button_click', {
      action,
      label,
      value,
      ...metadata
    });
  }, [trackEvent]);

  return trackClick;
}