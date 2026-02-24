
/* geo-trainer v1.8 Service Worker */
const VERSION = 'v1.8.0';
const RUNTIME_SVG_CACHE = `svg-cache-${VERSION}`;
const CORE_CACHE = `core-cache-${VERSION}`;

// Files to precache minimally (core shell). You can add more if needed.
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (!key.includes(VERSION)) return caches.delete(key);
    }))).then(() => self.clients.claim())
  );
});

// Runtime strategy: stale-while-revalidate for /svg/*.svg
async function handleSvgRequest(request) {
  const cache = await caches.open(RUNTIME_SVG_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(new Request(request, { credentials: 'omit', cache: 'no-store' }))
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // SVGs under /svg/
  if (url.pathname.startsWith('/svg/') && url.pathname.endsWith('.svg')) {
    event.respondWith(handleSvgRequest(event.request));
    return;
  }

  // Core shell: network-first with cache fallback
  if (CORE_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CORE_CACHE);
        cache.put(event.request, response.clone());
        return response;
      } catch (e) {
        const cache = await caches.open(CORE_CACHE);
        const cached = await cache.match(event.request);
        return cached || Response.error();
      }
    })());
    return;
  }
});
