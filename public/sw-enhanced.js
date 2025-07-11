/**
 * Enhanced Service Worker with IndexedDB integration
 * This file contains the improved service worker implementation
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Configuration
const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'driving-english';
const MAX_CACHE_AGE_DAYS = 7;
const MAX_CACHE_ITEMS = 50;

// Cache names
const CACHE_NAMES = {
  STATIC: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  RUNTIME: `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
  AUDIO: `${CACHE_PREFIX}-audio-${CACHE_VERSION}`,
};

// IndexedDB configuration
const DB_NAME = 'driving-english-offline';
const DB_VERSION = 1;

// Initialize IndexedDB
let db = null;

async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Create sync queue store
      if (!database.objectStoreNames.contains('syncQueue')) {
        const syncStore = database.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('status', 'status');
        syncStore.createIndex('timestamp', 'timestamp');
      }

      // Create settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

// Helper function to add to sync queue
async function addToSyncQueue(data) {
  const database = await initDB();
  const transaction = database.transaction(['syncQueue'], 'readwrite');
  const store = transaction.objectStore('syncQueue');
  
  return store.add({
    ...data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  });
}

// Helper function to get pending sync items
async function getPendingSyncItems() {
  const database = await initDB();
  const transaction = database.transaction(['syncQueue'], 'readonly');
  const store = transaction.objectStore('syncQueue');
  const index = store.index('status');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper function to update sync item
async function updateSyncItem(id, updates) {
  const database = await initDB();
  const transaction = database.transaction(['syncQueue'], 'readwrite');
  const store = transaction.objectStore('syncQueue');
  
  const item = await new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => resolve(getRequest.result);
    getRequest.onerror = () => reject(getRequest.error);
  });

  if (item) {
    return store.put({ ...item, ...updates });
  }
}

// Helper function to get/set settings
async function getSetting(key) {
  const database = await initDB();
  const transaction = database.transaction(['settings'], 'readonly');
  const store = transaction.objectStore('settings');
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

async function setSetting(key, value) {
  const database = await initDB();
  const transaction = database.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  
  return store.put({ key, value });
}

// Workbox configuration
if (workbox) {
  workbox.setConfig({ debug: false });

  // Precaching
  workbox.precaching.precacheAndRoute([
    { url: '/', revision: CACHE_VERSION },
    { url: '/learn', revision: CACHE_VERSION },
    { url: '/driving', revision: CACHE_VERSION },
    { url: '/manifest.json', revision: CACHE_VERSION },
  ]);

  // Routing strategies
  
  // Static assets - Cache First
  workbox.routing.registerRoute(
    ({ request }) => 
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.STATIC,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          maxEntries: 100,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Images - Cache First with expiration
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.STATIC,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          maxEntries: 50,
          purgeOnQuotaError: true,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // API requests - Network First with offline queue
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    async ({ event, request }) => {
      try {
        // Try network first
        const response = await fetch(request.clone());
        
        // Cache successful GET responses
        if (request.method === 'GET' && response.ok) {
          const cache = await caches.open(CACHE_NAMES.API);
          cache.put(request, response.clone());
        }
        
        return response;
      } catch (error) {
        // For GET requests, try cache
        if (request.method === 'GET') {
          const cache = await caches.open(CACHE_NAMES.API);
          const cachedResponse = await cache.match(request);
          
          if (cachedResponse) {
            return cachedResponse;
          }
        }
        
        // For POST/PUT/DELETE, add to sync queue
        if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
          const body = await request.text();
          
          await addToSyncQueue({
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: body,
            type: 'api-request',
          });

          return new Response(
            JSON.stringify({
              success: true,
              offline: true,
              message: '오프라인 상태입니다. 온라인 상태가 되면 자동으로 동기화됩니다.',
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        
        // Default offline response
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: '오프라인 상태입니다.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  );

  // Audio files - Cache First with intelligent preloading
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.match(/\.(mp3|wav|ogg)$/),
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.AUDIO,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          maxEntries: MAX_CACHE_ITEMS,
          purgeOnQuotaError: true,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200, 206], // Include partial content
        }),
        new workbox.rangeRequests.RangeRequestsPlugin(),
      ],
    })
  );

  // Navigation requests - Network First with offline page
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.RUNTIME,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    })
  );
}

// Background sync
self.addEventListener('sync', async (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-api-requests') {
    event.waitUntil(syncApiRequests());
  } else if (event.tag === 'sync-user-progress') {
    event.waitUntil(syncUserProgress());
  } else if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupCache());
  }
});

// Sync API requests from queue
async function syncApiRequests() {
  const items = await getPendingSyncItems();
  const apiItems = items.filter(item => item.type === 'api-request');

  for (const item of apiItems) {
    try {
      await updateSyncItem(item.id, { status: 'syncing' });

      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await updateSyncItem(item.id, { status: 'completed' });
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('[Service Worker] Sync failed:', error);
      
      await updateSyncItem(item.id, {
        status: 'failed',
        error: error.message,
        retryCount: (item.retryCount || 0) + 1,
      });

      // Schedule retry if not exceeded max retries
      if (item.retryCount < 3) {
        const retryDelay = Math.pow(2, item.retryCount) * 60 * 1000; // Exponential backoff
        setTimeout(() => {
          updateSyncItem(item.id, { status: 'pending' });
        }, retryDelay);
      }
    }
  }

  // Update last sync time
  await setSetting('lastSyncTime', Date.now());
}

// Sync user progress
async function syncUserProgress() {
  const items = await getPendingSyncItems();
  const progressItems = items.filter(item => item.type === 'progress');

  if (progressItems.length === 0) return;

  try {
    const response = await fetch('/api/user/progress/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: progressItems.map(item => item.data),
      }),
    });

    if (response.ok) {
      // Mark all items as completed
      for (const item of progressItems) {
        await updateSyncItem(item.id, { status: 'completed' });
      }
    }
  } catch (error) {
    console.error('[Service Worker] Progress sync failed:', error);
  }
}

// Cleanup old cache entries
async function cleanupCache() {
  const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const cacheName of Object.values(CACHE_NAMES)) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseTime = new Date(dateHeader).getTime();
          if (now - responseTime > maxAge) {
            await cache.delete(request);
          }
        }
      }
    }
  }
}

// Message handling
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      await cacheUrls(payload.urls);
      break;

    case 'PRELOAD_NEXT_AUDIO':
      await preloadNextAudio(payload.audioUrls);
      break;

    case 'GET_CACHE_STATS':
      const stats = await getCacheStats();
      event.ports[0].postMessage({ type: 'CACHE_STATS', stats });
      break;

    case 'CLEAR_CACHE':
      await clearCache(payload.cacheName);
      break;
  }
});

// Helper functions
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAMES.RUNTIME);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.error('[Service Worker] Failed to cache URL:', url, error);
    }
  }
}

async function preloadNextAudio(audioUrls) {
  const cache = await caches.open(CACHE_NAMES.AUDIO);
  
  // Preload up to 3 audio files
  const urlsToCache = audioUrls.slice(0, 3);
  
  for (const url of urlsToCache) {
    const cached = await cache.match(url);
    if (!cached) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error('[Service Worker] Failed to preload audio:', url, error);
      }
    }
  }
}

async function getCacheStats() {
  const stats = {};
  
  for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    stats[name] = {
      count: keys.length,
      size: totalSize,
      sizeFormatted: formatBytes(totalSize),
    };
  }
  
  return stats;
}

async function clearCache(cacheName) {
  if (cacheName && CACHE_NAMES[cacheName]) {
    await caches.delete(CACHE_NAMES[cacheName]);
  } else {
    // Clear all caches except current version
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (!Object.values(CACHE_NAMES).includes(name)) {
        await caches.delete(name);
      }
    }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Periodic sync registration
self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'cleanup') {
    event.waitUntil(cleanupCache());
  } else if (event.tag === 'sync-data') {
    event.waitUntil(Promise.all([
      syncApiRequests(),
      syncUserProgress(),
    ]));
  }
});

// Listen for updates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (!Object.values(CACHE_NAMES).includes(cacheName)) {
          await caches.delete(cacheName);
        }
      }

      // Take control of all clients
      await self.clients.claim();

      // Initialize IndexedDB
      await initDB();
    })()
  );
});