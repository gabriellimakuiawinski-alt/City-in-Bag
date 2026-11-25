const version='city-in-bag-v6-3-'+new URL(self.registration.scope).pathname;
const assets=['./','index.html','game.js','models.js','roads.js','saves.js','city.webmanifest','city-icon.svg','vendor/three/three.js','vendor/three/controls/MapControls.js','vendor/three/controls/OrbitControls.js','vendor/three/utils/BufferGeometryUtils.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(version).then(cache=>cache.addAll(assets.map(path=>new Request(new URL(path,self.registration.scope),{cache:"reload"})))).then(()=>self.skipWaiting())));

self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith(caches.open(version).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});
