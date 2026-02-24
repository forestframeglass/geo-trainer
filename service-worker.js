
/* geo-trainer v1.8 Service Worker */
const VERSION='v1.8.1';
const RUNTIME_SVG_CACHE=`svg-cache-${VERSION}`; 
const RUNTIME_IMG_CACHE=`img-cache-${VERSION}`;
const CORE_CACHE=`core-cache-${VERSION}`;
const CORE_ASSETS=['/','/index.html','/quiz.html','/leaderboards.html','/manifest.webmanifest'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(CORE_CACHE).then(c=>c.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>{if(!k.includes(VERSION)) return caches.delete(k);}))).then(()=>self.clients.claim()))});

async function staleWhileRevalidate(cacheName, request){
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(new Request(request,{credentials:'omit',cache:'no-store'})).then(resp=>{ if(resp && resp.ok) cache.put(request, resp.clone()); return resp; }).catch(()=>cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET') return;
  // SVG flags
  if(url.pathname.startsWith('/svg/') && url.pathname.endsWith('.svg')){
    e.respondWith(staleWhileRevalidate(RUNTIME_SVG_CACHE, e.request)); return;
  }
  // Embedded raster flags
  if(url.pathname.startsWith('/files/flags/') && /(\.png|\.jpg|\.jpeg|\.webp|\.avif|\.gif)$/i.test(url.pathname)){
    e.respondWith(staleWhileRevalidate(RUNTIME_IMG_CACHE, e.request)); return;
  }
  // Core pages
  if(CORE_ASSETS.includes(url.pathname)){
    e.respondWith((async()=>{ try{ const resp=await fetch(e.request); const c=await caches.open(CORE_CACHE); c.put(e.request, resp.clone()); return resp; }catch(_){ const c=await caches.open(CORE_CACHE); const cached=await c.match(e.request); return cached||Response.error(); } })()); return;
  }
});
