import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { StoryManifest } from '@/story/art';
import { useStoryManifest } from '@/story/art';
import { STORY_CHAPTERS, getChapter } from '@/story/campaign';
import { applyStoryResult, markIntroSeen, storyOf } from '@/story/progress';
import { currentObjective, journalOf, levelAfter, locationState, replayableScenes, worldMap } from '@/story/world';
import { EVIDENCE } from '@/story/evidence';
import { createDefaultProfile } from '@/core/defaults';
import { Store } from '@/core/store';
import { UI } from '@/components/story/sprites';
import { worldMapView } from '@/components/story/map';
import { passportStamps } from '@/components/passportStamps';
import type { GameResult } from '@/progression/results';
import type { Profile } from '@/core/types';

const manifest = JSON.parse(readFileSync('public/assets/story/manifest.json', 'utf8')) as StoryManifest;
const sprites = new Set(manifest.sheets.flatMap((s) => s.sprites.map((x) => x.id)));

const winAll = (p: Profile, chapterId: string): Profile => {
  for (const level of getChapter(chapterId)!.levels) {
    const r: GameResult = {
      gameId: level.game,
      outcome: 'win',
      durationMs: 1000,
      score: 7,
      details: level.game === 'go-fish' ? { books: 7 } : {},
    };
    p = { ...p, ...applyStoryResult(p, level.id, r).patch };
  }
  return p;
};

describe('story artwork used by the screens', () => {
  it('every UI sprite the Story Mode screens use is in the manifest', () => {
    for (const id of Object.values(UI)) expect(sprites.has(id), id).toBe(true);
  });

  it('every chapter has a location tile on the map', () => {
    for (const c of STORY_CHAPTERS) expect(sprites.has(c.artwork.locationSprite!), c.id).toBe(true);
  });
});

describe('world map states', () => {
  it('starts with only Chapter 1 playable; the next place is discovered but locked; the rest undiscovered', () => {
    const p = createDefaultProfile();
    expect(STORY_CHAPTERS.map((c) => locationState(p, c))).toEqual([
      'available',
      'locked',
      ...Array(7).fill('undiscovered'),
    ]);
    const stops = worldMap(p);
    expect(stops[0]!.name).toBe('Cheryl’s Antique Shop');
    expect(stops[1]!.name).toBe('Rappahannock River Station');
    expect(stops[2]!.name).toBe('Undiscovered location');
    expect(stops[2]!.description).not.toContain('Dante');
  });

  it('completing Chapter 1 opens Chapter 2, discovers Chapter 3, and keeps Chapter 1 to revisit', () => {
    const p = winAll(createDefaultProfile(), 'th-1');
    expect(STORY_CHAPTERS.slice(0, 4).map((c) => locationState(p, c))).toEqual([
      'completed',
      'available',
      'locked',
      'undiscovered',
    ]);
    expect(currentObjective(p)?.level.id).toBe('th-2-1');
  });

  it('a finished campaign completes every place', () => {
    let p = createDefaultProfile();
    for (const c of STORY_CHAPTERS) p = winAll(p, c.id);
    expect(STORY_CHAPTERS.every((c) => locationState(p, c) === 'completed')).toBe(true);
    expect(currentObjective(p)).toBeNull();
  });

  it('knows the challenge after each one', () => {
    expect(levelAfter('th-1-1')?.id).toBe('th-1-2');
    expect(levelAfter('th-1-5')).toBeUndefined();
  });
});

describe('journal', () => {
  it('lists clues from the save, in story order, with chapter summaries once solved', () => {
    let p = createDefaultProfile();
    expect(journalOf(p).clues).toEqual([]);
    p = { ...p, ...markIntroSeen(p, 'th-1') };
    p = winAll(p, 'th-1');
    const j = journalOf(p);
    expect(j.clues.map((c) => c.id)).toEqual([
      'thirteenth-hand-card',
      'estate-sale-receipt',
      'ledger-of-twelve',
      'river-postcard',
    ]);
    expect(j.clues.find((c) => c.id === 'thirteenth-hand-card')!.importance).toBe('key');
    expect(j.clues.find((c) => c.id === 'estate-sale-receipt')!.importance).toBe('optional');
    expect(j.cluesTotal).toBe(EVIDENCE.length);
    expect(j.chapters.map((c) => c.chapter.id)).toEqual(['th-1', 'th-2']);
    expect(j.chapters[0]!.summary).toBe(getChapter('th-1')!.mysteryThread);
    expect(j.chapters[1]!.summary).toBeNull();
    expect(j.objective?.level.id).toBe('th-2-1');
    // Clues survive a save and reload.
    const s = new Store();
    s.dispatch({ type: 'HYDRATE', profile: JSON.parse(JSON.stringify(p)) });
    expect(storyOf(s.state.profile).evidence).toEqual(j.clues.map((c) => c.id));
  });

  it('offers seen scenes for replay', () => {
    let p = createDefaultProfile();
    expect(replayableScenes(p)).toEqual([]);
    p = { ...p, ...markIntroSeen(p, 'th-1') };
    expect(replayableScenes(p).map((s) => s.id)).toEqual(['th-1:intro']);
    p = winAll(p, 'th-1');
    const ids = replayableScenes(p).map((s) => s.id);
    expect(ids[0]).toBe('th-1:intro');
    expect(ids).toContain('th-1-1:outro');
    expect(ids.at(-1)).toBe('th-1:outro');
  });
});

describe('screens render from data, with or without artwork', () => {
  it('draws the map: nine named, described stops; hidden names stay hidden', () => {
    useStoryManifest(manifest);
    const el = worldMapView(createDefaultProfile(), () => undefined);
    const tiles = [...el.querySelectorAll<HTMLButtonElement>('[data-chapter]')];
    expect(tiles).toHaveLength(9);
    expect(tiles.map((t) => t.dataset.state)).toEqual(['available', 'locked', ...Array(7).fill('undiscovered')]);
    expect(tiles[0]!.getAttribute('aria-label')).toContain('Cheryl’s Antique Shop');
    expect(tiles[0]!.getAttribute('aria-current')).toBe('step');
    expect(tiles[2]!.getAttribute('aria-label')).toContain('Undiscovered location');
    expect(tiles[2]!.textContent).not.toContain('iSMOKESHOP');
    for (const t of tiles) expect(el.querySelector(`#${t.getAttribute('aria-describedby')}`)?.textContent).toBeTruthy();
    expect(el.querySelector('[data-story-sprite^="location-cheryls"]')).not.toBeNull();
  });

  it('still works with no artwork at all', () => {
    useStoryManifest({ ...manifest, sheets: [] });
    const el = worldMapView(createDefaultProfile(), () => undefined);
    expect(el.querySelectorAll('[data-chapter]')).toHaveLength(9);
    expect(el.querySelector('img')).toBeNull();
    useStoryManifest(manifest);
  });

  it('shows earned passport stamps with their artwork, once each, and first-campaign stamps apart', () => {
    useStoryManifest(manifest);
    const s = new Store();
    s.dispatch({
      type: 'HYDRATE',
      profile: {
        story: { ...createDefaultProfile().story, stamps: ['th-antique-shop'] },
        legacyStory: {
          campaign: 'card-parlor-chronicles',
          chaptersCompleted: 1,
          completed: [],
          rewarded: [],
          stamps: ['hometown'],
          introsSeen: [],
          attempts: {},
          archivedAt: 0,
        },
      },
    });
    const el = passportStamps(s, { legacy: true });
    expect(el.querySelectorAll('.stamp')).toHaveLength(9);
    expect(el.querySelectorAll('.stamp.earned')).toHaveLength(1);
    expect(el.querySelector('[data-stamp="th-antique-shop"] img')?.getAttribute('data-story-sprite')).toBe(
      'passport-stamps/antique-clock-key',
    );
    expect(el.querySelector('[data-legacy-stamp="hometown"]')?.textContent).toBe('The Hometown');
    expect(passportStamps(s).querySelector('[data-legacy-stamp]')).toBeNull();
  });
});

describe('the playable demo (chapters 1–2)', () => {
  it('plays the challenges in the order the demo specifies', () => {
    expect(getChapter('th-1')!.levels.map((l) => l.game)).toEqual(['war', 'klondike', 'go-fish', 'freecell', 'spider']);
    expect(getChapter('th-2')!.levels.map((l) => l.game)).toEqual(['go-fish', 'klondike', 'freecell', 'spider', 'war']);
    expect(getChapter('th-2')!.levels[0]!.setup.options?.opponents).toEqual(['sophia']);
    expect(getChapter('th-2')!.levels[4]!.setup.options?.opponent).toBe('sophia');
    for (const id of ['th-1', 'th-2']) {
      const ch = getChapter(id)!;
      expect(ch.levels[0]!.setup.options?.draw ?? 1).toBe(1);
      for (const l of ch.levels) {
        if (l.game === 'klondike') expect(l.setup.options?.draw).toBe(1);
        if (l.game === 'spider') expect(l.setup.options?.suits).toBe(1);
        if (l.game === 'go-fish') expect(l.setup.options?.difficulty).toBe('easy');
      }
    }
  });

  it('gives Chapter 2 optional field notes on real wildlife and history, each sourced', () => {
    const ch = getChapter('th-2')!;
    const notes = [...(ch.info ?? []), ...ch.levels.flatMap((l) => l.info ?? [])];
    expect(notes.filter((n) => n.kind === 'wildlife').length).toBeGreaterThanOrEqual(2);
    expect(notes.filter((n) => n.kind === 'history').length).toBeGreaterThanOrEqual(1);
    for (const n of notes) {
      if (n.kind !== 'note') expect(n.source, n.id).toBeTruthy();
      if (n.sprite) expect(sprites.has(n.sprite), n.sprite).toBe(true);
    }
    // The deck is a visual theme, not a claim about Native spirituality.
    expect(notes.find((n) => n.id === 'eastern-woodlands-deck')?.text).toMatch(/visual theme.*do not represent/s);
    // The river map clue is Sophia's annotated map, with its own artwork.
    const map = EVIDENCE.find((e) => e.id === 'sophia-river-map')!;
    expect(map.sprite).toBe('rappahannock-river-map/rappahannock-river-map');
  });

  it('after Chapter 2, Chapter 3 opens to play and only the place after it is revealed', () => {
    let p = winAll(createDefaultProfile(), 'th-1');
    p = winAll(p, 'th-2');
    expect(STORY_CHAPTERS.slice(0, 5).map((c) => locationState(p, c))).toEqual([
      'completed',
      'completed',
      'available',
      'locked',
      'undiscovered',
    ]);
    expect(currentObjective(p)?.level.id).toBe('th-3-1');
    expect(journalOf(p).preview).toBeNull();
    expect(storyOf(p).stamps).toEqual(['th-antique-shop', 'th-river-station']);
  });
});

describe('campaign data version 2 (Chapter 2 reordered)', () => {
  it('remaps saved Chapter 2 progress by meaning, so no win is lost and nothing pays twice', async () => {
    const { migrateProfile } = await import('@/storage/persistence');
    const v1 = {
      ...createDefaultProfile(),
      story: {
        ...createDefaultProfile().story,
        version: 1,
        // Old order: 1 Klondike, 2 War, 3 Go Fish, 4 FreeCell, 5 Spider.
        completed: ['th-1-1', 'th-2-1', 'th-2-2'],
        rewarded: ['level:th-2-1', 'level:th-2-2', 'chapter:th-1'],
        attempts: { 'th-2-1': 2, 'th-2-2': 1 },
        evidence: ['old-river-map', 'club-mark'],
      },
    };
    const m = migrateProfile(v1 as Profile) as Profile;
    const s = storyOf({ ...createDefaultProfile(), ...m });
    expect(s.version).toBe(2);
    // Klondike was th-2-1, now th-2-2; War was th-2-2, now th-2-5.
    expect(s.completed).toEqual(['th-1-1', 'th-2-2', 'th-2-5']);
    expect(s.rewarded).toEqual(['level:th-2-2', 'level:th-2-5', 'chapter:th-1']);
    expect(s.attempts).toEqual({ 'th-2-2': 2, 'th-2-5': 1 });
    expect(s.evidence).toEqual(['sophia-river-map', 'club-mark']);
    // Winning the remapped Klondike again pays nothing more.
    const p = { ...createDefaultProfile(), ...m };
    const klondike = getChapter('th-2')!.levels.find((l) => l.game === 'klondike')!;
    const r = applyStoryResult(p, klondike.id, { gameId: 'klondike', outcome: 'win', durationMs: 1 });
    expect(r.outcome.levelRewards).toEqual([]);
    // And the upgrade is idempotent.
    expect(storyOf({ ...p, ...(migrateProfile(JSON.parse(JSON.stringify(m))) as Profile) })).toEqual(s);
  });
});

describe('places and results', () => {
  it('gives every chapter its own palette, in both themes', async () => {
    const css = readFileSync('src/themes/story.css', 'utf8');
    for (const c of STORY_CHAPTERS) {
      const block = css.match(new RegExp(`:root\\[data-story-place='${c.id}'\\] \\{([^}]*)\\}`))?.[1];
      expect(block, c.id).toBeTruthy();
      for (const v of [
        '--pl-deep',
        '--pl-mid',
        '--pl-accent',
        '--pl-accent-day',
        '--pl-paper',
        '--pl-box',
        '--pl-narr',
      ])
        expect(block, `${c.id} ${v}`).toContain(`${v}:`);
    }
    expect(css).toContain(":root[data-story-place][data-theme='night']");
    expect(css).toContain(":root[data-story-place][data-theme='day']");
  });

  it('shows credits and XP from a finale and its chapter as one total each', async () => {
    const { withTotals } = await import('@/components/story/results');
    expect(
      withTotals([
        { kind: 'credits', amount: 220 },
        { kind: 'xp', amount: 260 },
        { kind: 'evidence', id: 'awakened-card' },
        { kind: 'deck', id: 'washington_ghost' },
        { kind: 'credits', amount: 800 },
        { kind: 'xp', amount: 400 },
      ]),
    ).toEqual([
      { kind: 'credits', amount: 1020 },
      { kind: 'xp', amount: 660 },
      { kind: 'evidence', id: 'awakened-card' },
      { kind: 'deck', id: 'washington_ghost' },
    ]);
  });
});
