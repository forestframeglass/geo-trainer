const CACHE_NAME='geo-trainer-v1.7';
const ASSETS=['./Geography_Trainer.html','./files/styles.css','./files/app.js','./files/data.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k)))));});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(fr=>{if(url.pathname.includes('/files/flags/')){const copy=fr.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}return fr;})));});
