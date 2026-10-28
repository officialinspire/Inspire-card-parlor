import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import pkg from './package.json' with { type: 'json' };

// Relative base so the build works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) as well as any custom domain.
export default defineConfig({
  base: './',
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
});
