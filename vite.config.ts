import { defineConfig, loadEnv, type Plugin } from 'vite';
import { rmSync } from 'node:fs';
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

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [stripMatureAssets(loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_MATURE_CONTENT === 'true')],
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
