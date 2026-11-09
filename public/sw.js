/* INSPIRE CARD PARLOR — offline service worker.
 *
 * The build stamps the release into CACHE and lists the app shell and the
 * essential artwork in PRECACHE (see vite.config.ts), so a new release
 * installs a fresh cache and deletes the old one.
 *
 * - Navigation: network first, falling back to the cached app.
 * - Data files (*.json: artwork lists, card atlases, the story manifest):
 *   network first, cache as fallback. Their names don't change between
 *   releases, so cache-first could hand new scripts last release's data.
 * - Built scripts and styles carry a content hash in their names, and other
 *   same-origin files (artwork): cache first for this content-stamped release.
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
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('icp-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'version') event.ports[0]?.postMessage(CACHE);
  if (['cache-visuals', 'cache-installed-visuals'].includes(event.data) && event.ports[0]) {
    const port = event.ports[0];
    event.waitUntil(
      cacheVisuals((progress) => port.postMessage(progress), event.data === 'cache-installed-visuals').catch(() => {
        port.postMessage({ error: 'Download interrupted. Reconnect and try again; saved files are kept.' });
      }),
    );
  }
});

const fromNetworkThenCache = (cacheName, req) =>
  fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches
          .open(cacheName)
          .then((c) => c.put(req, copy))
          .catch(() => undefined);
      }
      return res;
    })
    .catch(() =>
      caches
        .open(cacheName)
        .then((c) => c.match(req, { ignoreVary: true, ignoreSearch: true }))
        .then((r) => r || Response.error()),
    );

// Cache writes belong to the fetch event lifetime, including on the first visit.
const fromCache = async (cacheName, req) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(req, { cache: 'reload' }).catch(() => Response.error());
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone()).catch(() => undefined);
  return res;
};

let visualDownload = null;
const visualListeners = new Set();
/** Download compressed visuals without decoding hundreds of images into phone memory. */
async function cacheVisuals(report, onlyIfMissing = false) {
  const readyKey = new URL('./visuals-ready', self.registration.scope).href;
  if (onlyIfMissing && (await (await caches.open(CACHE)).match(readyKey))) {
    report({ done: true, alreadySaved: true });
    return;
  }
  visualListeners.add(report);
  try {
    if (!visualDownload) {
      visualDownload = (async () => {
        const cache = await caches.open(CACHE);
        const manifest = await fromCache(CACHE, new Request(new URL('./visual-cache.json', self.registration.scope)));
        const { files, bytes } = await manifest.json();
        let cursor = 0,
          completed = 0,
          failed = 0;
        const emit = (done = false) => {
          for (const listener of visualListeners) listener({ completed, failed, total: files.length, bytes, done });
        };
        emit();
        await Promise.all(
          Array.from({ length: 2 }, async () => {
            while (cursor < files.length) {
              const url = new URL(files[cursor++], self.registration.scope);
              // Only this game's general-audience visuals from the generated build manifest.
              if (!url.href.startsWith(self.registration.scope) || url.pathname.includes('/mature/')) {
                failed++;
                emit();
                continue;
              }
              try {
                if (!(await cache.match(url.href))) {
                  const res = await fetch(url.href, { cache: 'reload', signal: AbortSignal.timeout(15000) });
                  if (!res.ok) throw new Error('Asset unavailable');
                  await cache.put(url.href, res);
                }
                completed++;
              } catch {
                failed++;
              }
              emit();
            }
          }),
        );
        // This marker belongs to the release cache: updates automatically download again.
        if (!failed) await cache.put(readyKey, new Response('ready'));
        emit(true);
      })().finally(() => {
        visualDownload = null;
      });
    }
    await visualDownload;
  } finally {
    visualListeners.delete(report);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    const response = fromCache(FONTS, req);
    event.waitUntil(response.then(() => undefined));
    event.respondWith(response);
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

  if (url.pathname.endsWith('.json')) {
    event.respondWith(fromNetworkThenCache(CACHE, req));
    return;
  }

  const response = fromCache(CACHE, req);
  event.waitUntil(response.then(() => undefined));
  event.respondWith(response);
});
