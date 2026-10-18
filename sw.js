// Stack service worker. Bump CACHE on every release.
const CACHE="stack-v46";
const SHELL=["./","index.html","css/styles.css","js/app.js","js/store.js","js/util.js","js/analysis.js","js/sync.js","js/views.js","js/demo.js","js/virtuals.js","js/match.js","js/refresh.js"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Network-first for same-origin app files (always fresh online), cache fallback offline.
self.addEventListener("fetch",e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==location.origin)return;
  e.respondWith(fetch(req,{cache:"no-store"}).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.match(req,{ignoreSearch:true})));
});
