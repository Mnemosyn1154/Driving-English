/**
 * Performance monitoring and optimization utilities
 */

import { config, isDevelopment } from '@/lib/env';

interface PerformanceMetrics {
  pageLoad: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: Map<string, PerformanceObserver> = new Map();

  /**
   * Initialize performance monitoring
   */
  init() {
    if (typeof window === 'undefined') return;

    // Page load time
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.pageLoad = navigation.loadEventEnd - navigation.fetchStart;
      }
    });

    // First Contentful Paint & Largest Contentful Paint
    this.observePaintTimings();

    // Cumulative Layout Shift
    this.observeLayoutShift();

    // First Input Delay
    this.observeFirstInput();

    // Time to Interactive (approximation)
    this.measureTimeToInteractive();

    // Report metrics periodically
    this.scheduleReporting();
  }

  /**
   * Observe paint timings
   */
  private observePaintTimings() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime;
          } else if (entry.entryType === 'largest-contentful-paint') {
            this.metrics.largestContentfulPaint = entry.startTime;
          }
        }
      });

      paintObserver.observe({ 
        entryTypes: ['paint', 'largest-contentful-paint'] 
      });

      this.observers.set('paint', paintObserver);
    } catch (error) {
      console.error('Failed to observe paint timings:', error);
    }
  }

  /**
   * Observe layout shift
   */
  private observeLayoutShift() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let clsValue = 0;
      let clsEntries: PerformanceEntry[] = [];

      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            clsEntries.push(entry);
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue;
      });

      layoutShiftObserver.observe({ 
        type: 'layout-shift', 
        buffered: true 
      });

      this.observers.set('layout-shift', layoutShiftObserver);
    } catch (error) {
      console.error('Failed to observe layout shift:', error);
    }
  }

  /**
   * Observe first input delay
   */
  private observeFirstInput() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const firstInputObserver = new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0];
        if (firstInput) {
          this.metrics.firstInputDelay = 
            (firstInput as any).processingStart - firstInput.startTime;
        }
      });

      firstInputObserver.observe({ 
        type: 'first-input', 
        buffered: true 
      });

      this.observers.set('first-input', firstInputObserver);
    } catch (error) {
      console.error('Failed to observe first input:', error);
    }
  }

  /**
   * Measure time to interactive
   */
  private measureTimeToInteractive() {
    // Simple approximation using Long Tasks API
    if (!('PerformanceObserver' in window)) return;

    try {
      let lastLongTaskTime = 0;
      
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          lastLongTaskTime = Math.max(lastLongTaskTime, entry.startTime + entry.duration);
        }
      });

      longTaskObserver.observe({ type: 'longtask' });
      
      // Estimate TTI after 5 seconds of no long tasks
      setTimeout(() => {
        const now = performance.now();
        if (now - lastLongTaskTime > 5000) {
          this.metrics.timeToInteractive = lastLongTaskTime || now;
        }
      }, 5000);

      this.observers.set('longtask', longTaskObserver);
    } catch (error) {
      console.error('Failed to measure TTI:', error);
    }
  }

  /**
   * Schedule periodic reporting
   */
  private scheduleReporting() {
    // Report after page is fully loaded
    if (document.readyState === 'complete') {
      setTimeout(() => this.report(), 3000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.report(), 3000);
      });
    }

    // Report on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.report();
      }
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  /**
   * Report metrics
   */
  private async report() {
    const metrics = this.getMetrics();
    
    // Log to console in development
    if (isDevelopment) {
      console.log('Performance Metrics:', metrics);
    }

    // Send to analytics or monitoring service
    if ('sendBeacon' in navigator && config.features.analyticsEndpoint) {
      const payload = JSON.stringify({
        metrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      navigator.sendBeacon(
        config.features.analyticsEndpoint,
        payload
      );
    }
  }

  /**
   * Clean up observers
   */
  destroy() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Resource hint utilities
 */
export const resourceHints = {
  /**
   * Preconnect to external origins
   */
  preconnect(origin: string) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  },

  /**
   * DNS prefetch for external domains
   */
  dnsPrefetch(origin: string) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = origin;
    document.head.appendChild(link);
  },

  /**
   * Prefetch resources
   */
  prefetch(url: string, as?: string) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    if (as) link.as = as;
    document.head.appendChild(link);
  },

  /**
   * Preload critical resources
   */
  preload(url: string, as: string) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    if (as === 'font') link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  },
};

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Request idle callback with fallback
   */
  requestIdleCallback(
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ): number {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, options);
    }
    
    // Fallback to setTimeout
    return window.setTimeout(() => callback({
      didTimeout: false,
      timeRemaining: () => 50,
    } as IdleDeadline), 1);
  },

  /**
   * Cancel idle callback
   */
  cancelIdleCallback(id: number): void {
    if ('cancelIdleCallback' in window) {
      window.cancelIdleCallback(id);
    } else {
      window.clearTimeout(id);
    }
  },

  /**
   * Lazy load images with intersection observer
   */
  lazyLoadImages(selector: string = 'img[data-src]') {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      const images = document.querySelectorAll(selector);
      images.forEach((img) => {
        const imgElement = img as HTMLImageElement;
        if (imgElement.dataset.src) {
          imgElement.src = imgElement.dataset.src;
          delete imgElement.dataset.src;
        }
      });
      return;
    }

    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              delete img.dataset.src;
              imageObserver.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
      }
    );

    document.querySelectorAll(selector).forEach((img) => {
      imageObserver.observe(img);
    });
  },
};