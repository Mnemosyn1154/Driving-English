/**
 * Driving English Service Worker
 * Handles offline functionality, caching, and background sync
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `driving-english-${CACHE_VERSION}`;
const API_CACHE_NAME = `driving-english-api-${CACHE_VERSION}`;
const AUDIO_CACHE_NAME = `driving-english-audio-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/learn',
  '/driving',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[Service Worker] Install completed');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== AUDIO_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activate completed');
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle audio file requests
  if (url.pathname.match(/\.(mp3|wav|ogg)$/)) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // Handle static assets and pages
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed, serving from cache:', request.url);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API requests
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: '오프라인 상태입니다. 캐시된 데이터를 표시합니다.' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle audio requests with cache-first strategy
async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  
  // Check cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Audio fetch failed:', request.url);
    
    // Return a silent audio file as fallback
    return new Response('', {
      status: 404,
      statusText: 'Audio not available offline'
    });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Check cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses for HTML pages
    if (networkResponse.ok && request.headers.get('accept')?.includes('text/html')) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Static fetch failed:', request.url);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-news') {
    event.waitUntil(syncNews());
  } else if (event.tag === 'sync-progress') {
    event.waitUntil(syncUserProgress());
  }
});

// Sync news data when back online
async function syncNews() {
  try {
    const response = await fetch('/api/news/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastSync: await getLastSyncTime() })
    });
    
    if (response.ok) {
      await updateLastSyncTime();
      console.log('[Service Worker] News sync completed');
    }
  } catch (error) {
    console.error('[Service Worker] News sync failed:', error);
    throw error; // Retry later
  }
}

// Sync user progress when back online
async function syncUserProgress() {
  try {
    // Get pending progress data from IndexedDB
    const pendingData = await getPendingProgress();
    
    if (pendingData.length > 0) {
      const response = await fetch('/api/user/progress/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: pendingData })
      });
      
      if (response.ok) {
        await clearPendingProgress();
        console.log('[Service Worker] Progress sync completed');
      }
    }
  } catch (error) {
    console.error('[Service Worker] Progress sync failed:', error);
    throw error; // Retry later
  }
}

// Helper functions for sync
async function getLastSyncTime() {
  // Implementation would use IndexedDB
  return localStorage.getItem('lastSyncTime') || new Date(0).toISOString();
}

async function updateLastSyncTime() {
  localStorage.setItem('lastSyncTime', new Date().toISOString());
}

async function getPendingProgress() {
  // Implementation would use IndexedDB
  return [];
}

async function clearPendingProgress() {
  // Implementation would use IndexedDB
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CACHE_URLS') {
    cacheUrls(event.data.urls);
  }
});

// Cache specific URLs on demand
async function cacheUrls(urls) {
  const cache = await caches.open(API_CACHE_NAME);
  
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