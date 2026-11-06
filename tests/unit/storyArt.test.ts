import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryManifest } from '@/story/art';
import { characterPose, missingArt, storyImage, storySprite, useStoryManifest } from '@/story/art';
import { checkStoryArt, referencedSprites } from '../../scripts/validate-story-art';

const manifest = JSON.parse(readFileSync('public/assets/story/manifest.json', 'utf8')) as StoryManifest;
const config = JSON.parse(readFileSync('art/story/sources.json', 'utf8')) as {
  sheets: { id: string; source: string; sha256: string; group: string; names?: string[] }[];
};
const sheet = (id: string) => manifest.sheets.find((s) => s.id === id)!;

const CHARACTERS = [
  'cheryl',
  'sophia',
  'dante',
  'steve-gonzales',
  'mrs-gray',
  'mary-ball-washington',
  'george-washington',
];
const ITEMS = [
  'mystery-parlor',
  'river-ranger',
  'neon-art-supplies',
  'jak-black-gold',
  'cold-war-spycraft',
  'lodge-relics',
  'kenmore-heirlooms',
];

describe('story artwork manifest', () => {
  it('covers every source in the config, each with its original kept and unchanged', () => {
    expect(manifest.sheets.map((s) => s.id)).toEqual(config.sheets.map((s) => s.id));
    for (const s of config.sheets) {
      expect(existsSync(s.source), s.source).toBe(true);
      expect(sheet(s.id).source.sha256).toBe(s.sha256);
    }
  });

  it('cuts all 18 poses for each of the seven characters', () => {
    for (const id of CHARACTERS) {
      const s = sheet(id);
      expect(s.status, id).toBe('processed');
      expect(s.sprites, id).toHaveLength(18);
      // Every pose, once each. (Grid order can differ: Dante's expressions are drawn in another order.)
      expect(s.sprites.map((p) => p.name).sort(), id).toEqual(
        manifest.poseRows.flatMap((r) => r.poses.map((p) => `${r.row}-${p}`)).sort(),
      );
    }
    useStoryManifest(manifest);
    expect(characterPose('cheryl', 'portrait-greet')?.src).toBe('assets/story/characters/cheryl/portrait-greet.webp');
    // Dante's row is named for what is drawn: the chin-in-hand pose is "think", the alarm marks are "surprise".
    const dante = sheet('dante')
      .sprites.slice(0, 6)
      .map((p) => p.name);
    expect(dante).toEqual([
      'portrait-greet',
      'portrait-neutral',
      'portrait-talk',
      'portrait-surprise',
      'portrait-think',
      'portrait-doubt',
    ]);
  });

  it('uses the measured BlackJak frames for Jak’s expressions', () => {
    const jak = sheet('jak-gold');
    expect(jak.source.path).toBe('art/sources/story/characters/blackjak-sprite-sheet.webp');
    expect(jak.layout.type).toBe('rects');
    expect(jak.sprites.find((pose) => pose.name === 'portrait-neutral')?.frame).toEqual({
      x: 1176,
      y: 8,
      w: 246,
      h: 292,
    });
    expect(jak.sprites.every((pose) => pose.src.startsWith('assets/story/characters/jak-gold/'))).toBe(true);
  });

  it('cuts twelve quest items from each item atlas, and the stamps, effects, map icons and 14 UI pieces', () => {
    for (const id of ITEMS) expect(sheet(id).sprites, id).toHaveLength(12);
    expect(sheet('passport-stamps').sprites).toHaveLength(12);
    expect(sheet('thirteenth-hand-vfx').sprites).toHaveLength(12);
    expect(sheet('map-icons').sprites).toHaveLength(12);
    expect(sheet('parlor-ui').sprites.map((s) => s.name)).toEqual(
      config.sheets.find((s) => s.id === 'parlor-ui')!.names,
    );
  });

  it('has frames inside their sources, files on disk at the recorded sizes, and no errors', () => {
    const problems = checkStoryArt(manifest);
    expect(problems.filter((p) => p.level === 'error')).toEqual([]);
  });

  it('keeps sprites small enough for phones, with thumbnails', () => {
    for (const s of manifest.sheets)
      for (const p of s.sprites) {
        expect(Math.max(p.width, p.height), p.id).toBeLessThanOrEqual(s.layout.type === 'single' ? 1600 : 640);
        expect(Math.max(p.thumbWidth, p.thumbHeight), p.id).toBeLessThanOrEqual(320);
        expect(p.src.startsWith('assets/story/')).toBe(true);
      }
  });

  it('never marks artwork verified, and audits (does not build) decks', () => {
    expect(manifest.sheets.every((s) => s.verified === false)).toBe(true);
    for (const id of ['engraved-georgian', 'spectral-washington', 'inspire-botanical'])
      expect(sheet(id)).toMatchObject({ status: 'audit-only', sprites: [] });
    // Boards are registered by build_images.py (Prompt 19); the story copies say so.
    for (const s of manifest.sheets.filter((x) => x.group === 'boards')) expect(s.board?.registered).toBe(true);
  });

  it('reports what it could not do instead of failing', () => {
    const broken: StoryManifest = {
      ...manifest,
      sheets: [
        {
          ...sheet('cheryl'),
          sprites: [
            { ...sheet('cheryl').sprites[0]!, frame: { x: 1500, y: 0, w: 200, h: 10 }, src: 'assets/story/nope.webp' },
          ],
        },
      ],
    };
    const problems = checkStoryArt(broken);
    expect(problems.some((p) => p.message.includes('outside'))).toBe(true);
    expect(problems.some((p) => p.message.includes('missing file'))).toBe(true);
  });

  it('every story sprite referenced in the code exists', () => {
    const ids = new Set(manifest.sheets.flatMap((s) => s.sprites.map((p) => p.id)));
    for (const r of referencedSprites()) expect(ids.has(r.id), `${r.file}: ${r.id}`).toBe(true);
  });

  it('the audit document exists with every required section', () => {
    const audit = readFileSync(join('docs', 'ART_ASSET_AUDIT.md'), 'utf8');
    for (const heading of [
      '## Found and processed assets',
      '## Missing assets',
      '## Cropping and alpha issues',
      '## Unverified artwork',
      '## Runtime paths',
      '## Recommended follow-up fixes',
    ])
      expect(audit).toContain(heading);
  });
});

describe('story artwork at runtime', () => {
  it('renders a sized, lazily decoded image for a known sprite', () => {
    useStoryManifest(manifest);
    const el = storyImage('mrs-gray/portrait-think') as HTMLImageElement;
    const s = storySprite('mrs-gray/portrait-think')!;
    expect(el.tagName).toBe('IMG');
    expect(el.getAttribute('src')).toContain(s.src);
    expect([el.width, el.height]).toEqual([s.width, s.height]);
    expect(el.getAttribute('loading')).toBe('lazy');
    const thumb = storyImage('mrs-gray/portrait-think', { thumb: true }) as HTMLImageElement;
    expect(thumb.getAttribute('src')).toContain('/thumbs/');
  });

  it('shows a labelled placeholder (never fake art) for missing or broken sprites', () => {
    const missing = storyImage('nobody/nothing');
    expect(missing.dataset.missingArt).toBe('nobody/nothing');
    expect(missing.textContent).toBe('Artwork missing');
    const parent = document.createElement('div');
    const img = storyImage('cheryl/portrait-greet', { className: 'portrait-art' });
    expect(img.getAttribute('loading')).toBe('eager');
    parent.append(img);
    img.dispatchEvent(new Event('error'));
    expect(parent.querySelector('[data-missing-art].portrait-art')).not.toBeNull();
    expect(missingArt('x').getAttribute('aria-label')).toBe('x (artwork missing)');
  });
});
