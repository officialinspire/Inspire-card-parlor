import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// Relative base so the build works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) as well as any custom domain.
/**
 * Adult-only artwork is compiled out of the public default build: unless
 * VITE_ENABLE_MATURE_CONTENT=true, public/assets/cards/mature and public/assets/backgrounds/mature
 * are removed from the output.
 */
function stripMatureAssets(enabled: boolean): Plugin {
  let outDir = 'dist';
  return {
    name: 'icp-strip-mature-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (enabled) return;
      rmSync(resolve(outDir, 'assets/cards/mature'), { recursive: true, force: true });
      rmSync(resolve(outDir, 'assets/backgrounds/mature'), { recursive: true, force: true });
    },
  };
}

/**
 * Stamps the service worker for this release: a cache name made of the
 * version and a hash of the built files (so every deploy refreshes the
 * cache), a media cache name made of a hash of the music and video files
 * (so code-only releases keep the saved soundtrack), and the files to
 * precache — the app shell, the artwork a first visit needs (logo, menu
 * paintings, the default deck and table) and the studio intro video.
 * It also writes visual-cache.json, the offline pack that installing the app
 * downloads: every general-audience visual, music track and video.
 * Everything else is fetched on demand and cached as it is used.
 */
function serviceWorkerManifest(version: string): Plugin {
  let outDir = 'dist';
  const ESSENTIAL = [
    'assets/branding/logo.webp',
    'assets/backgrounds/menu/day.webp',
    'assets/backgrounds/menu/night.webp',
    'assets/backgrounds/backroom_card_table/background.webp',
    'assets/cards/classic/atlas.json',
    'assets/cards/classic/faces.webp',
    'assets/cards/classic/back.webp',
    'assets/artwork.json',
    'assets/story/manifest.json',
    'assets/icons/icon-192-v2.png',
    'assets/icons/icon-512-v2.png',
    'assets/icons/icon-maskable-512-v2.png',
    'assets/icons/favicon-v2.png',
    'assets/icons/icon.svg?v=2',
    'assets/icons/icon-maskable.svg?v=2',
    'assets/icons/apple-touch-icon-v2.png',
    // Plays right after Touch to Start, so it must be on hand offline from the first visit.
    'assets/video/inspiresoftwareintro.mp4',
  ];
  const MEDIA = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|mp4|m4v|webm)$/i;
  return {
    name: 'icp-service-worker-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const built = readdirSync(resolve(outDir, 'assets')).filter((f) => /\.(js|css)$/.test(f));
      const files = ['./', './index.html', './manifest.webmanifest', './assets/icons/icon.svg']
        .concat(built.map((f) => `./assets/${f}`))
        .concat(ESSENTIAL.map((f) => `./${f}`));
      // Enumerate emitted visuals, not source PNGs or stripped mature assets.
      const walk = (dir: string): string[] =>
        readdirSync(resolve(outDir, dir), { withFileTypes: true }).flatMap((entry) => {
          const path = `${dir}/${entry.name}`;
          return entry.isDirectory() ? walk(path) : [path];
        });
      const releaseFiles = walk('assets').sort();
      const mediaFiles = releaseFiles.filter((f) => MEDIA.test(f) && !f.includes('/mature/'));
      for (const f of ESSENTIAL) {
        if (!releaseFiles.includes(f.replace(/\?.*$/, ''))) throw new Error(`Precached file missing from build: ${f}`);
      }
      // The offline pack: visuals and data, then the music and video library.
      const packFiles = releaseFiles
        .filter((f) => /\.(webp|svg|json)$/.test(f) && !f.includes('/mature/'))
        .concat(mediaFiles)
        .sort();
      const sizes = packFiles.map((f) => statSync(resolve(outDir, f)).size);
      writeFileSync(
        resolve(outDir, 'visual-cache.json'),
        JSON.stringify({
          files: packFiles.map((f) => `./${f}`),
          sizes,
          bytes: sizes.reduce((sum, n) => sum + n, 0),
          mediaBytes: mediaFiles.reduce((sum, f) => sum + statSync(resolve(outDir, f)).size, 0),
        }),
      );
      const mediaHash = createHash('sha256');
      for (const f of mediaFiles) mediaHash.update(f).update(readFileSync(resolve(outDir, f)));
      files.push('./visual-cache.json');
      const hash = createHash('sha256');
      for (const f of built) hash.update(readFileSync(resolve(outDir, 'assets', f)));
      hash.update(readFileSync(resolve(outDir, 'index.html')));
      // Artwork-only and worker-only releases also invalidate cache-first files.
      for (const f of releaseFiles) hash.update(f).update(readFileSync(resolve(outDir, f)));
      hash.update(readFileSync(resolve(outDir, 'sw.js')));
      const swPath = resolve(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace(/const CACHE = '[^']*';/, `const CACHE = 'icp-${version}-${hash.digest('hex').slice(0, 10)}';`)
        .replace(/const MEDIA = '[^']*';/, `const MEDIA = 'icp-media-${mediaHash.digest('hex').slice(0, 10)}';`)
        .replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(files)};`);
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    stripMatureAssets(loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_MATURE_CONTENT === 'true'),
    serviceWorkerManifest(pkg.version),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  server: { host: true, allowedHosts: ['terminal.local'] },
}));
