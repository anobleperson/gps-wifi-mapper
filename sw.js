// Course WiFi Mapper - offline service worker
// Bump CACHE_NAME on every release so old caches get cleared out.
const CACHE_NAME = 'course-wifi-mapper-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(
        names.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// Cache-first for everything same-origin, so the app opens instantly and
// works with zero connectivity. Falls back to the cached app shell for
// any navigation request that isn't in the cache (e.g. a stray path).
self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin){
    return;
  }
  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){
        if(req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
