import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from '@/assets/AssetManager';
import { CardRenderer, describeBack, describeFace } from '@/engine/CardRenderer';
import { Deck } from '@/engine/Deck';
import { RANKS, SUITS, cardCode } from '@/engine/Card';
import { DeckThemeManager } from '@/decks/DeckThemeManager';
import { allDecks, getDeck } from '@/decks/registry';
import { checkAtlasReport, unexplainedFlags, webpSize, type AtlasReport } from '@/decks/atlasReport';

const PUBLIC = join(__dirname, '..', '..', 'public');
const SOURCES = join(__dirname, '..', '..', 'art', 'sources');

/** Decks cut from the uploaded sprite sheets (art/sources/manifest.json). */
const manifest = JSON.parse(readFileSync(join(SOURCES, 'manifest.json'), 'utf8')) as {
  decks: { id: string; source: string; rows: string[] }[];
};
const EXTRACTED = manifest.decks.map((d) => d.id);

const report = (id: string) =>
  JSON.parse(readFileSync(join(PUBLIC, getDeck(id).assets.basePath, 'atlas.json'), 'utf8')) as AtlasReport;
const sheetSize = (id: string, file = 'faces.webp') =>
  webpSize(readFileSync(join(PUBLIC, getDeck(id).assets.basePath, file)));

const themes = () =>
  new DeckThemeManager({ matureAllowed: () => false, placeholderArt: () => false, variantFor: () => undefined });

describe('uploaded card sheets', () => {
  it('covers the eight uploaded decks, each from its own sheet', () => {
    expect(EXTRACTED.sort()).toEqual(
      [
        'classic',
        'dantes_world',
        'eastern_woodlands',
        'fredericksburg',
        'fredericksburg_downtown',
        'inspire',
        'jak_gold',
        'spycraft',
      ].sort(),
    );
    expect(new Set(manifest.decks.map((d) => d.source)).size).toBe(manifest.decks.length);
    for (const d of manifest.decks) {
      expect(existsSync(join(SOURCES, d.source)), d.source).toBe(true);
      // Row order was read from each sheet; every suit appears exactly once.
      expect([...d.rows].sort(), d.id).toEqual([...SUITS].sort());
    }
  });

  it('ships only artwork for registered, ready decks', () => {
    for (const id of EXTRACTED) {
      const deck = getDeck(id);
      expect(deck.id, id).toBe(id);
      expect(deck.assets.status, id).toBe('ready');
      expect(deck.contentRating, id).toBe('general');
    }
  });

  it.each(EXTRACTED)('%s: 52 distinct cards mapped from the sheet into the standard grid', (id) => {
    const r = report(id);
    expect(checkAtlasReport(r, sheetSize(id))).toEqual([]);
    expect(Object.keys(r.frames)).toHaveLength(52);
    // The deck definition reads that grid with the engine's defaults (A…K × ♠ ♥ ♦ ♣).
    const faces = getDeck(id).assets.faces;
    expect(faces.type === 'atlas' && faces.grid).toMatchObject({ columns: 13, rows: 4 });
    expect(faces.type === 'atlas' && (faces.grid?.suitOrder ?? SUITS)).toEqual(SUITS);
  });

  it.each(EXTRACTED)('%s: every identity flag was reviewed by eye or reported as an artwork issue', (id) => {
    const r = report(id);
    expect(unexplainedFlags(r)).toEqual([]);
    for (const issue of r.artworkIssues) expect(issue.issue.length, id).toBeGreaterThan(10);
  });

  it.each(EXTRACTED)('%s: card back and preview are real images', (id) => {
    const back = sheetSize(id, 'back.webp');
    const preview = sheetSize(id, 'preview.webp');
    expect(back.height).toBeGreaterThan(back.width); // portrait, like the faces
    expect(preview.width).toBeGreaterThan(100);
  });

  it('records the artwork problems found while checking the sheets', () => {
    const cards = (id: string) => report(id).artworkIssues.flatMap((i) => i.cards);
    expect(cards('dantes_world')).toEqual(expect.arrayContaining(['5H', '5D', '5C', '5S', '7H', '7D', '7C', '7S']));
    expect(cards('fredericksburg')).toContain('10S');
    expect(cards('spycraft')).toContain('10S');
    expect(cards('inspire')).toEqual(expect.arrayContaining(['7S', '7H', '7C', 'JH', 'QH', 'KH']));
    expect(cards('eastern_woodlands')).toEqual(expect.arrayContaining(['QS', 'KS', '3H']));
    expect(report('classic').artworkIssues).toEqual([]);
  });

  it('flags a sheet whose cards are mislabeled or duplicated', () => {
    const r = report('classic');
    const swapped = { ...r, frames: { ...r.frames, AS: r.frames['2S']! } };
    expect(checkAtlasReport(swapped, sheetSize('classic')).map((p) => p.code)).toContain('frames.overlap');
    const { KC: _gone, ...short } = r.frames;
    expect(checkAtlasReport({ ...r, frames: short }, sheetSize('classic')).map((p) => p.code)).toContain(
      'frames.missing',
    );
    const unreviewed = {
      ...r,
      verification: { ...r.verification, '7H': { colour: 'red', colourOk: true, pips: 6, pipsOk: false } },
    };
    expect(unexplainedFlags(unreviewed as AtlasReport)).toEqual(['7H (pips)']);
  });
});

describe('loading extracted decks', () => {
  /** Fake browser image loading using the real files' sizes. */
  const realLoader = (fail: (url: string) => boolean = () => false) =>
    vi.fn(async (url: string) => {
      if (fail(url)) throw new Error('404');
      const file = join(PUBLIC, url.replace(/^\//, ''));
      if (!existsSync(file)) throw new Error(`404 ${url}`);
      return webpSize(readFileSync(file));
    });

  it.each(EXTRACTED)('%s: loads the atlas and back and maps every face to its own cell', async (id) => {
    const theme = themes().resolve(id);
    const am = new AssetManager({ baseUrl: '/', loadImage: realLoader() });
    const art = await am.loadDeck(theme);
    expect(art.missing).toEqual([]);
    expect(describeBack(art).kind).toBe('image');
    const { cell } = report(id);
    const positions = new Set<string>();
    for (const s of SUITS)
      for (const r of RANKS) {
        const v = describeFace(cardCode(r, s), art);
        expect(v.kind).toBe('atlas');
        if (v.kind !== 'atlas') continue;
        expect(v.ratio).toBeCloseTo(cell.width / cell.height, 5);
        positions.add(v.backgroundPosition);
      }
    expect(positions.size).toBe(52);
  });

  it('falls back to drawn cards when an uploaded sheet fails to load', async () => {
    const theme = { ...themes().resolve('spycraft'), key: 'spycraft@offline' };
    const am = new AssetManager({ baseUrl: '/', loadImage: realLoader((u) => u.endsWith('faces.webp')) });
    const renderer = new CardRenderer(am);
    const art = await am.loadDeck(theme);
    expect(art.faces).toBeNull();
    expect(art.missing).toHaveLength(52);
    const face = renderer.renderFace(theme, 'QH');
    expect(face.dataset.art).toBe('fallback');
    expect(face.textContent).toContain('Q');
    // The back loaded on its own, so it still shows its artwork.
    expect(renderer.renderBack(theme).dataset.art).toBe('image');
  });
});

describe('two-deck Spider with artwork', () => {
  it('keeps duplicate cards distinct while both copies share the same face', async () => {
    const deck = Deck.spider(4);
    const cards = deck.all;
    expect(cards).toHaveLength(104);
    expect(new Set(cards.map((c) => c.id)).size).toBe(104);
    const byCode = new Map<string, number>();
    for (const c of cards) byCode.set(c.code, (byCode.get(c.code) ?? 0) + 1);
    expect(byCode.size).toBe(52);
    expect([...byCode.values()].every((n) => n === 2)).toBe(true);

    const theme = themes().resolve('fredericksburg_downtown');
    const am = new AssetManager({
      baseUrl: '/',
      loadImage: vi.fn(async (url: string) => webpSize(readFileSync(join(PUBLIC, url.replace(/^\//, ''))))),
    });
    await am.loadDeck(theme);
    const renderer = new CardRenderer(am);
    const [a, b] = cards.filter((c) => c.code === 'QH');
    a!.faceUp = b!.faceUp = true;
    const ea = renderer.renderCard(a!, theme);
    const eb = renderer.renderCard(b!, theme);
    expect(ea.dataset.cardId).not.toBe(eb.dataset.cardId);
    const pos = (el: HTMLElement) => el.querySelector<HTMLElement>('.card-art-img')!.style.backgroundPosition;
    expect(pos(ea)).toBe(pos(eb));
  });

  it('lists every complete deck for play', () => {
    const playable = themes()
      .list()
      .filter((d) => d.assets.status === 'ready')
      .map((d) => d.id);
    expect(playable.sort()).toEqual([...EXTRACTED].sort());
    expect(allDecks().filter((d) => d.assets.status === 'ready')).toHaveLength(EXTRACTED.length);
  });
});
