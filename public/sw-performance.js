// Performance-optimized Service Worker
const CACHE_NAME = 'driving-english-v1';
const API_CACHE_NAME = 'api-cache-v1';
const STATIC_CACHE_NAME = 'static-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// Default cache strategy
let cacheStrategy = 'stale-while-revalidate';

// Cache configuration
const cacheConfig = {
  maxEntries: 50,
  maxAgeSeconds: 24 * 60 * 60, // 24 hours
  purgeOnQuotaError: true
};

// URLs to cache on install
const staticAssets = [
  '/',
  '/learn',
  '/driving',
  '/dashboard',
  '/manifest.json',
  '/favicon.ico'
];

// API endpoints to cache
const apiEndpoints = [
  '/api/news/articles',
  '/api/user/progress',
  '/api/voice/recognize'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(staticAssets);
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Claim clients immediately
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static assets
  if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  
  // Handle other requests
  event.respondWith(handleOtherRequests(request));
});

// Handle API requests with dynamic caching strategy
async function handleApiRequest(request) {
  const cacheName = API_CACHE_NAME;
  
  switch (cacheStrategy) {
    case 'cache-first':
      return cacheFirst(request, cacheName);
    case 'network-first':
      return networkFirst(request, cacheName);
    case 'stale-while-revalidate':
    default:
      return staleWhileRevalidate(request, cacheName);
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  return cacheFirst(request, STATIC_CACHE_NAME);
}

// Handle navigation with network-first strategy
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page if available
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Return basic offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle other requests with stale-while-revalidate
async function handleOtherRequests(request) {
  return staleWhileRevalidate(request, DYNAMIC_CACHE_NAME);
}

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    
    // Only cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache-first strategy failed:', error);
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    
    // Only cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in the background
  const networkResponsePromise = fetch(request).then((networkResponse) => {
    // Only cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.error('Background fetch failed:', error);
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cached response, wait for network
  return networkResponsePromise;
}

// Check if request is for a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.includes(ext));
}

// Message handler for dynamic configuration
self.addEventListener('message', (event) => {
  const { type, strategy } = event.data;
  
  if (type === 'UPDATE_CACHE_STRATEGY') {
    cacheStrategy = strategy;
    console.log('Cache strategy updated to:', strategy);
    
    // Notify all clients about the update
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CACHE_STRATEGY_UPDATED',
          strategy
        });
      });
    });
  }
});

// Background sync for performance data
self.addEventListener('sync', (event) => {
  if (event.tag === 'performance-data') {
    event.waitUntil(uploadPerformanceData());
  }
});

// Upload performance data when back online
async function uploadPerformanceData() {
  try {
    const cache = await caches.open('performance-data');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const data = await response.json();
        
        // Upload to server
        await fetch('/api/performance/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        // Remove from cache after successful upload
        await cache.delete(request);
      }
    }
  } catch (error) {
    console.error('Failed to upload performance data:', error);
  }
}

// Periodic cache cleanup
setInterval(async () => {
  await cleanupCaches();
}, 24 * 60 * 60 * 1000); // Run daily

async function cleanupCaches() {
  const cacheNames = [API_CACHE_NAME, DYNAMIC_CACHE_NAME];
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    // Remove expired entries
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader);
          const now = new Date();
          const ageInSeconds = (now.getTime() - responseDate.getTime()) / 1000;
          
          if (ageInSeconds > cacheConfig.maxAgeSeconds) {
            await cache.delete(request);
          }
        }
      }
    }
    
    // Enforce max entries limit
    const remainingRequests = await cache.keys();
    if (remainingRequests.length > cacheConfig.maxEntries) {
      const requestsToDelete = remainingRequests.slice(0, remainingRequests.length - cacheConfig.maxEntries);
      for (const request of requestsToDelete) {
        await cache.delete(request);
      }
    }
  }
}

// Handle quota exceeded errors
self.addEventListener('quotaexceeded', async () => {
  if (cacheConfig.purgeOnQuotaError) {
    console.log('Quota exceeded, purging caches...');
    await cleanupCaches();
  }
});

console.log('Performance Service Worker loaded');