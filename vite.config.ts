import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// Relative base so the build works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) as well as any custom domain.
/**
 * Adult-only artwork is compiled out of the public default build: unless
 * VITE_ENABLE_MATURE_CONTENT=true, public/assets/cards/mature is removed from the output.
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
      if (!enabled) rmSync(resolve(outDir, 'assets/cards/mature'), { recursive: true, force: true });
    },
  };
}

/**
 * Stamps the service worker for this release: a cache name made of the
 * version and a hash of the built files (so every deploy refreshes the
 * cache), and the files to precache — the app shell plus the artwork a
 * first visit needs (logo, menu paintings, the default deck and table).
 * Everything else (other decks, boards, music) is fetched on demand and
 * cached as it is used.
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
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/icons/apple-touch-icon.png',
  ];
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
      const hash = createHash('sha256');
      for (const f of built) hash.update(readFileSync(resolve(outDir, 'assets', f)));
      hash.update(readFileSync(resolve(outDir, 'index.html')));
      const swPath = resolve(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace(/const CACHE = '[^']*';/, `const CACHE = 'icp-${version}-${hash.digest('hex').slice(0, 10)}';`)
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
  server: { host: true },
}));
