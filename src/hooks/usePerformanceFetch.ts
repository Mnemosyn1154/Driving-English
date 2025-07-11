'use client';

import { useCallback } from 'react';
import { usePerformanceTracking } from '@/components/layout/PerformanceProvider';

export function usePerformanceFetch() {
  const { trackApiCall } = usePerformanceTracking();

  const performanceFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const startTime = performance.now();
    let success = false;

    try {
      const response = await fetch(input, init);
      success = response.ok;
      return response;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = performance.now();
      
      // Only track API calls to our own endpoints
      if (url.startsWith('/api/') || url.includes(window.location.origin)) {
        trackApiCall(url, startTime, endTime, success);
      }
    }
  }, [trackApiCall]);

  return performanceFetch;
}