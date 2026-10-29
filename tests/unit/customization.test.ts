import { describe, expect, it, vi } from 'vitest';
import { allBoards, getBoard } from '@/boards/registry';
import { applyBoard, ambientLayer, boardSwatch } from '@/boards/BoardRenderer';
import { contrastRatio } from '@/utils/color';
import { allDecks, getDeck, registerDeck } from '@/decks/registry';
import { DeckThemeManager, type ThemeContext } from '@/decks/DeckThemeManager';
import { standardAssets } from '@/decks/assets';
import type { DeckDefinition } from '@/decks/types';
import { applyArtworkManifest } from '@/assets/artworkManifest';
import { validateDeckDefinition } from '@/decks/validation';
import { collectionProgress } from '@/progression/collection';
import { isVariantOwned } from '@/progression/levels';
import { isAdult } from '@/components/AgeGate';
import { FEATURES } from '@/core/config';
import { createDefaultProfile } from '@/core/defaults';
import { Store } from '@/core/store';
import { CHAPTERS } from '@/story/chapters';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { CardRenderer } from '@/engine/CardRenderer';
import { AssetManager } from '@/assets/AssetManager';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';

const BOARD_IDS = [
  'picnic_table',
  'backroom_card_table',
  'downtown_cafe',
  'rappahannock_riverside',
  'woodland_clearing',
  'jak_golds_casino',
  'artists_studio',
  'safehouse',
  'masonic_study',
];

/** A deck with collectible artwork: one bought with credits, one earned by level. */
const collectible: DeckDefinition = {
  ...getDeck('classic'),
  id: 'collectible_fixture',
  name: 'Collectible Fixture',
  artist: { name: 'Fixture Artist', url: 'https://example.com' },
  assets: { ...standardAssets('assets/cards/collectible_fixture/'), status: 'ready' },
  variants: [
    {
      id: 'gilded',
      name: 'Gilded',
      description: 'Bought with credits',
      artist: { name: 'Fixture Artist' },
      rarity: 'epic',
      unlock: { type: 'credits', value: 300 },
      assets: { status: 'ready', back: { path: 'gilded-back' }, overrides: { QH: { path: 'alt/qh' } } },
    },
    {
      id: 'veteran',
      name: 'Veteran',
      description: 'Earned at level 5',
      artist: { name: 'Fixture Artist' },
      rarity: 'rare',
      unlock: { type: 'level', value: 5 },
      assets: { status: 'ready', back: { path: 'veteran-back' } },
    },
  ],
};
registerDeck(collectible);

function themes(
  over: Partial<ThemeContext> & {
    profile?: ReturnType<typeof createDefaultProfile>;
    back?: string | null;
    variants?: Record<string, string>;
  } = {},
) {
  const profile = over.profile ?? createDefaultProfile();
  return new DeckThemeManager({
    matureAllowed: () => false,
    placeholderArt: () => false,
    variantFor: (id) => over.variants?.[id],
    ownsVariant: (deckId, variantId) => {
      const v = getDeck(deckId).variants.find((x) => x.id === variantId);
      return !!v && isVariantOwned(deckId, v, profile);
    },
    ownsDeck: (id) => ['classic', 'inspire', 'jak_gold', 'collectible_fixture'].includes(id),
    cardBack: () => over.back ?? null,
    ...over,
  });
}

describe('gameboards', () => {
  const UPLOADED_BOARDS = ['picnic_table', 'backroom_card_table', 'rappahannock_riverside'];

  it('registers the nine boards with full metadata', () => {
    expect(allBoards().map((b) => b.id)).toEqual(BOARD_IDS);
    for (const b of allBoards()) {
      expect(b.name, b.id).toBeTruthy();
      expect(b.description, b.id).toBeTruthy();
      expect(b.artist, b.id).toBeDefined();
      const uploaded = UPLOADED_BOARDS.includes(b.id);
      // Uploaded boards are credited to the commissioning studio; the rest have no invented credit.
      expect(b.artist.name, b.id).toBe(uploaded ? 'OFFICIAL INSPIRE' : null);
      expect(b.assets.basePath).toBe(`assets/backgrounds/${b.id}/`);
      expect(b.assets.status, b.id).toBe(uploaded ? 'ready' : 'pending');
      const u = b.unlock;
      if (u.type === 'story') expect(CHAPTERS.some((c) => c.id === u.value)).toBe(true);
      if (u.type === 'achievement') expect(ACHIEVEMENTS.some((a) => a.id === u.value)).toBe(true);
    }
    expect(getBoard('velvet-green').id).toBe('backroom_card_table');
  });

  it('keeps on-board text readable on every board (WCAG AA)', () => {
    for (const b of allBoards()) {
      expect(contrastRatio(b.ink, b.surface.base), b.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applies a board, its tone, scrim and optional ambient layer', () => {
    const table = document.createElement('section');
    const stage = document.createElement('div');
    applyBoard(table, stage, getBoard('picnic_table'), { ambient: true, highContrast: false });
    expect(table.dataset.board).toBe('picnic_table');
    expect(table.dataset.boardTone).toBe('light');
    // Artwork loads asynchronously; the CSS surface shows until it arrives.
    expect(table.dataset.boardArt).toBe('fallback');
    expect(table.style.getPropertyValue('--board-ink')).toBe(getBoard('picnic_table').ink);
    expect(stage.querySelector('[data-ambient="breeze"]')).not.toBeNull();

    applyBoard(table, stage, getBoard('safehouse'), { ambient: false, highContrast: true });
    expect(table.dataset.boardTone).toBe('dark');
    expect(table.classList.contains('high-contrast')).toBe(true);
    expect(stage.querySelector('.ambient')).toBeNull();
  });

  it('draws every ambient kind and board swatch', () => {
    for (const b of allBoards()) {
      expect(ambientLayer(b.ambient).dataset.ambient).toBe(b.ambient);
      expect(boardSwatch(b).dataset.boardSwatch).toBe(b.id);
    }
  });

  it('cleans up selections of boards that no longer exist', () => {
    const s = new Store();
    s.dispatch({
      type: 'HYDRATE',
      selection: { boardId: 'oxblood-lounge', byGame: { war: { deckId: 'classic', boardId: 'midnight-blue' } } },
    });
    s.dispatch({ type: 'REPLACE_BOARD', known: BOARD_IDS, fallback: 'backroom_card_table' });
    expect(s.state.selection.boardId).toBe('backroom_card_table');
    expect(s.state.selection.byGame.war?.boardId).toBe('backroom_card_table');
  });

  it('changing the board never touches a game in progress', () => {
    const g = KlondikeGame.create({ seed: 3 });
    g.stockAction();
    const before = JSON.stringify(g.table.snapshot().piles);
    const table = document.createElement('section');
    const stage = document.createElement('div');
    for (const b of allBoards()) applyBoard(table, stage, b, { ambient: true, highContrast: false });
    expect(JSON.stringify(g.table.snapshot().piles)).toBe(before);
  });
});

describe('card backs', () => {
  it('pairs any deck with a back from another owned deck', () => {
    const m = themes({ back: 'jak_gold' });
    const t = m.resolve('classic');
    expect(t.deck.id).toBe('classic');
    expect(t.backTheme?.deck.id).toBe('jak_gold');
    expect(t.key).toContain('back:jak_gold');
    // Rendering uses the chosen back, faces stay with the deck.
    const r = new CardRenderer(new AssetManager({ loadImage: async () => ({ width: 1, height: 1 }) }));
    expect(r.renderBack(t).dataset.theme).toBe(t.backTheme!.key);
    expect(r.renderFace(t, 'AS').dataset.theme).toBe(t.key);
  });

  it('ignores backs the player cannot use', () => {
    expect(themes({ back: 'freemasonry' }).resolve('classic').backTheme).toBeUndefined(); // not owned
    expect(themes({ back: 'yummyhole_after_dark' }).resolve('classic').backTheme).toBeUndefined(); // adult, disabled
    expect(themes({ back: 'collectible_fixture@gilded' }).resolve('classic').backTheme).toBeUndefined(); // artwork not owned
    expect(themes({ back: 'classic' }).resolve('classic').backTheme).toBeUndefined(); // same as the deck
  });

  it('lists owned decks and owned artwork with their own backs', () => {
    const profile = { ...createDefaultProfile(), level: 6 };
    const ids = themes({ profile })
      .availableBacks()
      .map((b) => b.id);
    expect(ids).toContain('classic');
    expect(ids).toContain('collectible_fixture@veteran'); // earned by level
    expect(ids).not.toContain('collectible_fixture@gilded'); // not bought
    expect(ids).not.toContain('freemasonry');
    expect(ids).not.toContain('yummyhole_after_dark');
  });
});

describe('collectible artwork', () => {
  it('applies alternate artwork only when owned, and never changes the deck', () => {
    const notOwned = themes({ variants: { collectible_fixture: 'gilded' } }).resolve('collectible_fixture');
    expect(notOwned.variant).toBeNull(); // falls back to standard art: still fully playable
    const profile = { ...createDefaultProfile(), ownedVariants: ['collectible_fixture@gilded'] };
    const owned = themes({ profile, variants: { collectible_fixture: 'gilded' } }).resolve('collectible_fixture');
    expect(owned.variant?.id).toBe('gilded');
    expect(Object.keys(owned.overrides)).toEqual(['QH']);
    expect(owned.deck).toBe(notOwned.deck);
    expect(owned.assets.faces).toEqual(notOwned.assets.faces);
  });

  it('buys artwork with credits exactly once', () => {
    const s = new Store();
    s.dispatch({ type: 'UPDATE_PROFILE', patch: { credits: 500 } });
    s.dispatch({ type: 'OWN_VARIANT', key: 'collectible_fixture@gilded', cost: 300 });
    expect(s.state.profile.credits).toBe(200);
    expect(s.state.profile.ownedVariants).toEqual(['collectible_fixture@gilded']);
    s.dispatch({ type: 'OWN_VARIANT', key: 'collectible_fixture@gilded', cost: 300 });
    expect(s.state.profile.credits).toBe(200);
    s.dispatch({ type: 'OWN_VARIANT', key: 'collectible_fixture@other', cost: 300 }); // can't afford
    expect(s.state.profile.ownedVariants).toHaveLength(1);
  });

  it('validates credit prices on collectible artwork', () => {
    expect(validateDeckDefinition(collectible).ok).toBe(true);
    const bad = {
      ...collectible,
      id: 'bad_price',
      variants: [{ ...collectible.variants[0]!, unlock: { type: 'credits' as const, value: 0 } }],
    };
    expect(validateDeckDefinition(bad).issues.some((i) => i.code === 'variant.unlock.credits')).toBe(true);
  });

  it('knows which artwork is owned', () => {
    const p = createDefaultProfile();
    const [gilded, veteran] = collectible.variants;
    expect(isVariantOwned('collectible_fixture', gilded!, p)).toBe(false);
    expect(
      isVariantOwned('collectible_fixture', gilded!, { ...p, ownedVariants: ['collectible_fixture@gilded'] }),
    ).toBe(true);
    expect(isVariantOwned('other_deck', gilded!, { ...p, ownedVariants: ['collectible_fixture@gilded'] })).toBe(false);
    expect(isVariantOwned('collectible_fixture', veteran!, { ...p, level: 5 })).toBe(true);
  });
});

describe('favorites and completion', () => {
  it('toggles favorite decks', () => {
    const s = new Store();
    s.dispatch({ type: 'TOGGLE_FAVORITE_DECK', deckId: 'jak_gold' });
    s.dispatch({ type: 'TOGGLE_FAVORITE_DECK', deckId: 'spycraft' });
    expect(s.state.profile.favoriteDecks).toEqual(['jak_gold', 'spycraft']);
    s.dispatch({ type: 'TOGGLE_FAVORITE_DECK', deckId: 'jak_gold' });
    expect(s.state.profile.favoriteDecks).toEqual(['spycraft']);
  });

  it('computes collection completion over visible decks, artwork and boards', () => {
    const decks = allDecks().filter((d) => d.contentRating !== 'mature');
    const fresh = collectionProgress(createDefaultProfile(), decks, allBoards());
    // Classic, INSPIRE and the fixture (which copies Classic's default unlock).
    expect(fresh.decks).toEqual({ owned: 3, total: decks.length });
    expect(fresh.boards).toEqual({ owned: 2, total: 9 });
    // The fixture's two pieces plus the Eastern Woodlands turtle back.
    expect(fresh.artwork).toEqual({ owned: 0, total: 3 });
    expect(fresh.percent).toBe(Math.floor((5 / (decks.length + 9 + 3)) * 100));

    const everything = {
      ...createDefaultProfile(),
      level: 99,
      storyChapter: 99,
      unlockedAchievements: ACHIEVEMENTS.map((a) => a.id),
      ownedVariants: ['collectible_fixture@gilded', 'eastern_woodlands@turtle'],
    };
    expect(collectionProgress(everything, decks, allBoards()).percent).toBe(100);
  });
});

describe('uploaded artwork manifest', () => {
  it('wires validated artwork and credits into existing decks and boards', () => {
    const result = applyArtworkManifest({
      version: 1,
      decks: {
        inspire: {
          status: 'ready',
          artist: { name: 'Manifest Artist', url: 'https://example.com/art' },
          faces: { type: 'individual', pattern: 'faces/{code}', formats: ['png'] },
        },
      },
      boards: { safehouse: { status: 'ready', artist: { name: 'Board Artist' } } },
    });
    expect(result).toEqual({ applied: ['inspire', 'safehouse'], rejected: [] });
    expect(getDeck('inspire').assets.status).toBe('ready');
    expect(getDeck('inspire').artist.name).toBe('Manifest Artist');
    expect(getDeck('inspire').assets.faces.type).toBe('individual');
    expect(getBoard('safehouse').assets.status).toBe('ready');
    expect(getBoard('safehouse').artist.name).toBe('Board Artist');
  });

  it('rejects invalid entries without changing anything', () => {
    const before = JSON.stringify(getDeck('yummyhole_standard'));
    const result = applyArtworkManifest({
      version: 1,
      decks: {
        yummyhole_standard: { status: 'ready' }, // ready without an artist credit
        nope: { status: 'ready' },
        freemasonry: { faces: { type: 'atlas', image: { path: 'faces' }, grid: { columns: 12, rows: 4 } } }, // missing Kings
      },
      boards: { picnic_table: { background: { path: '../../etc' } }, nope: {} },
    });
    expect(result.applied).toEqual([]);
    expect(result.rejected.map((r) => r.id).sort()).toEqual([
      'freemasonry',
      'nope',
      'nope',
      'picnic_table',
      'yummyhole_standard',
    ]);
    expect(JSON.stringify(getDeck('yummyhole_standard'))).toBe(before);
    expect(applyArtworkManifest({ version: 2 }).rejected[0]!.id).toBe('manifest');
  });

  it('keeps adult artwork isolated even when uploaded', () => {
    const result = applyArtworkManifest({
      version: 1,
      decks: {
        jak_gold: {
          variants: [
            {
              id: 'night',
              name: 'Night',
              description: '',
              artist: { name: 'x' },
              rarity: 'rare',
              unlock: { type: 'default' },
              contentRating: 'mature',
              assets: { status: 'ready', basePath: 'assets/cards/jak_gold/', back: { path: 'b' } },
            },
          ],
        },
      },
    });
    expect(result.rejected[0]?.reasons.join()).toMatch(/mature/);
  });
});

describe('adult-only content', () => {
  it('is compiled out of the default build', () => {
    expect(FEATURES.matureContent).toBe(false);
  });

  it('age check assumes the birthday has not happened yet', () => {
    const now = new Date('2026-06-01');
    expect(isAdult(2007, now)).toBe(true); // at least 18
    expect(isAdult(2008, now)).toBe(false); // might still be 17
    expect(isAdult(2020, now)).toBe(false);
    expect(isAdult(Number.NaN, now)).toBe(false);
    expect(isAdult(1800, now)).toBe(false);
  });

  it('is never requested or listed unless allowed', () => {
    const loadImage = vi.fn(async () => ({ width: 1, height: 1 }));
    const am = new AssetManager({ loadImage, matureAllowed: () => false });
    expect(() => am.url('assets/cards/mature/x/', 'back.png')).toThrow();
    expect(
      themes()
        .list()
        .some((d) => d.contentRating === 'mature'),
    ).toBe(false);
  });
});

describe('painted gameboards', () => {
  it('keep each painting focused per orientation and darken it only where needed', () => {
    const table = document.createElement('section');
    const stage = document.createElement('div');
    for (const id of ['backroom_card_table', 'picnic_table', 'rappahannock_riverside']) {
      const b = getBoard(id);
      expect(b.assets.status, id).toBe('ready');
      expect(b.art?.focus?.portrait, id).toMatch(/^\d+% \d+%$/);
      expect(b.art?.focus?.landscape, id).toMatch(/^\d+% \d+%$/);
      applyBoard(table, stage, b, { ambient: false, highContrast: false });
      expect(table.style.getPropertyValue('--board-focus-p')).toBe(b.art!.focus!.portrait);
      expect(Number(table.style.getPropertyValue('--board-scrim'))).toBe(b.art!.scrim);
    }
    // Dark felt needs no darkening; the light woven mat gets the most.
    expect(getBoard('backroom_card_table').art!.scrim).toBe(0);
    expect(getBoard('rappahannock_riverside').art!.scrim!).toBeGreaterThan(getBoard('picnic_table').art!.scrim!);
  });
});
