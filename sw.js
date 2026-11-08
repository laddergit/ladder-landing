/* Ladder landing — Earth cache worker.
   Cache-first (stale-while-revalidate) for exactly two files: the
   23 MB hero Earth model and the three.js build it renders with.
   GitHub Pages serves them with only a ~10-minute cache, so without
   this worker every repeat visit re-downloads the model and the
   blue Earth arrives late; with it, repeat visits serve the model
   from Cache Storage instantly while one background fetch keeps
   the cached copy fresh. Everything else — index.html included —
   passes straight through to the network, untouched. */
var CACHE = 'ladder-earth-v1';
var CACHEABLE = ['/assets/earth_0_zhtn.glb', '/assets/three.min.js'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('ladder-earth-') === 0 && key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var path;
  try { path = new URL(req.url).pathname; } catch (e) { return; }
  var hit = false;
  for (var i = 0; i < CACHEABLE.length; i++) {
    if (path.slice(-CACHEABLE[i].length) === CACHEABLE[i]) { hit = true; break; }
  }
  if (!hit) return; /* not ours — the request passes through untouched */

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            try { cache.put(req, res.clone()); } catch (e) {}
          }
          return res;
        });
        if (cached) {
          /* serve the cached copy now; the network fetch above
             refreshes the cache entry in the background */
          event.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network;
      });
    })
  );
});
