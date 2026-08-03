/* DharmaChat Service Worker v1.0 */

/* BUMP THIS ON EVERY DEPLOY. There is no build step to do it for us, and
   `activate` only deletes caches whose name differs from this one, so a
   never-changing name makes the cleanup a permanent no-op. */
const CACHE_NAME = 'dharmachat-v2';
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

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Skip non-http requests (chrome-extension etc.) */
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  /* API calls always go to the network. The payment endpoints are now
     same-origin (/api/...), so matching on the old vercel.app alias alone
     would have matched nothing. */
  if (url.pathname.startsWith('/api/') || event.request.url.includes('vercel.app/api')) return;

  /* Skip Firebase / Google auth calls */
  if (event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) return;

  const accept = event.request.headers.get('accept') || '';
  const isNavigation = event.request.mode === 'navigate' || accept.includes('text/html');

  /* Pages: NETWORK-FIRST. Cache-first served corrected copy, pricing and
     legal text one full navigation late for returning visitors. The cache
     is kept only as the offline fallback. */
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(hit => hit || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  /* Images, CSS, JS, fonts: cache-first with a background refresh. */
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        /* Keep the revalidation alive past the response, otherwise the
           browser is free to kill the worker before cache.put lands. */
        event.waitUntil(
          fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              return caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
            }
          }).catch(() => {}) /* If network fails, cached is fine */
        );
        return cachedResponse; /* Return cached immediately */
      }

      /* Not in cache: fetch from network and cache for next time */
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        /* Only cache same-origin assets, or cacheable file types */
        const isSameOrigin = url.origin === self.location.origin;
        const isCacheable = /\.(html|js|css|jpeg|jpg|png|svg|woff2?|ttf)$/i.test(url.pathname);

        if (isSameOrigin || isCacheable) {
          const responseToCache = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)));
        }

        return response;
      }).catch(() => undefined);
    })
  );
});
