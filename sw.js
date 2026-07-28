/* DharmaChat Service Worker v1.0 */

const CACHE_NAME = 'dharmachat-v1';
const OFFLINE_URL = '/index.html';

/* Pages and assets to pre-cache on install */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/chat.html',
  '/premium.html',
  '/bhagavad-gita-18-chapters.html',
  '/ramayana.html',
  '/mahabharata.html',
  '/upanishads.html',
  '/vedas.html',
  '/puranas.html',
  '/manifest.json',
  '/logo.jpeg',
  '/favicon.jpeg',
  '/nav.js',
  '/dc-premium-unlock.js',
  '/app-store-badge.svg',
  '/google-play-badge.svg'
];

/* ── INSTALL: pre-cache key pages ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Skip non-http requests (chrome-extension etc.) */
  if (!event.request.url.startsWith('http')) return;

  /* Skip Vercel API calls: always go to network */
  if (event.request.url.includes('vercel.app/api')) return;

  /* Skip Firebase / Google auth calls */
  if (event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        /* Serve from cache, then update cache in background (stale-while-revalidate) */
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse); /* If network fails, cached is fine */

        return cachedResponse; /* Return cached immediately */
      }

      /* Not in cache: fetch from network and cache for next time */
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        /* Only cache same-origin HTML, JS, CSS, images, fonts */
        const url = new URL(event.request.url);
        const isSameOrigin = url.origin === self.location.origin;
        const isCacheable = /\.(html|js|css|jpeg|jpg|png|svg|woff2?|ttf)$/i.test(url.pathname);

        if (isSameOrigin || isCacheable) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        /* Network failed and nothing in cache: show offline page for HTML requests */
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
