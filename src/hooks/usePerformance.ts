import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor, performanceUtils, resourceHints } from '@/utils/performance';

interface UsePerformanceOptions {
  enableMonitoring?: boolean;
  reportMetrics?: boolean;
  lazyLoadImages?: boolean;
  prefetchLinks?: boolean;
}

export function usePerformance(options: UsePerformanceOptions = {}) {
  const {
    enableMonitoring = true,
    reportMetrics = true,
    lazyLoadImages = true,
    prefetchLinks = true,
  } = options;

  const initialized = useRef(false);

  // Initialize performance monitoring
  useEffect(() => {
    if (!initialized.current && enableMonitoring) {
      performanceMonitor.init();
      initialized.current = true;
    }

    return () => {
      if (initialized.current) {
        performanceMonitor.destroy();
        initialized.current = false;
      }
    };
  }, [enableMonitoring]);

  // Lazy load images
  useEffect(() => {
    if (lazyLoadImages) {
      // Initial load
      performanceUtils.lazyLoadImages();

      // Observer for dynamically added images
      const observer = new MutationObserver(() => {
        performanceUtils.lazyLoadImages();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }
  }, [lazyLoadImages]);

  // Prefetch links on hover
  useEffect(() => {
    if (!prefetchLinks) return;

    const prefetchedUrls = new Set<string>();

    const handleLinkHover = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a');
      if (!link) return;

      const href = link.href;
      if (!href || prefetchedUrls.has(href)) return;

      // Only prefetch internal links
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin) {
          resourceHints.prefetch(href, 'document');
          prefetchedUrls.add(href);
        }
      } catch (error) {
        // Invalid URL
      }
    };

    document.addEventListener('mouseover', handleLinkHover, { passive: true });
    
    return () => {
      document.removeEventListener('mouseover', handleLinkHover);
    };
  }, [prefetchLinks]);

  // Debounced function helper
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ) => {
    return performanceUtils.debounce(func, wait);
  }, []);

  // Throttled function helper
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ) => {
    return performanceUtils.throttle(func, limit);
  }, []);

  // Request idle callback helper
  const requestIdleCallback = useCallback((
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => {
    return performanceUtils.requestIdleCallback(callback, options);
  }, []);

  // Preconnect to external origins
  const preconnect = useCallback((origins: string[]) => {
    origins.forEach(origin => resourceHints.preconnect(origin));
  }, []);

  // Preload critical resources
  const preloadResources = useCallback((resources: Array<{ url: string; as: string }>) => {
    resources.forEach(({ url, as }) => resourceHints.preload(url, as));
  }, []);

  // Get current performance metrics
  const getMetrics = useCallback(() => {
    return performanceMonitor.getMetrics();
  }, []);

  return {
    debounce,
    throttle,
    requestIdleCallback,
    preconnect,
    preloadResources,
    getMetrics,
  };
}

// Hook for intersection observer
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const callbackRef = useRef<IntersectionObserverCallback>();

  useEffect(() => {
    if (!elementRef.current || !callbackRef.current) return;

    const observer = new IntersectionObserver(callbackRef.current, options);
    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [elementRef, options]);

  const observe = useCallback((callback: IntersectionObserverCallback) => {
    callbackRef.current = callback;
  }, []);

  return observe;
}

// Hook for lazy loading
export function useLazyLoad<T extends HTMLElement = HTMLImageElement>(
  threshold: number = 0.1,
  rootMargin: string = '50px'
) {
  const elementRef = useRef<T>(null);
  const loaded = useRef(false);

  const observe = useIntersectionObserver(elementRef, {
    threshold,
    rootMargin,
  });

  useEffect(() => {
    observe((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !loaded.current) {
          const element = entry.target as T;
          
          if (element instanceof HTMLImageElement && element.dataset.src) {
            element.src = element.dataset.src;
            delete element.dataset.src;
            loaded.current = true;
          } else if (element.dataset.load) {
            // Custom lazy loading logic
            element.dispatchEvent(new CustomEvent('lazyload'));
            delete element.dataset.load;
            loaded.current = true;
          }
        }
      });
    });
  }, [observe]);

  return elementRef;
}