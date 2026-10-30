/* INSPIRE CARD PARLOR — offline service worker.
 *
 * The build stamps the release into CACHE and lists the app shell and the
 * essential artwork in PRECACHE (see vite.config.ts), so a new release
 * installs a fresh cache and deletes the old one.
 *
 * - Navigation: network first, falling back to the cached app.
 * - Same-origin files: cache first, refreshed in the background.
 * - Google Fonts: cached once fetched, so text keeps its fonts offline.
 * - Music: left to the browser (range requests stream better uncached).
 */
const CACHE = 'icp-dev';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon.svg'];
const FONTS = 'icp-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One missing optional file must not stop the install.
      .then((c) => Promise.all(PRECACHE.map((url) => c.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.ports[0]?.postMessage(CACHE);
});

const fromCacheThenRefresh = (cacheName, req) =>
  caches.open(cacheName).then((cache) =>
    cache.match(req, { ignoreVary: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => undefined);
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fromCacheThenRefresh(FONTS, req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Music streams with range requests; leave it to the browser's own media cache.
  if (req.destination === 'audio' || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || Response.error())),
    );
    return;
  }

  event.respondWith(fromCacheThenRefresh(CACHE, req));
});
