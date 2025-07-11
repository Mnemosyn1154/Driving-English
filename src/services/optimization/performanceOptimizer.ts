import { performanceMonitor } from '@/utils/performance';
import type { PerformanceMetric } from '@/types/performance';

interface OptimizationConfig {
  bundleSplitting: {
    enabled: boolean;
    minChunkSize: number;
    maxChunkSize: number;
    cacheGroups: string[];
  };
  imageOptimization: {
    enabled: boolean;
    quality: number;
    format: 'webp' | 'avif' | 'jpeg';
    lazyLoadThreshold: number;
  };
  audioOptimization: {
    enabled: boolean;
    bitrate: number;
    compression: 'aac' | 'mp3' | 'opus';
  };
  cacheStrategy: {
    enabled: boolean;
    ttl: number;
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  };
  featureToggling: {
    enabled: boolean;
    performanceThresholds: {
      lcp: number;
      fid: number;
      cls: number;
    };
  };
}

interface OptimizationRule {
  id: string;
  name: string;
  condition: (metrics: PerformanceMetric[]) => boolean;
  action: () => Promise<void>;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

export class PerformanceOptimizer {
  private config: OptimizationConfig;
  private rules: OptimizationRule[] = [];
  private isOptimizing = false;
  private optimizationHistory: Array<{
    timestamp: string;
    rule: string;
    metrics: PerformanceMetric[];
    success: boolean;
  }> = [];

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      bundleSplitting: {
        enabled: true,
        minChunkSize: 20000,
        maxChunkSize: 100000,
        cacheGroups: ['vendor', 'common', 'components'],
        ...config.bundleSplitting
      },
      imageOptimization: {
        enabled: true,
        quality: 85,
        format: 'webp',
        lazyLoadThreshold: 0.1,
        ...config.imageOptimization
      },
      audioOptimization: {
        enabled: true,
        bitrate: 64,
        compression: 'aac',
        ...config.audioOptimization
      },
      cacheStrategy: {
        enabled: true,
        ttl: 3600000, // 1 hour
        strategy: 'stale-while-revalidate',
        ...config.cacheStrategy
      },
      featureToggling: {
        enabled: true,
        performanceThresholds: {
          lcp: 2500,
          fid: 100,
          cls: 0.1
        },
        ...config.featureToggling
      }
    };

    this.initializeOptimizationRules();
  }

  private initializeOptimizationRules() {
    this.rules = [
      {
        id: 'slow-lcp-optimization',
        name: 'LCP 최적화',
        condition: (metrics) => {
          const latestLCP = metrics.filter(m => m.name === 'LCP').slice(-5);
          const avgLCP = latestLCP.reduce((sum, m) => sum + m.value, 0) / latestLCP.length;
          return avgLCP > this.config.featureToggling.performanceThresholds.lcp;
        },
        action: async () => {
          await this.optimizeLCP();
        },
        priority: 'high',
        enabled: true
      },
      {
        id: 'high-fid-optimization',
        name: 'FID 최적화',
        condition: (metrics) => {
          const latestFID = metrics.filter(m => m.name === 'FID').slice(-5);
          const avgFID = latestFID.reduce((sum, m) => sum + m.value, 0) / latestFID.length;
          return avgFID > this.config.featureToggling.performanceThresholds.fid;
        },
        action: async () => {
          await this.optimizeFID();
        },
        priority: 'high',
        enabled: true
      },
      {
        id: 'layout-shift-optimization',
        name: 'CLS 최적화',
        condition: (metrics) => {
          const latestCLS = metrics.filter(m => m.name === 'CLS').slice(-5);
          const avgCLS = latestCLS.reduce((sum, m) => sum + m.value, 0) / latestCLS.length;
          return avgCLS > this.config.featureToggling.performanceThresholds.cls;
        },
        action: async () => {
          await this.optimizeCLS();
        },
        priority: 'medium',
        enabled: true
      },
      {
        id: 'bundle-size-optimization',
        name: '번들 크기 최적화',
        condition: (metrics) => {
          const customMetrics = metrics.filter(m => m.name === 'bundle-size');
          return customMetrics.length > 0 && customMetrics[0].value > 500000; // 500KB
        },
        action: async () => {
          await this.optimizeBundleSize();
        },
        priority: 'medium',
        enabled: true
      },
      {
        id: 'memory-optimization',
        name: '메모리 사용량 최적화',
        condition: (metrics) => {
          const memoryMetrics = metrics.filter(m => m.name === 'memory-usage');
          return memoryMetrics.length > 0 && memoryMetrics[0].value > 50000000; // 50MB
        },
        action: async () => {
          await this.optimizeMemoryUsage();
        },
        priority: 'low',
        enabled: true
      }
    ];
  }

  public async startOptimization() {
    if (this.isOptimizing) {
      console.log('Optimization already in progress');
      return;
    }

    this.isOptimizing = true;
    
    try {
      const metrics = await this.getPerformanceMetrics();
      console.log('Starting performance optimization with metrics:', metrics);

      const applicableRules = this.rules
        .filter(rule => rule.enabled && rule.condition(metrics))
        .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

      for (const rule of applicableRules) {
        try {
          console.log(`Applying optimization rule: ${rule.name}`);
          await rule.action();
          
          this.optimizationHistory.push({
            timestamp: new Date().toISOString(),
            rule: rule.name,
            metrics,
            success: true
          });
        } catch (error) {
          console.error(`Failed to apply optimization rule ${rule.name}:`, error);
          
          this.optimizationHistory.push({
            timestamp: new Date().toISOString(),
            rule: rule.name,
            metrics,
            success: false
          });
        }
      }

      // Update cache strategy based on performance
      await this.updateCacheStrategy(metrics);

    } catch (error) {
      console.error('Performance optimization failed:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  private getPriorityWeight(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetric[]> {
    // Get metrics from performance monitor
    const webVitals = await this.getWebVitals();
    const customMetrics = await this.getCustomMetrics();
    
    return [...webVitals, ...customMetrics];
  }

  private async getWebVitals(): Promise<PerformanceMetric[]> {
    return new Promise((resolve) => {
      const metrics: PerformanceMetric[] = [];
      
      // Get LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          metrics.push({
            name: 'LCP',
            value: lastEntry.startTime,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP observation not supported');
      }

      // Get FID
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            metrics.push({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              timestamp: new Date().toISOString()
            });
          }
        });
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID observation not supported');
      }

      // Get CLS
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        
        if (clsValue > 0) {
          metrics.push({
            name: 'CLS',
            value: clsValue,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('CLS observation not supported');
      }

      // Return metrics after a short delay
      setTimeout(() => {
        resolve(metrics);
      }, 1000);
    });
  }

  private async getCustomMetrics(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    
    // Bundle size metric
    if (window.performance && window.performance.memory) {
      metrics.push({
        name: 'memory-usage',
        value: (window.performance.memory as any).usedJSHeapSize,
        timestamp: new Date().toISOString()
      });
    }

    // Custom bundle size tracking would need to be implemented
    // For now, we'll estimate based on resource timing
    const resourceEntries = performance.getEntriesByType('resource');
    const totalBundleSize = resourceEntries
      .filter(entry => entry.name.includes('.js') || entry.name.includes('.css'))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    
    if (totalBundleSize > 0) {
      metrics.push({
        name: 'bundle-size',
        value: totalBundleSize,
        timestamp: new Date().toISOString()
      });
    }

    return metrics;
  }

  private async optimizeLCP() {
    console.log('Optimizing LCP...');
    
    // 1. Lazy load images below the fold
    if (this.config.imageOptimization.enabled) {
      await this.enableLazyLoading();
    }

    // 2. Preload critical resources
    await this.preloadCriticalResources();

    // 3. Optimize font loading
    await this.optimizeFontLoading();
  }

  private async optimizeFID() {
    console.log('Optimizing FID...');
    
    // 1. Defer non-critical JavaScript
    await this.deferNonCriticalJS();

    // 2. Break up long tasks
    await this.breakUpLongTasks();

    // 3. Use web workers for heavy computations
    await this.enableWebWorkers();
  }

  private async optimizeCLS() {
    console.log('Optimizing CLS...');
    
    // 1. Set explicit dimensions for images and videos
    await this.setImageDimensions();

    // 2. Reserve space for dynamic content
    await this.reserveSpaceForDynamicContent();

    // 3. Avoid inserting content above existing content
    await this.optimizeContentInsertion();
  }

  private async optimizeBundleSize() {
    console.log('Optimizing bundle size...');
    
    // 1. Enable code splitting for routes
    await this.enableCodeSplitting();

    // 2. Tree shake unused code
    await this.enableTreeShaking();

    // 3. Compress assets
    await this.compressAssets();
  }

  private async optimizeMemoryUsage() {
    console.log('Optimizing memory usage...');
    
    // 1. Clean up unused event listeners
    await this.cleanupEventListeners();

    // 2. Optimize image loading
    await this.optimizeImageLoading();

    // 3. Implement virtual scrolling for large lists
    await this.enableVirtualScrolling();
  }

  private async enableLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      }, { threshold: this.config.imageOptimization.lazyLoadThreshold });

      images.forEach(img => imageObserver.observe(img));
    }
  }

  private async preloadCriticalResources() {
    // Add preload links for critical resources
    const criticalResources = [
      '/fonts/main.woff2',
      '/css/critical.css',
      '/js/critical.js'
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      if (resource.endsWith('.woff2')) {
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
      } else if (resource.endsWith('.css')) {
        link.as = 'style';
      } else if (resource.endsWith('.js')) {
        link.as = 'script';
      }
      
      document.head.appendChild(link);
    });
  }

  private async optimizeFontLoading() {
    // Use font-display: swap for better perceived performance
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'main';
        font-display: swap;
        src: url('/fonts/main.woff2') format('woff2');
      }
    `;
    document.head.appendChild(style);
  }

  private async deferNonCriticalJS() {
    // Mark non-critical scripts for deferred loading
    const scripts = document.querySelectorAll('script[data-defer]');
    scripts.forEach(script => {
      (script as HTMLScriptElement).defer = true;
    });
  }

  private async breakUpLongTasks() {
    // This would be implemented at the component level
    // For now, we'll set a flag for components to use
    (window as any).__useScheduler = true;
  }

  private async enableWebWorkers() {
    // Register web workers for heavy computations
    if ('Worker' in window) {
      (window as any).__webWorkersEnabled = true;
    }
  }

  private async setImageDimensions() {
    const images = document.querySelectorAll('img:not([width]):not([height])');
    images.forEach(img => {
      const imageEl = img as HTMLImageElement;
      if (imageEl.naturalWidth && imageEl.naturalHeight) {
        imageEl.width = imageEl.naturalWidth;
        imageEl.height = imageEl.naturalHeight;
      }
    });
  }

  private async reserveSpaceForDynamicContent() {
    // Add CSS for skeleton screens
    const style = document.createElement('style');
    style.textContent = `
      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, transparent 37%, #f0f0f0 63%);
        background-size: 400% 100%;
        animation: skeleton-loading 1.4s ease-in-out infinite;
      }
      
      @keyframes skeleton-loading {
        0% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    document.head.appendChild(style);
  }

  private async optimizeContentInsertion() {
    // This would be implemented at the component level
    (window as any).__optimizeContentInsertion = true;
  }

  private async enableCodeSplitting() {
    // Code splitting would be configured at build time
    // For now, we'll set a flag
    (window as any).__codeSplittingEnabled = true;
  }

  private async enableTreeShaking() {
    // Tree shaking would be configured at build time
    (window as any).__treeShakingEnabled = true;
  }

  private async compressAssets() {
    // Asset compression would be configured at build time
    (window as any).__assetCompressionEnabled = true;
  }

  private async cleanupEventListeners() {
    // Clean up abandoned event listeners
    const elements = document.querySelectorAll('[data-cleanup-listeners]');
    elements.forEach(el => {
      el.removeAttribute('data-cleanup-listeners');
    });
  }

  private async optimizeImageLoading() {
    // Convert images to more efficient formats
    const images = document.querySelectorAll('img[src*=".jpg"], img[src*=".png"]');
    images.forEach(img => {
      const imageEl = img as HTMLImageElement;
      if (this.supportsWebP()) {
        imageEl.src = imageEl.src.replace(/\.(jpg|png)$/, '.webp');
      }
    });
  }

  private async enableVirtualScrolling() {
    // Virtual scrolling would be implemented at the component level
    (window as any).__virtualScrollingEnabled = true;
  }

  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  private async updateCacheStrategy(metrics: PerformanceMetric[]) {
    if (!this.config.cacheStrategy.enabled) return;

    const avgResponseTime = metrics
      .filter(m => m.name === 'api-response-time')
      .reduce((sum, m) => sum + m.value, 0) / metrics.length;

    let newStrategy = this.config.cacheStrategy.strategy;
    
    if (avgResponseTime > 1000) {
      newStrategy = 'cache-first';
    } else if (avgResponseTime < 200) {
      newStrategy = 'network-first';
    } else {
      newStrategy = 'stale-while-revalidate';
    }

    if (newStrategy !== this.config.cacheStrategy.strategy) {
      this.config.cacheStrategy.strategy = newStrategy;
      await this.updateServiceWorkerCache(newStrategy);
    }
  }

  private async updateServiceWorkerCache(strategy: string) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_CACHE_STRATEGY',
        strategy
      });
    }
  }

  public getOptimizationHistory() {
    return this.optimizationHistory;
  }

  public getConfig() {
    return this.config;
  }

  public updateConfig(newConfig: Partial<OptimizationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public toggleRule(ruleId: string, enabled: boolean) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();