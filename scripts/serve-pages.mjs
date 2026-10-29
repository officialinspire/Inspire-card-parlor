/**
 * Serves dist/ the way GitHub Pages serves this project site: under
 * /Inspire-card-parlor/ rather than at the domain root. Used by the
 * `github-pages` Playwright project to prove every asset URL resolves there.
 *
 *   node scripts/serve-pages.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.argv[2] ?? 4176);
const PREFIX = '/Inspire-card-parlor/';
const ROOT = join(import.meta.dirname, '..', 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.md': 'text/markdown',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (!path.startsWith(PREFIX)) {
    // Like Pages: nothing exists outside the project folder.
    res.writeHead(404).end('Not found');
    return;
  }
  let file = normalize(join(ROOT, path.slice(PREFIX.length)));
  if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}${PREFIX}`));
