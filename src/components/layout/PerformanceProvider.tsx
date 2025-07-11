'use client';

import { useEffect } from 'react';
import { usePerformance } from '@/hooks/usePerformance';

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

  return <>{children}</>;
}