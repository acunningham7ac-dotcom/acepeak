/* ACEPEAK service worker — offline app shell.
   Strategy:
     - HTML: network-first, fall back to cache. So a fresh deploy always wins
       when you have signal, and the gym basement still opens the app.
     - Fonts/static: cache-first. They never change.
   Bump CACHE_V when you want to force-clear old caches. */
var CACHE_V = 'acepeak-v4';
var SHELL = ['./', './index.html'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_V).then(function (c) {
      return c.addAll(SHELL).catch(function () { /* offline at install — fine */ });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_V) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  var isHTML = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') > -1;

  if (isHTML) {
    // network-first: fresh deploys land immediately when online
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_V).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // fonts and other static assets: cache-first
  if (url.origin.indexOf('fonts.googleapis.com') > -1 ||
      url.origin.indexOf('fonts.gstatic.com') > -1 ||
      url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_V).then(function (c) { c.put(req, copy); });
          return res;
        });
      }).catch(function () { return caches.match(req); })
    );
  }
});
