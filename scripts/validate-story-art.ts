/**
 * Build-time checks for the story artwork (public/assets/story/manifest.json):
 *
 *  - every source image exists and still matches its recorded checksum;
 *  - every frame lies inside its source sheet, and sprite ids are unique;
 *  - every runtime file (sprite, thumbnail, board image) exists and has the
 *    size the manifest records;
 *  - every story sprite referenced in src/ (storyImage('...'),
 *    storySprite('...'), characterPose('char', 'pose')) exists.
 *
 * Malformed or missing artwork is reported; only broken references and broken
 * files fail the check (pipeline warnings are listed, not fatal).
 *
 *   npm run validate:story            # human summary
 *   npm run validate:story -- --json
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { webpSize } from '../src/decks/atlasReport';
import type { StoryManifest } from '../src/story/art';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');
const MANIFEST = join(PUBLIC, 'assets/story/manifest.json');

export interface StoryArtProblem {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export function checkStoryArt(manifest: StoryManifest, opts: { verifySources?: boolean } = {}): StoryArtProblem[] {
  const out: StoryArtProblem[] = [];
  const err = (where: string, message: string) => out.push({ level: 'error', where, message });
  const ids = new Set<string>();
  const fileSize = (path: string) => webpSize(readFileSync(join(PUBLIC, path)));
  const checkFile = (where: string, path: string, w: number, hgt: number) => {
    if (path.startsWith('/') || path.includes('..'))
      return err(where, `runtime path must be relative to the site: ${path}`);
    if (!existsSync(join(PUBLIC, path))) return err(where, `missing file ${path}`);
    const size = fileSize(path);
    if (size.width !== w || size.height !== hgt)
      err(where, `${path} is ${size.width}x${size.height}, manifest says ${w}x${hgt}`);
  };
  for (const sheet of manifest.sheets) {
    const src = sheet.source;
    if (opts.verifySources !== false) {
      const file = join(ROOT, src.path);
      if (!existsSync(file)) err(sheet.id, `source image missing: ${src.path}`);
      else if (createHash('sha256').update(readFileSync(file)).digest('hex') !== src.sha256)
        err(sheet.id, `source image changed since the last build (re-run npm run art:story): ${src.path}`);
    }
    for (const w of sheet.warnings)
      if (w.level !== 'info')
        out.push({
          level: w.level === 'error' ? 'error' : 'warning',
          where: sheet.id,
          message: `${w.code}: ${w.message}`,
        });
    for (const s of sheet.sprites) {
      const where = s.id;
      if (ids.has(s.id)) err(where, 'duplicate sprite id');
      ids.add(s.id);
      if (s.id !== `${sheet.id}/${s.name}`) err(where, `id should be ${sheet.id}/${s.name}`);
      const f = s.frame;
      if (
        src.width &&
        src.height &&
        (f.x < 0 || f.y < 0 || f.w <= 0 || f.h <= 0 || f.x + f.w > src.width || f.y + f.h > src.height)
      )
        err(where, `frame ${f.x},${f.y} ${f.w}x${f.h} lies outside the ${src.width}x${src.height} source`);
      // Sprites are never enlarged beyond their frame.
      if (s.width > f.w || s.height > f.h) err(where, `sprite ${s.width}x${s.height} is larger than its frame`);
      checkFile(where, s.src, s.width, s.height);
      checkFile(`${where} (thumb)`, s.thumb, s.thumbWidth, s.thumbHeight);
    }
    if (sheet.board) {
      checkFile(
        `${sheet.id} background`,
        sheet.board.background,
        sheet.board.backgroundWidth,
        sheet.board.backgroundHeight,
      );
      checkFile(`${sheet.id} preview`, sheet.board.preview, sheet.board.previewWidth, sheet.board.previewHeight);
    }
    if (sheet.verified && sheet.warnings.some((w) => w.level === 'error'))
      err(sheet.id, 'marked verified but has errors');
  }
  return out;
}

/** Sprite ids referenced in the source code. */
export function referencedSprites(srcDir = join(ROOT, 'src')): { id: string; file: string }[] {
  const refs: { id: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ts$/.test(name) && !p.endsWith(join('story', 'art.ts'))) {
        const text = readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\b(?:storyImage|storySprite)\(\s*'([a-z0-9-]+\/[a-z0-9-]+)'/g))
          refs.push({ id: m[1]!, file: relative(ROOT, p) });
        for (const m of text.matchAll(/\bcharacterPose\(\s*'([a-z0-9-]+)'\s*,\s*'([a-z0-9-]+)'/g))
          refs.push({ id: `${m[1]}/${m[2]}`, file: relative(ROOT, p) });
      }
    }
  };
  walk(srcDir);
  return refs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(MANIFEST)) {
    console.error('public/assets/story/manifest.json is missing: run npm run art:story');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as StoryManifest;
  const problems = checkStoryArt(manifest);
  const ids = new Set(manifest.sheets.flatMap((s) => s.sprites.map((x) => x.id)));
  for (const r of referencedSprites())
    if (!ids.has(r.id)) problems.push({ level: 'error', where: r.file, message: `unknown story sprite '${r.id}'` });
  if (process.argv.includes('--json')) console.log(JSON.stringify(problems, null, 2));
  else {
    const sprites = manifest.sheets.reduce((n, s) => n + s.sprites.length, 0);
    const errors = problems.filter((p) => p.level === 'error');
    const warnings = problems.filter((p) => p.level === 'warning');
    console.log(
      `${manifest.sheets.length} story sheets, ${sprites} sprites: ${errors.length} errors, ${warnings.length} artwork warnings`,
    );
    for (const p of errors) console.log(`  error    ${p.where}: ${p.message}`);
    if (warnings.length) console.log(`  (${warnings.length} artwork warnings are listed in docs/ART_ASSET_AUDIT.md)`);
  }
  process.exit(problems.some((p) => p.level === 'error') ? 1 : 0);
}
