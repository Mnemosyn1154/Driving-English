/**
 * Service Worker Registration and Management
 */

import { config, isProduction } from '@/lib/env';

const { features } = config;

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};
  private isOnline: boolean = navigator.onLine;

  /**
   * Register service worker
   */
  async register(config: ServiceWorkerConfig = {}) {
    this.config = config;

    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      // Register enhanced service worker
      const registration = await navigator.serviceWorker.register('/sw-enhanced.js', {
        scope: '/'
      });

      this.registration = registration;
      console.log('Service Worker registered:', registration);

      // Set up event listeners
      this.setupEventListeners();
      this.setupUpdateListener(registration);
      this.setupNetworkListeners();

      // Check for updates
      registration.update();

      if (config.onSuccess) {
        config.onSuccess(registration);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      if (config.onError) {
        config.onError(error as Error);
      }
    }
  }

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.registration) {
      return;
    }

    try {
      await this.registration.unregister();
      this.registration = null;
      console.log('Service Worker unregistered');
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
    }
  }

  /**
   * Set up service worker event listeners
   */
  private setupEventListeners() {
    if (!navigator.serviceWorker) return;

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from Service Worker:', event.data);
      
      if (event.data.type === 'CACHE_UPDATED') {
        // Notify app about cache updates
        window.dispatchEvent(new CustomEvent('sw-cache-updated', { 
          detail: event.data.payload 
        }));
      }
    });

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      // Reload page when service worker updates
      window.location.reload();
    });
  }

  /**
   * Set up update listener
   */
  private setupUpdateListener(registration: ServiceWorkerRegistration) {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('New Service Worker available');
          if (this.config.onUpdate) {
            this.config.onUpdate(registration);
          }
        }
      });
    });
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Network: Online');
      
      if (this.config.onOnline) {
        this.config.onOnline();
      }
      
      // Trigger background sync
      this.triggerSync('sync-api-requests');
      this.triggerSync('sync-user-progress');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Network: Offline');
      
      if (this.config.onOffline) {
        this.config.onOffline();
      }
    });
  }

  /**
   * Send message to service worker
   */
  async sendMessage(message: any) {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active Service Worker');
      return;
    }

    navigator.serviceWorker.controller.postMessage(message);
  }

  /**
   * Trigger background sync
   */
  async triggerSync(tag: string) {
    if (!this.registration || !('sync' in this.registration)) {
      console.warn('Background Sync not supported');
      return;
    }

    try {
      await (this.registration as any).sync.register(tag);
      console.log(`Background sync registered: ${tag}`);
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  /**
   * Cache specific URLs
   */
  async cacheUrls(urls: string[]) {
    await this.sendMessage({
      type: 'CACHE_URLS',
      payload: { urls }
    });
  }

  /**
   * Preload next audio files
   */
  async preloadNextAudio(audioUrls: string[]) {
    await this.sendMessage({
      type: 'PRELOAD_NEXT_AUDIO',
      payload: { audioUrls }
    });
  }

  /**
   * Get cache statistics from service worker
   */
  async getCacheStatsFromSW(): Promise<any> {
    return new Promise((resolve) => {
      if (!navigator.serviceWorker.controller) {
        resolve(null);
        return;
      }

      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_STATS') {
          resolve(event.data.stats);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_STATS' },
        [channel.port2]
      );
    });
  }

  /**
   * Clear specific cache
   */
  async clearCache(cacheName?: string) {
    await this.sendMessage({
      type: 'CLEAR_CACHE',
      payload: { cacheName }
    });
  }

  /**
   * Update service worker
   */
  async update() {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('Service Worker update triggered');
    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }

  /**
   * Skip waiting for new service worker
   */
  async skipWaiting() {
    await this.sendMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      connection: typeof navigator !== 'undefined' ? (navigator as any).connection || null : null
    };
  }

  /**
   * Check if app can work offline
   */
  async checkOfflineCapability(): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      return cacheNames.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!('caches' in window)) {
      return null;
    }

    try {
      const cacheNames = await caches.keys();
      const stats: any = {};

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        stats[cacheName] = {
          count: keys.length,
          urls: keys.map(req => req.url)
        };
      }

      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance - only create in browser
export const serviceWorkerManager = typeof window !== 'undefined' ? new ServiceWorkerManager() : null as any;

// Convenient registration function
export async function registerServiceWorker(config?: ServiceWorkerConfig) {
  // Only register in production
  if (isProduction || features.enableServiceWorker) {
    await serviceWorkerManager.register(config);
  } else {
    console.log('Service Worker disabled in development');
  }
}

// Export manager for advanced usage
export { ServiceWorkerManager };