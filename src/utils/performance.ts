/**
 * Performance monitoring and optimization utilities
 */

import { isDevelopment } from '@/lib/env';
import { onCLS, onFCP, onINP, onLCP, onTTFB, Metric } from 'web-vitals';
import { v4 as uuidv4 } from 'uuid';

interface PerformanceMetrics {
  pageLoad: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  interactionToNextPaint?: number;
  timeToFirstByte?: number;
}

interface VoiceMetrics {
  sttDuration: number[];
  ttsDuration: number[];
  sttErrors: number;
  ttsErrors: number;
  totalSttCalls: number;
  totalTtsCalls: number;
}

interface ApiMetrics {
  [endpoint: string]: {
    count: number;
    totalDuration: number;
    errors: number;
    avgDuration?: number;
  };
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private voiceMetrics: VoiceMetrics = {
    sttDuration: [],
    ttsDuration: [],
    sttErrors: 0,
    ttsErrors: 0,
    totalSttCalls: 0,
    totalTtsCalls: 0
  };
  private apiMetrics: ApiMetrics = {};
  private observers: Map<string, PerformanceObserver> = new Map();
  private sessionId: string = uuidv4();
  private reportQueue: unknown[] = [];
  private reportTimer?: NodeJS.Timeout;

  /**
   * Initialize performance monitoring
   */
  init() {
    if (typeof window === 'undefined') return;

    // Initialize Web Vitals
    this.initializeWebVitals();

    // Page load time
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.metrics.pageLoad = navigation.loadEventEnd - navigation.fetchStart;
      }
    });

    // Time to Interactive (approximation)
    this.measureTimeToInteractive();

    // Report metrics periodically
    this.scheduleReporting();
  }

  /**
   * Initialize Web Vitals monitoring
   */
  private initializeWebVitals() {
    // Core Web Vitals
    onCLS((metric) => {
      this.metrics.cumulativeLayoutShift = metric.value;
      this.logMetric('CLS', metric);
    });

    // FID is deprecated in web-vitals v5+, INP is the replacement
    // onFID((metric) => {
    //   this.metrics.firstInputDelay = metric.value;
    //   this.logMetric('FID', metric);
    // });

    onFCP((metric) => {
      this.metrics.firstContentfulPaint = metric.value;
      this.logMetric('FCP', metric);
    });

    onINP((metric) => {
      this.metrics.interactionToNextPaint = metric.value;
      this.logMetric('INP', metric);
    });

    onLCP((metric) => {
      this.metrics.largestContentfulPaint = metric.value;
      this.logMetric('LCP', metric);
    });

    onTTFB((metric) => {
      this.metrics.timeToFirstByte = metric.value;
      this.logMetric('TTFB', metric);
    });
  }

  private logMetric(name: string, metric: Metric) {
    if (isDevelopment) {
      console.log(`[Performance] ${name}: ${metric.value.toFixed(2)}ms`);
    }
  }

  /**
   * Track voice performance (STT/TTS)
   */
  trackVoicePerformance(type: 'stt' | 'tts', startTime: number, endTime: number, success: boolean) {
    const duration = endTime - startTime;
    
    if (type === 'stt') {
      this.voiceMetrics.totalSttCalls++;
      if (success) {
        this.voiceMetrics.sttDuration.push(duration);
      } else {
        this.voiceMetrics.sttErrors++;
      }
    } else {
      this.voiceMetrics.totalTtsCalls++;
      if (success) {
        this.voiceMetrics.ttsDuration.push(duration);
      } else {
        this.voiceMetrics.ttsErrors++;
      }
    }

    if (isDevelopment) {
      console.log(`[Voice Performance] ${type.toUpperCase()}: ${duration}ms (${success ? 'success' : 'failed'})`);
    }
  }

  /**
   * Track API call performance
   */
  trackApiCall(url: string, startTime: number, endTime: number, success: boolean) {
    const duration = endTime - startTime;
    const endpoint = new URL(url, window.location.origin).pathname;
    
    if (!this.apiMetrics[endpoint]) {
      this.apiMetrics[endpoint] = {
        count: 0,
        totalDuration: 0,
        errors: 0
      };
    }
    
    this.apiMetrics[endpoint].count++;
    this.apiMetrics[endpoint].totalDuration += duration;
    if (!success) {
      this.apiMetrics[endpoint].errors++;
    }
    
    // Calculate average duration
    this.apiMetrics[endpoint].avgDuration = 
      this.apiMetrics[endpoint].totalDuration / this.apiMetrics[endpoint].count;

    if (isDevelopment) {
      console.log(`[API Performance] ${endpoint}: ${duration}ms (${success ? 'success' : 'failed'})`);
    }
  }

  /**
   * Track custom metric
   */
  trackCustomMetric(name: string, value: number) {
    if (isDevelopment) {
      console.log(`[Custom Metric] ${name}: ${value}`);
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
  getMetrics() {
    return { 
      webVitals: { ...this.metrics },
      voiceMetrics: { ...this.voiceMetrics },
      apiMetrics: { ...this.apiMetrics }
    };
  }

  /**
   * Report metrics
   */
  private async report() {
    const allMetrics = this.getMetrics();
    
    // Calculate voice performance averages
    const voiceAvgMetrics = {
      avgSttDuration: this.voiceMetrics.sttDuration.length > 0 
        ? this.voiceMetrics.sttDuration.reduce((a, b) => a + b, 0) / this.voiceMetrics.sttDuration.length 
        : 0,
      avgTtsDuration: this.voiceMetrics.ttsDuration.length > 0
        ? this.voiceMetrics.ttsDuration.reduce((a, b) => a + b, 0) / this.voiceMetrics.ttsDuration.length
        : 0,
      sttSuccessRate: this.voiceMetrics.totalSttCalls > 0
        ? ((this.voiceMetrics.totalSttCalls - this.voiceMetrics.sttErrors) / this.voiceMetrics.totalSttCalls) * 100
        : 0,
      ttsSuccessRate: this.voiceMetrics.totalTtsCalls > 0
        ? ((this.voiceMetrics.totalTtsCalls - this.voiceMetrics.ttsErrors) / this.voiceMetrics.totalTtsCalls) * 100
        : 0
    };

    const report = {
      sessionId: this.sessionId,
      ...allMetrics,
      voiceAvgMetrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      connectionType: (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType
    };
    
    // Log to console in development
    if (isDevelopment) {
      console.log('Performance Report:', report);
    }

    // Try to send to API endpoint
    try {
      const response = await fetch('/api/performance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        keepalive: true
      });

      if (!response.ok) {
        throw new Error(`Failed to send report: ${response.status}`);
      }

      // Clear voice metrics after successful report
      this.voiceMetrics.sttDuration = [];
      this.voiceMetrics.ttsDuration = [];
    } catch (error) {
      console.error('[Performance] Failed to send report:', error);
      // Store in queue for retry
      this.reportQueue.push(report);
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
  debounce<T extends (...args: unknown[]) => unknown>(
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
  throttle<T extends (...args: unknown[]) => unknown>(
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