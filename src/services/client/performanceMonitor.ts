'use client';

import { onCLS, onFID, onFCP, onINP, onLCP, onTTFB, Metric } from 'web-vitals';
import { v4 as uuidv4 } from 'uuid';
import { PerformanceMetric, MetricName, PERFORMANCE_THRESHOLDS, VoicePerformanceMetric, PerformanceReport } from '@/types/performance';

class PerformanceMonitor {
  private metrics: Map<MetricName, PerformanceMetric> = new Map();
  private voiceMetrics: VoicePerformanceMetric[] = [];
  private customMetrics: Record<string, number> = {};
  private sessionId: string;
  private reportQueue: PerformanceReport[] = [];
  private isOnline: boolean = navigator.onLine;
  private reportInterval: number = 30000; // 30 seconds
  private reportTimer?: NodeJS.Timeout;

  constructor() {
    this.sessionId = uuidv4();
    this.initializeWebVitals();
    this.setupEventListeners();
    this.startReportingCycle();
  }

  private initializeWebVitals() {
    // Core Web Vitals
    onCLS(this.handleMetric.bind(this));
    onFID(this.handleMetric.bind(this));
    onFCP(this.handleMetric.bind(this));
    onINP(this.handleMetric.bind(this));
    onLCP(this.handleMetric.bind(this));
    onTTFB(this.handleMetric.bind(this));
  }

  private handleMetric(metric: Metric) {
    const threshold = PERFORMANCE_THRESHOLDS[metric.name as MetricName];
    let rating: 'good' | 'needs-improvement' | 'poor' = 'good';
    
    if (threshold) {
      if (metric.value <= threshold.good) {
        rating = 'good';
      } else if (metric.value <= threshold.needsImprovement) {
        rating = 'needs-improvement';
      } else {
        rating = 'poor';
      }
    }

    const performanceMetric: PerformanceMetric = {
      id: uuidv4(),
      name: metric.name as MetricName,
      value: metric.value,
      rating,
      delta: metric.delta || 0,
      entries: metric.entries || [],
      timestamp: Date.now(),
      url: window.location.href,
      deviceType: this.getDeviceType()
    };

    this.metrics.set(metric.name as MetricName, performanceMetric);
    console.log(`[Performance] ${metric.name}: ${metric.value}ms (${rating})`);
    
    // Store locally
    this.storeMetricLocally(performanceMetric);
  }

  private getDeviceType(): 'mobile' | 'desktop' {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      ? 'mobile' 
      : 'desktop';
  }

  private setupEventListeners() {
    // Network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushReportQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sendReport();
      }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
      this.sendReport(true);
    });
  }

  private startReportingCycle() {
    this.reportTimer = setInterval(() => {
      this.sendReport();
    }, this.reportInterval);
  }

  // Voice performance tracking
  public trackVoicePerformance(type: 'stt' | 'tts', startTime: number, endTime: number, success: boolean, metadata?: any) {
    const metric: VoicePerformanceMetric = {
      id: uuidv4(),
      type,
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      metadata
    };

    this.voiceMetrics.push(metric);
    console.log(`[Voice Performance] ${type}: ${metric.duration}ms (${success ? 'success' : 'failed'})`);
  }

  // Custom metrics
  public trackCustomMetric(name: string, value: number) {
    this.customMetrics[name] = value;
    console.log(`[Custom Metric] ${name}: ${value}`);
  }

  // Manual page load tracking
  public trackPageLoad() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      this.trackCustomMetric('domContentLoaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
      this.trackCustomMetric('loadComplete', navigation.loadEventEnd - navigation.loadEventStart);
      this.trackCustomMetric('domInteractive', navigation.domInteractive - navigation.fetchStart);
    }
  }

  // API response time tracking
  public trackApiCall(url: string, startTime: number, endTime: number, success: boolean) {
    const duration = endTime - startTime;
    const key = `api_${new URL(url).pathname.replace(/\//g, '_')}`;
    
    if (!this.customMetrics[`${key}_count`]) {
      this.customMetrics[`${key}_count`] = 0;
      this.customMetrics[`${key}_total`] = 0;
      this.customMetrics[`${key}_errors`] = 0;
    }
    
    this.customMetrics[`${key}_count`]++;
    this.customMetrics[`${key}_total`] += duration;
    if (!success) {
      this.customMetrics[`${key}_errors`]++;
    }
    
    console.log(`[API Performance] ${url}: ${duration}ms (${success ? 'success' : 'failed'})`);
  }

  private storeMetricLocally(metric: PerformanceMetric) {
    try {
      const stored = localStorage.getItem('performance_metrics') || '[]';
      const metrics = JSON.parse(stored);
      metrics.push(metric);
      
      // Keep only last 100 metrics
      if (metrics.length > 100) {
        metrics.splice(0, metrics.length - 100);
      }
      
      localStorage.setItem('performance_metrics', JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to store performance metric:', error);
    }
  }

  private async sendReport(immediate = false) {
    const report: PerformanceReport = {
      id: uuidv4(),
      sessionId: this.sessionId,
      userId: this.getUserId(),
      url: window.location.href,
      webVitals: Array.from(this.metrics.values()),
      voiceMetrics: [...this.voiceMetrics],
      customMetrics: { ...this.customMetrics },
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      connectionType: this.getConnectionType()
    };

    if (!this.isOnline && !immediate) {
      this.reportQueue.push(report);
      return;
    }

    try {
      const response = await fetch('/api/performance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        keepalive: immediate // Use keepalive for beforeunload
      });

      if (response.ok) {
        console.log('[Performance] Report sent successfully');
        // Clear sent metrics
        this.voiceMetrics = [];
        this.customMetrics = {};
      } else {
        throw new Error(`Failed to send report: ${response.status}`);
      }
    } catch (error) {
      console.error('[Performance] Failed to send report:', error);
      if (!immediate) {
        this.reportQueue.push(report);
      }
    }
  }

  private async flushReportQueue() {
    if (this.reportQueue.length === 0) return;

    const queue = [...this.reportQueue];
    this.reportQueue = [];

    for (const report of queue) {
      try {
        await fetch('/api/performance/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
      } catch (error) {
        console.error('[Performance] Failed to flush report:', error);
        this.reportQueue.push(report);
      }
    }
  }

  private getUserId(): string | undefined {
    // Try to get user ID from various sources
    try {
      const authData = localStorage.getItem('sb-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private getConnectionType(): string | undefined {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    return connection?.effectiveType;
  }

  // Cleanup
  public destroy() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
    this.sendReport(true);
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function initPerformanceMonitor() {
  if (typeof window === 'undefined') return null;
  
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  
  return performanceMonitor;
}

export function getPerformanceMonitor() {
  return performanceMonitor;
}

export function destroyPerformanceMonitor() {
  if (performanceMonitor) {
    performanceMonitor.destroy();
    performanceMonitor = null;
  }
}