import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetBlockedError, AssetManager } from '@/assets/AssetManager';
import { frameStyle, gridFrames, parseTexturePacker } from '@/assets/atlas';
import { CardRenderer, describeBack, describeFace } from '@/engine/CardRenderer';
import { CardAnimator } from '@/engine/CardAnimator';
import { Card } from '@/engine/Card';
import { DeckThemeManager, PLACEHOLDER_ASSETS, type DeckTheme } from '@/decks/DeckThemeManager';
import { getDeck } from '@/decks/registry';
import { standardAssets } from '@/decks/assets';
import type { DeckDefinition } from '@/decks/types';

const themes = (placeholder = false, mature = false) =>
  new DeckThemeManager({ matureAllowed: () => mature, placeholderArt: () => placeholder, variantFor: () => undefined });

/** Theme with "uploaded" artwork at a custom base path. */
function readyTheme(
  over: Partial<DeckDefinition['assets']> = {},
  deck: DeckDefinition = getDeck('jak_gold'),
): DeckTheme {
  const t = themes().resolve(deck.id);
  return {
    ...t,
    key: `${deck.id}@test-${Math.random()}`,
    assets: { ...standardAssets(deck.assets.basePath), status: 'ready', ...over },
  };
}

/** Fake image loader: only URLs in `exists` load, with the given size. */
function loader(exists: Record<string, [number, number]>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    calls.push(url);
    const size = exists[url];
    if (!size) throw new Error('404');
    return { width: size[0], height: size[1] };
  });
  return { fn, calls };
}

describe('atlas math', () => {
  it('slices a 13×4 grid in suit rows and rank columns', () => {
    const f = gridFrames({ columns: 13, rows: 4 }, 1300, 560);
    expect(f.AS).toEqual({ x: 0, y: 0, w: 100, h: 140 });
    expect(f.KS).toEqual({ x: 1200, y: 0, w: 100, h: 140 });
    expect(f.AH).toEqual({ x: 0, y: 140, w: 100, h: 140 });
    expect(f.KC).toEqual({ x: 1200, y: 420, w: 100, h: 140 });
    expect(Object.keys(f)).toHaveLength(52);
  });

  it('handles margins, spacing, custom orders and a back cell', () => {
    const f = gridFrames(
      {
        columns: 13,
        rows: 5,
        margin: 10,
        spacing: 4,
        suitOrder: ['clubs', 'diamonds', 'hearts', 'spades'],
        backCell: { column: 1, row: 4 },
      },
      2 * 10 + 13 * 100 + 12 * 4,
      2 * 10 + 5 * 140 + 4 * 4,
    );
    expect(f.AC).toEqual({ x: 10, y: 10, w: 100, h: 140 });
    expect(f.AS!.y).toBe(10 + 3 * 144);
    expect(f.back).toEqual({ x: 10 + 104, y: 10 + 4 * 144, w: 100, h: 140 });
  });

  it('reads TexturePacker hashes', () => {
    const parsed = parseTexturePacker({
      frames: { 'AS.png': { frame: { x: 1, y: 2, w: 3, h: 4 } } },
      meta: { size: { w: 10, h: 20 } },
    });
    expect(parsed).toEqual({ frames: { AS: { x: 1, y: 2, w: 3, h: 4 } }, size: { width: 10, height: 20 } });
  });

  it('positions a frame with percentage CSS', () => {
    expect(frameStyle({ x: 0, y: 0, w: 100, h: 140 }, { width: 1300, height: 560 })).toEqual({
      backgroundSize: '1300% 400%',
      backgroundPosition: '0% 0%',
    });
    expect(frameStyle({ x: 1200, y: 420, w: 100, h: 140 }, { width: 1300, height: 560 }).backgroundPosition).toBe(
      '100% 100%',
    );
    expect(frameStyle({ x: 600, y: 140, w: 100, h: 140 }, { width: 1300, height: 560 }).backgroundPosition).toBe(
      '50% 33.333%',
    );
  });
});

describe('AssetManager', () => {
  it('prefers WebP and falls back to PNG per file', async () => {
    const theme = readyTheme();
    const { fn } = loader({
      '/assets/cards/jak_gold/faces.png': [1300, 560],
      '/assets/cards/jak_gold/back.webp': [100, 140],
    });
    const am = new AssetManager({ baseUrl: '/', loadImage: fn, supportsWebP: () => true });
    const art = await am.loadDeck(theme);
    expect(art.faces?.kind).toBe('atlas');
    expect(art.faces && art.faces.kind === 'atlas' && art.faces.sheet.url).toBe('/assets/cards/jak_gold/faces.png');
    expect(art.back?.image.url).toBe('/assets/cards/jak_gold/back.webp');
    expect(art.missing).toEqual([]);
    expect(am.getDeckArt(theme.key)).toBe(art);
  });

  it('skips WebP when the browser cannot decode it', () => {
    const am = new AssetManager({ baseUrl: '/', supportsWebP: () => false });
    expect(am.candidates('assets/cards/x/', { path: 'back' })).toEqual(['/assets/cards/x/back.png']);
  });

  it('loads individual images and records missing cards', async () => {
    const theme = readyTheme({ faces: { type: 'individual', pattern: 'faces/{code}', formats: ['png'] } });
    const exists: Record<string, [number, number]> = { '/assets/cards/jak_gold/faces/AS.png': [200, 280] };
    const { fn } = loader(exists);
    const art = await new AssetManager({ baseUrl: '/', loadImage: fn, supportsWebP: () => true }).loadDeck(theme);
    expect(art.faces?.kind).toBe('individual');
    expect(art.missing).toHaveLength(51);
    expect(art.missing).not.toContain('AS');
  });

  it('never requests files for pending decks', async () => {
    const { fn } = loader({});
    const art = await new AssetManager({ loadImage: fn }).loadDeck(themes().resolve('classic'));
    expect(fn).not.toHaveBeenCalled();
    expect(art.faces).toBeNull();
    expect(art.missing).toHaveLength(52);
  });

  it('refuses mature asset paths unless allowed', async () => {
    const blocked = new AssetManager({ baseUrl: '/', matureAllowed: () => false });
    expect(() => blocked.url('assets/cards/mature/x/', 'back.png')).toThrow(AssetBlockedError);
    const { fn } = loader({});
    const theme = { ...readyTheme(), mature: true };
    await new AssetManager({ loadImage: fn, matureAllowed: () => false }).loadDeck(theme);
    expect(fn).not.toHaveBeenCalled();
    expect(
      new AssetManager({ baseUrl: '/', matureAllowed: () => true }).url('assets/cards/mature/x/', 'back.png'),
    ).toBe('/assets/cards/mature/x/back.png');
  });

  it('uses grid back cells and variant overrides', async () => {
    const theme: DeckTheme = {
      ...themes(true).resolve('classic'),
      key: 'ph-test',
      overrides: { QH: { path: 'qh', formats: ['png'] } },
    };
    expect(theme.assets).toBe(PLACEHOLDER_ASSETS);
    const { fn } = loader({
      '/assets/cards/_placeholder/faces.svg': [1560, 840],
      '/assets/cards/_placeholder/qh.png': [120, 168],
    });
    const art = await new AssetManager({ baseUrl: '/', loadImage: fn }).loadDeck(theme);
    expect(art.back?.frame).toEqual({ x: 0, y: 672, w: 120, h: 168 });
    expect(describeFace('QH', art)).toEqual({
      kind: 'image',
      url: '/assets/cards/_placeholder/qh.png',
      ratio: 120 / 168,
    });
    expect(describeFace('QS', art).kind).toBe('atlas');
  });

  it('caches image requests', async () => {
    const { fn } = loader({ '/a/b.png': [1, 1] });
    const am = new AssetManager({ baseUrl: '/', loadImage: fn, supportsWebP: () => false });
    await Promise.all([am.loadImage('a/', { path: 'b' }), am.loadImage('a/', { path: 'b' })]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('CardRenderer', () => {
  let am: AssetManager;
  let renderer: CardRenderer;
  beforeEach(() => {
    am = new AssetManager({ baseUrl: '/', loadImage: loader({}).fn });
    renderer = new CardRenderer(am);
  });

  it('draws procedural cards while artwork is pending', () => {
    const theme = themes().resolve('freemasonry');
    const face = renderer.renderCard(new Card(12, 'hearts', 0, true), theme);
    expect(face.dataset.art).toBe('fallback');
    expect(face.dataset.code).toBe('QH');
    expect(face.dataset.cardId).toBe('0:QH');
    expect(face.getAttribute('aria-label')).toBe('Q of hearts');
    expect(face.textContent).toContain('♥');
    expect(face.style.getPropertyValue('--card-ink')).toBe(theme.fallback.face.red);

    const back = renderer.renderCard(new Card(12, 'hearts', 0, false), theme);
    expect(back.classList.contains('card-back')).toBe(true);
    expect(back.textContent).toBe(theme.fallback.back.mark);
    expect(back.textContent).not.toContain('Q');
  });

  it('renders a neutral cover instead of art', () => {
    const el = renderer.renderBack(themes().resolve('classic'), { cover: true });
    expect(el.dataset.cover).toBe('true');
    expect(el.textContent).toBe('18+');
  });

  it('renders sprite-sheet art once loaded and upgrades existing elements', async () => {
    const theme = { ...themes(true).resolve('classic'), key: 'upgrade-test' };
    const sheet = '/assets/cards/_placeholder/faces.svg';
    am = new AssetManager({ baseUrl: '/', loadImage: loader({ [sheet]: [1560, 840] }).fn });
    renderer = new CardRenderer(am);

    const el = renderer.renderFace(theme, 'KS');
    document.body.appendChild(el);
    expect(el.dataset.art).toBe('fallback');
    await am.loadDeck(theme);
    expect(el.dataset.art).toBe('atlas');
    const img = el.querySelector<HTMLElement>('.card-art-img')!;
    expect(img.style.backgroundImage).toContain(sheet);
    expect(img.style.backgroundPosition).toBe('100% 0%');
    // The art layer keeps the frame's own proportions (120×168 cells).
    expect(Number(img.style.getPropertyValue('--ar'))).toBeCloseTo(120 / 168, 5);

    const back = renderer.renderBack(theme);
    expect(back.dataset.art).toBe('atlas');
    expect(back.querySelector<HTMLElement>('.card-art-img')!.style.backgroundPosition).toBe('0% 100%');
    el.remove();
  });

  it('flips a card by re-rendering it', () => {
    const theme = themes().resolve('inspire');
    const card = new Card(1, 'spades', 1, false);
    const el = renderer.renderCard(card, theme);
    document.body.appendChild(el);
    const next = renderer.update(el, card.flip(), theme);
    expect(next.isConnected).toBe(true);
    expect(next.dataset.side).toBe('face');
    expect(next.dataset.cardId).toBe('1:AS');
    next.remove();
  });

  it('describes visuals without art', () => {
    expect(describeFace('AS', undefined)).toEqual({ kind: 'fallback' });
    expect(describeBack(undefined)).toEqual({ kind: 'fallback' });
  });
});

describe('CardAnimator', () => {
  it('applies DOM changes immediately with reduced motion', async () => {
    const a = new CardAnimator({ reducedMotion: () => true });
    const el = document.createElement('div');
    const mutate = vi.fn();
    await a.move([el], mutate);
    expect(mutate).toHaveBeenCalledOnce();
    const swapped = document.createElement('div');
    expect(await a.flip(el, () => swapped)).toBe(swapped);
    await expect(a.deal([el], { x: 0, y: 0 })).resolves.toBeUndefined();
  });

  it('scales durations by speed setting', () => {
    expect(new CardAnimator({ speed: () => 'slow' }).duration(200)).toBe(300);
    expect(new CardAnimator({ speed: () => 'fast' }).duration(200)).toBe(120);
  });
});
