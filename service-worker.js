// service-worker.js
const CACHE_NAME = 'geo-trainer-v1.7.1'; // bump this to force an update
const ASSETS = [
  './index.html',
  './files/styles.css',
  './files/app.js',
  './files/data.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', (e) => {
  self.skipWaiting(); // optional: activate new SW faster
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim(); // optional: take control immediately
});

// Fetch: cache-first for shell, runtime cache for flags and static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Runtime cache flag images and static assets
  if (url.pathname.includes('/files/flags/') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached ||
        fetch(e.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          return resp;
        })
      )
    );
    return;
  }

  // Default: try cache, then network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
