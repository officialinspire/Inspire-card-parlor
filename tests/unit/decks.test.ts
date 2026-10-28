import { describe, expect, it } from 'vitest';
import { allDecks, getDeck, registerDeck } from '@/decks/registry';
import { DeckThemeManager, PLACEHOLDER_ASSETS, type ThemeContext } from '@/decks/DeckThemeManager';
import { standardAssets } from '@/decks/assets';
import {
  gridCoverage,
  validateAtlasMeta,
  validateDeckDefinition,
  validateDeckFiles,
  validateRegistry,
} from '@/decks/validation';
import type { DeckDefinition } from '@/decks/types';
import { ALL_CARD_CODES } from '@/engine/Card';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INITIAL = [
  'classic',
  'inspire',
  'jak_gold',
  'dantes_world',
  'yummyhole_standard',
  'yummyhole_after_dark',
  'fredericksburg',
  'fredericksburg_downtown',
  'eastern_woodlands',
  'spycraft',
  'freemasonry',
];

/** Decks whose artwork has been uploaded and extracted (art/sources/manifest.json). */
const UPLOADED = [
  'classic',
  'inspire',
  'jak_gold',
  'dantes_world',
  'fredericksburg',
  'fredericksburg_downtown',
  'eastern_woodlands',
  'spycraft',
];

const ctx = (
  over: Partial<{ mature: boolean; placeholder: boolean; variants: Record<string, string> }> = {},
): ThemeContext => ({
  matureAllowed: () => over.mature ?? false,
  placeholderArt: () => over.placeholder ?? false,
  variantFor: (id) => over.variants?.[id],
});

/** A deck with finished artwork and two collectible variants, for testing. */
const fixture: DeckDefinition = {
  ...getDeck('classic'),
  id: 'test_fixture',
  name: 'Test Fixture',
  artist: { name: 'Test Artist' },
  assets: { ...standardAssets('assets/cards/test_fixture/'), status: 'ready' },
  variants: [
    {
      id: 'gilded',
      name: 'Gilded',
      description: 'Alternate faces for the court cards',
      artist: { name: 'Test Artist' },
      rarity: 'epic',
      unlock: { type: 'level', value: 2 },
      assets: { status: 'ready', overrides: { QH: { path: 'alt/qh' }, KS: { path: 'alt/ks' } } },
    },
    {
      id: 'night',
      name: 'Night',
      description: 'Adult-themed variant',
      artist: { name: 'Test Artist' },
      rarity: 'legendary',
      unlock: { type: 'default' },
      contentRating: 'mature',
      assets: { basePath: 'assets/cards/mature/test_fixture/', status: 'ready', back: { path: 'back' } },
    },
  ],
};
registerDeck(fixture);

describe('deck registry', () => {
  it('contains the initial decks', () => {
    for (const id of INITIAL) expect(getDeck(id).id).toBe(id);
  });

  it('gives every deck the required metadata', () => {
    for (const id of INITIAL) {
      const d = getDeck(id);
      expect(d.name, id).toBeTruthy();
      expect(d.description, id).toBeTruthy();
      expect(d.artist, id).toBeDefined();
      expect(d.unlock, id).toBeDefined();
      expect(d.assets.faces, id).toBeDefined();
      expect(d.assets.back, id).toBeDefined();
      expect(d.assets.preview, id).toBeDefined();
      expect(d.assets.status, id).toBe(UPLOADED.includes(id) ? 'ready' : 'pending');
    }
  });

  it('does not invent artist credits', () => {
    for (const id of INITIAL) {
      const { artist } = getDeck(id);
      if (!UPLOADED.includes(id)) expect(artist.name, id).toBeNull();
      // Uploaded art is credited to the commissioning studio until the illustrator is confirmed.
      else
        expect(artist, id).toMatchObject({ name: 'OFFICIAL INSPIRE', note: expect.stringMatching(/to be confirmed/) });
    }
  });

  it('falls back to classic for unknown ids and refuses duplicates', () => {
    expect(getDeck('nope').id).toBe('classic');
    expect(() => registerDeck(getDeck('classic'))).toThrow(/already registered/);
  });

  it('isolates the adult-themed deck', () => {
    const mature = allDecks().filter((d) => d.contentRating === 'mature');
    expect(mature.map((d) => d.id)).toEqual(['yummyhole_after_dark']);
    for (const d of mature) expect(d.assets.basePath.startsWith('assets/cards/mature/')).toBe(true);
    for (const d of allDecks().filter((x) => x.contentRating === 'general')) {
      expect(d.assets.basePath.includes('/mature/')).toBe(false);
    }
  });
});

describe('deck validation', () => {
  it('passes every registered deck', () => {
    for (const r of validateRegistry(allDecks())) {
      expect(
        r.issues.filter((i) => i.level === 'error'),
        r.deckId,
      ).toEqual([]);
      expect(r.requiredFiles.length, r.deckId).toBeGreaterThanOrEqual(3);
    }
  });

  it('requires all 52 faces in a sprite sheet', () => {
    const short: DeckDefinition = {
      ...fixture,
      id: 'short',
      variants: [],
      assets: { ...fixture.assets, faces: { type: 'atlas', image: { path: 'faces' }, grid: { columns: 12, rows: 4 } } },
    };
    const r = validateDeckDefinition(short);
    expect(r.ok).toBe(false);
    expect(r.issues.find((i) => i.code === 'faces.missing')?.message).toMatch(/KS, KH, KD, KC/);
  });

  it('checks explicit frames are inside the sheet', () => {
    const frames = Object.fromEntries(ALL_CARD_CODES.map((c, i) => [c, { x: i * 10, y: 0, w: 10, h: 14 }]));
    const ok: DeckDefinition = {
      ...fixture,
      id: 'frames_ok',
      variants: [],
      assets: {
        ...fixture.assets,
        faces: { type: 'atlas', image: { path: 'f' }, frames, size: { width: 520, height: 14 } },
      },
    };
    expect(validateDeckDefinition(ok).ok).toBe(true);
    const bad = {
      ...ok,
      assets: { ...ok.assets, faces: { ...ok.assets.faces, size: { width: 100, height: 14 } } },
    } as DeckDefinition;
    expect(validateDeckDefinition(bad).issues.some((i) => i.code === 'atlas.frames')).toBe(true);
  });

  it('requires 52 individual images', () => {
    const individual: DeckDefinition = {
      ...fixture,
      id: 'individual',
      variants: [],
      assets: { ...fixture.assets, faces: { type: 'individual', pattern: 'faces/{code}' } },
    };
    const r = validateDeckDefinition(individual);
    expect(r.requiredFiles.filter((f) => f.purpose.startsWith('face '))).toHaveLength(52);
    expect(r.requiredFiles.find((f) => f.purpose === 'face 10H')!.candidates).toEqual([
      'assets/cards/test_fixture/faces/10H.webp',
      'assets/cards/test_fixture/faces/10H.png',
    ]);
  });

  it('enforces mature content isolation and valid variants', () => {
    const leaky: DeckDefinition = { ...fixture, id: 'leaky', contentRating: 'mature', variants: [] };
    expect(validateDeckDefinition(leaky).issues.some((i) => i.code === 'mature.isolation')).toBe(true);
    const badVariant: DeckDefinition = {
      ...fixture,
      id: 'bad_variant',
      variants: [{ ...fixture.variants[0]!, assets: { status: 'ready', overrides: { ZZ: { path: 'x' } } as never } }],
    };
    expect(validateDeckDefinition(badVariant).issues.some((i) => i.code === 'variant.override')).toBe(true);
    const unknownUnlock: DeckDefinition = {
      ...fixture,
      id: 'unknown_unlock',
      unlock: { type: 'story', value: 'chapter-99' },
    };
    expect(validateDeckDefinition(unknownUnlock).ok).toBe(false);
    expect(validateDeckDefinition(fixture).ok).toBe(true);
  });

  it('checks grids and atlas metadata', () => {
    expect(gridCoverage({ columns: 13, rows: 5, backCell: { column: 0, row: 4 } }).problems).toEqual([]);
    expect(gridCoverage({ columns: 13, rows: 4, backCell: { column: 0, row: 0 } }).problems).toEqual([
      'backCell overlaps a card face',
    ]);
    const meta = JSON.parse(readFileSync(join(process.cwd(), 'public/assets/cards/_placeholder/faces.json'), 'utf8'));
    expect(validateAtlasMeta(meta, true)).toEqual([]);
    expect(validateAtlasMeta({ frames: {} }, false)).toHaveLength(52);
  });

  it('reports missing files: warnings while pending, errors once ready', async () => {
    const none = () => false;
    const pending = await validateDeckFiles(getDeck('freemasonry'), none);
    expect(pending.ok).toBe(true);
    expect(pending.issues.find((i) => i.code === 'files.missing')?.level).toBe('warning');
    expect(pending.missingFiles.map((f) => f.purpose)).toEqual(['face sprite sheet', 'card back', 'preview image']);

    const strict = await validateDeckFiles(getDeck('freemasonry'), none, { strict: true });
    expect(strict.ok).toBe(false);

    const ready = await validateDeckFiles(fixture, none);
    expect(ready.ok).toBe(false);

    // PNG satisfies a webp-or-png requirement.
    const pngOnly = await validateDeckFiles(fixture, (p) => p.endsWith('.png'));
    expect(pngOnly.ok).toBe(true);
    expect(pngOnly.missingFiles).toEqual([]);
  });
});

describe('DeckThemeManager', () => {
  it('hides mature decks unless enabled', () => {
    const off = new DeckThemeManager(ctx());
    expect(off.list().map((d) => d.id)).not.toContain('yummyhole_after_dark');
    expect(off.list().map((d) => d.id)).toContain('yummyhole_standard');
    expect(off.isAvailable('yummyhole_after_dark')).toBe(false);
    expect(off.safeDeckId('yummyhole_after_dark')).toBe('classic');
    expect(off.resolve('yummyhole_after_dark').deck.id).toBe('classic');

    const on = new DeckThemeManager(ctx({ mature: true }));
    expect(on.list().map((d) => d.id)).toContain('yummyhole_after_dark');
    expect(on.resolve('yummyhole_after_dark').mature).toBe(true);
  });

  it('keeps mature art out of ordinary previews even when enabled', () => {
    const on = new DeckThemeManager(ctx({ mature: true }));
    expect(on.canShowArt('yummyhole_after_dark', 'ordinary')).toBe(false);
    expect(on.canShowArt('yummyhole_after_dark', 'explicit')).toBe(true);
    expect(on.canShowArt('classic', 'ordinary')).toBe(true);
    const off = new DeckThemeManager(ctx());
    expect(off.canShowArt('yummyhole_after_dark', 'explicit')).toBe(false);
  });

  it('applies alternate artwork without changing the deck', () => {
    const m = new DeckThemeManager(ctx({ variants: { test_fixture: 'gilded' } }));
    const theme = m.resolve('test_fixture');
    expect(theme.key).toBe('test_fixture@gilded');
    expect(theme.variant?.id).toBe('gilded');
    expect(Object.keys(theme.overrides)).toEqual(['QH', 'KS']);
    expect(theme.assets.faces).toEqual(fixture.assets.faces);
    expect(m.resolve('test_fixture', undefined).key).toBe('test_fixture@gilded');
    expect(new DeckThemeManager(ctx()).resolve('test_fixture').key).toBe('test_fixture@standard');
  });

  it('gates mature variants of general decks', () => {
    const off = new DeckThemeManager(ctx({ variants: { test_fixture: 'night' } }));
    expect(off.variants('test_fixture').map((v) => v.id)).toEqual(['gilded']);
    expect(off.resolve('test_fixture').variant).toBeNull();
    expect(off.canShowArt('test_fixture', 'ordinary')).toBe(true);

    const on = new DeckThemeManager(ctx({ mature: true, variants: { test_fixture: 'night' } }));
    const t = on.resolve('test_fixture');
    expect(t.variant?.id).toBe('night');
    expect(t.mature).toBe(true);
    expect(t.assets.basePath).toBe('assets/cards/mature/test_fixture/');
    expect(on.canShowArt('test_fixture', 'ordinary')).toBe(false);
  });

  it('substitutes the placeholder template for pending decks on request', () => {
    const m = new DeckThemeManager(ctx({ placeholder: true }));
    expect(m.resolve('freemasonry').placeholder).toBe(true);
    expect(m.resolve('freemasonry').assets).toBe(PLACEHOLDER_ASSETS);
    expect(m.resolve('test_fixture').placeholder).toBe(false);
    // Decks with uploaded artwork never fall back to the template.
    expect(m.resolve('classic').placeholder).toBe(false);
    expect(new DeckThemeManager(ctx()).resolve('freemasonry').placeholder).toBe(false);
  });
});
