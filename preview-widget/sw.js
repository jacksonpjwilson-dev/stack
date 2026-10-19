// Only ever touches its own 'stack-widget-*' caches, never the live Stack app's cache.
const CACHE='stack-widget-w2';
const ASSETS=['./','./index.html','./styles.css?v=w2','./app.js?v=w2','./data.js?v=w2','./account.js?v=w2','./version.json','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('stack-widget-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return; // never touch Firebase/Firestore or fonts
  if(u.pathname.endsWith('version.json')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
