/**
 * McMaster-Carr style enhanced Service Worker
 * Implements smart caching strategies for maximum performance
 */

const VERSION = 'v2';
const STATIC_CACHE = `fluentxverse-static-${VERSION}`;
const DYNAMIC_CACHE = `fluentxverse-dynamic-${VERSION}`;
const IMAGE_CACHE = `fluentxverse-images-${VERSION}`;
const FONT_CACHE = `fluentxverse-fonts-${VERSION}`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/assets/css/bootstrap.min.css',
  '/assets/css/default.css',
  '/assets/css/style.css',
  '/assets/css/custom.css',
  '/assets/img/logo/icon-192x192.png',
  '/assets/img/banner/dashboard_banner.jpg'
];

// Cache size limits
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

// Install event - pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete caches that don't match current version
            return name.startsWith('fluentxverse-') && 
                   !name.includes(VERSION);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy for dynamic content
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      // Limit cache size
      limitCacheSize(cacheName, MAX_DYNAMIC_CACHE);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-while-revalidate for semi-dynamic content
 */
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((cache) => {
        cache.put(request, response.clone());
      });
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, maxSize);
  }
}

/**
 * Determine caching strategy based on request
 */
function getStrategy(request) {
  const url = new URL(request.url);
  
  // Images - cache first (they rarely change)
  if (request.destination === 'image' || 
      /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)) {
    return { strategy: 'cacheFirst', cache: IMAGE_CACHE };
  }
  
  // Fonts - cache first
  if (request.destination === 'font' ||
      /\.(woff2?|ttf|eot)$/i.test(url.pathname)) {
    return { strategy: 'cacheFirst', cache: FONT_CACHE };
  }
  
  // Static assets - cache first
  if (/\.(css|js)$/i.test(url.pathname) ||
      STATIC_ASSETS.includes(url.pathname)) {
    return { strategy: 'cacheFirst', cache: STATIC_CACHE };
  }
  
  // API requests - network first
  if (url.pathname.startsWith('/api/') ||
      url.hostname !== self.location.hostname) {
    return { strategy: 'networkFirst', cache: DYNAMIC_CACHE };
  }
  
  // HTML pages - stale while revalidate
  if (request.mode === 'navigate') {
    return { strategy: 'staleWhileRevalidate', cache: DYNAMIC_CACHE };
  }
  
  // Default - network first
  return { strategy: 'networkFirst', cache: DYNAMIC_CACHE };
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  // Skip non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  // Skip chrome-extension and other non-standard schemes
  const url = new URL(event.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;
  
  const { strategy, cache } = getStrategy(event.request);
  
  switch (strategy) {
    case 'cacheFirst':
      event.respondWith(cacheFirst(event.request, cache));
      break;
    case 'networkFirst':
      event.respondWith(networkFirst(event.request, cache));
      break;
    case 'staleWhileRevalidate':
      event.respondWith(staleWhileRevalidate(event.request, cache));
      break;
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
