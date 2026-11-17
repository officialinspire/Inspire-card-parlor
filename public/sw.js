/* INSPIRE CARD PARLOR — offline service worker.
 *
 * The build stamps the release into CACHE, the music and video library into
 * MEDIA, and lists the app shell, the essential artwork and the studio intro
 * video in PRECACHE (see vite.config.ts), so a new release installs a fresh
 * cache and deletes the old one.
 *
 * - Navigation: network first, falling back to the cached app.
 * - Data files (*.json: artwork lists, card atlases, the story manifest):
 *   network first, cache as fallback. Their names don't change between
 *   releases, so cache-first could hand new scripts last release's data.
 * - Built scripts and styles carry a content hash in their names, and other
 *   same-origin files (artwork): cache first for this content-stamped release.
 * - Google Fonts: cached once fetched, so text keeps its fonts offline.
 * - Music and video: served from their own cache (MEDIA), named after the
 *   media files' content, so code-only releases never download them again.
 *   Media players ask for byte ranges; saved files answer those ranges
 *   (206 Partial Content) straight from the cache, so tracks and the intro
 *   play and seek with no connection. A file that isn't saved yet streams
 *   from the network while a full copy is saved for next time.
 * - Installing the app (or Settings → Data) downloads the whole offline pack:
 *   every visual, every music track and the intro video.
 */
const CACHE = 'icp-dev';
const MEDIA = 'icp-media-dev';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon.svg'];
const FONTS = 'icp-fonts';

const MEDIA_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|mp4|m4v|webm)$/i;
const MEDIA_TYPES = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
};
const isMedia = (url) => MEDIA_FILE.test(url.pathname);
/** Media is keyed by its address alone: players add no query, and ranges vary per request. */
const mediaKey = (url) => url.origin + url.pathname;
/** A download that receives nothing for this long has stalled (slow phones still progress). */
const STALL_MS = 30000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([caches.open(CACHE), caches.open(MEDIA)])
      .then(([shell, media]) =>
        Promise.all(
          PRECACHE.map((path) => {
            const url = new URL(path, self.location.href);
            // One missing optional file must not stop the install.
            if (!isMedia(url)) return shell.add(path).catch(() => undefined);
            // The intro video is kept across code-only releases; fetch it only when missing.
            return media
              .match(mediaKey(url))
              .then((hit) => hit || download(url.href).then((res) => media.put(mediaKey(url), res)))
              .catch(() => undefined);
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('icp-') && k !== CACHE && k !== MEDIA && k !== FONTS)
            .map((k) => caches.delete(k)),
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

/**
 * Downloads a whole file (never a range) into memory, so it can be cached.
 * The body is read in chunks: each chunk resets the stall timer and reports
 * its size, so large music files on a slow connection still count as progress.
 */
async function download(href, onBytes = () => undefined) {
  const controller = new AbortController();
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), STALL_MS);
  };
  arm();
  try {
    const res = await fetch(href, { cache: 'reload', signal: controller.signal });
    if (!res.ok || !res.body) throw new Error('Asset unavailable');
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      onBytes(value.byteLength);
      arm();
    }
    const ext = new URL(href).pathname.split('.').pop().toLowerCase();
    const type = res.headers.get('content-type') || MEDIA_TYPES[ext] || '';
    const body = new Blob(chunks, { type });
    // Only the headers a saved copy needs: the body is already decoded.
    return new Response(body, { headers: { 'Content-Type': type, 'Content-Length': String(body.size) } });
  } finally {
    clearTimeout(timer);
  }
}

/** Answers a media request from a saved file, honouring the player's byte range. */
async function rangeFrom(saved, range, url) {
  const blob = await saved.blob();
  const ext = url.pathname.split('.').pop().toLowerCase();
  const type = saved.headers.get('content-type') || blob.type || MEDIA_TYPES[ext] || 'application/octet-stream';
  const size = blob.size;
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
  if (!range) return new Response(blob, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = NaN;
  let end = size - 1;
  if (m && m[1] !== '') {
    start = Number(m[1]);
    if (m[2] !== '') end = Math.min(Number(m[2]), size - 1);
  } else if (m && m[2] !== '') {
    // "bytes=-N": the last N bytes.
    start = Math.max(0, size - Number(m[2]));
  }
  if (!(start >= 0) || start >= size || start > end)
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

/** Full copies being saved in the background, so a player's many range requests start one download. */
const savingMedia = new Map();
function saveMedia(url) {
  const key = mediaKey(url);
  if (!savingMedia.has(key)) {
    savingMedia.set(
      key,
      caches
        .open(MEDIA)
        .then(async (media) => {
          if (await media.match(key)) return;
          await media.put(key, await download(key));
        })
        .catch(() => undefined)
        .finally(() => savingMedia.delete(key)),
    );
  }
  return savingMedia.get(key);
}

async function fromMedia(event, req, url) {
  const media = await caches.open(MEDIA);
  const saved = await media.match(mediaKey(url), { ignoreSearch: true, ignoreVary: true });
  if (saved) return rangeFrom(saved, req.headers.get('range'), url);
  // Not saved yet: stream it now, and keep a full copy so it plays offline next time.
  event.waitUntil(saveMedia(url));
  return fetch(req).catch(() => Response.error());
}

let visualDownload = null;
const visualListeners = new Set();
/**
 * Download the offline pack (compressed visuals, music and the intro video)
 * without decoding hundreds of images into phone memory.
 */
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
        const media = await caches.open(MEDIA);
        const manifest = await fromCache(CACHE, new Request(new URL('./visual-cache.json', self.registration.scope)));
        const { files, bytes, sizes = [] } = await manifest.json();
        let cursor = 0,
          completed = 0,
          failed = 0,
          saved = 0,
          lastEmit = 0;
        const emit = (done = false) => {
          lastEmit = Date.now();
          for (const listener of visualListeners)
            listener({ completed, failed, total: files.length, bytes, saved: Math.min(saved, bytes), done });
        };
        emit();
        await Promise.all(
          Array.from({ length: 2 }, async () => {
            while (cursor < files.length) {
              const index = cursor++;
              const url = new URL(files[index], self.registration.scope);
              // Only this game's general-audience files from the generated build manifest.
              if (!url.href.startsWith(self.registration.scope) || url.pathname.includes('/mature/')) {
                failed++;
                emit();
                continue;
              }
              const target = isMedia(url) ? media : cache;
              const key = isMedia(url) ? mediaKey(url) : url.href;
              let received = 0;
              try {
                if (!(await target.match(key))) {
                  const res = await download(url.href, (n) => {
                    received += n;
                    saved += n;
                    // Keep the page informed while a long music file arrives.
                    if (Date.now() - lastEmit > 400) emit();
                  });
                  await target.put(key, res);
                  saved += Math.max(0, (sizes[index] ?? 0) - received);
                } else saved += sizes[index] ?? 0;
                completed++;
              } catch {
                saved -= received;
                failed++;
              }
              emit();
            }
          }),
        );
        // This marker belongs to the release cache: updates automatically check the pack again.
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
  // Music and the intro video: saved copies answer range requests offline.
  if (isMedia(url)) {
    event.respondWith(fromMedia(event, req, url));
    return;
  }
  // Any other ranged request is left to the network.
  if (req.headers.has('range')) return;

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
