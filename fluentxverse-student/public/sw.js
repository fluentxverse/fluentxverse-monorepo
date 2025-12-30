/**
 * FluentXVerse Enhanced Service Worker
 * Implements aggressive caching strategies for near-instant page loads
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `fluentxverse-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `fluentxverse-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `fluentxverse-images-${CACHE_VERSION}`;
const FONT_CACHE = `fluentxverse-fonts-${CACHE_VERSION}`;

// Static assets to cache on install (shell resources)
const STATIC_ASSETS = [
  '/',
  '/assets/css/bootstrap.min.css',
  '/assets/css/default.css',
  '/assets/css/style.css',
  '/assets/css/custom.css',
  '/assets/css/responsive.css',
  '/assets/img/logo/icon_logo.png',
  '/assets/img/logo/icon-192x192.png',
  '/assets/img/logo/logo.png',
];

// Routes to cache for offline access
const CACHEABLE_ROUTES = [
  '/tutors',
  '/schedule',
  '/materials',
  '/dashboard',
  '/profile',
];

// Install event - cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Install failed:', err))
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('fluentxverse-') && 
                   ![STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, FONT_CACHE].includes(name);
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated and claimed clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) requests
  if (!request.url.startsWith('http')) return;

  // Skip API requests (always go to network)
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return;
  }

  // Different strategies based on resource type
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isImage(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
  } else if (isFont(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  } else if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

// Utility functions to identify request types
function isStaticAsset(url) {
  return url.pathname.match(/\.(css|js)$/) !== null;
}

function isImage(url) {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/) !== null;
}

function isFont(url) {
  return url.pathname.match(/\.(woff|woff2|ttf|otf|eot)$/) !== null;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

/**
 * Cache-First Strategy
 * Best for: Static assets, images, fonts
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return caches.match('/');
  }
}

/**
 * Network-First with Cache Strategy
 * Best for: HTML pages (navigation)
 */
async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/');
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Best for: Dynamic content that can be slightly stale
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      caches.open(cacheName).then((cache) => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CACHE_ROUTES') {
    const routes = event.data.routes || CACHEABLE_ROUTES;
    cacheRoutes(routes);
  }
});

// Pre-cache important routes
async function cacheRoutes(routes) {
  const cache = await caches.open(DYNAMIC_CACHE);
  for (const route of routes) {
    try {
      const response = await fetch(route);
      if (response.ok) {
        await cache.put(route, response);
      }
    } catch (error) {
      // Silent fail for route caching
    }
  }
}
