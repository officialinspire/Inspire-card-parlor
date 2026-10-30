import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CATEGORIES, getAchievement, progressOf } from '@/achievements/registry';
import { GLYPHS } from '@/achievements/glyphs';
import { buildFacts } from '@/achievements/facts';
import { newlyEarned, unlockEarned, evaluateAchievements } from '@/achievements/engine';
import {
  applyJournal,
  gamesToday,
  journalForGame,
  localDay,
  mergeJournals,
  type GameRecord,
} from '@/achievements/journal';
import { createDefaultProfile } from '@/core/defaults';
import { Store, reduce, createInitialState } from '@/core/store';
import { recordGameResult } from '@/progression/results';
import { migrateProfile } from '@/storage/persistence';
import type { Profile } from '@/core/types';
import { allDecks } from '@/decks/registry';

const noon = new Date('2026-05-05T12:00:00');
const evening = new Date('2026-05-05T20:00:00');

const record = (over: Partial<GameRecord> = {}): GameRecord => ({
  gameId: 'klondike',
  outcome: 'win',
  durationMs: 200_000,
  at: evening,
  deckId: 'classic',
  boardId: 'backroom_card_table',
  story: false,
  silent: false,
  leftHanded: false,
  details: {},
  lossStreak: 0,
  gamesToday: 0,
  today: localDay(evening),
  ...over,
});

describe('achievement registry', () => {
  it('has exactly 150 achievements with unique ids across all ten categories', () => {
    expect(ACHIEVEMENTS).toHaveLength(150);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(150);
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'general',
      'klondike',
      'spider',
      'freecell',
      'war',
      'go-fish',
      'story',
      'collection',
      'exploration',
      'secrets',
    ]);
    for (const c of CATEGORIES) expect(ACHIEVEMENTS.filter((a) => a.category === c.id).length).toBeGreaterThan(10);
  });

  it('gives every achievement a name, condition, drawn icon, rarity, XP and a target', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length, a.id).toBeGreaterThan(2);
      expect(a.description.length, a.id).toBeGreaterThan(8);
      expect(Object.keys(GLYPHS), a.id).toContain(a.icon);
      expect(a.icon).not.toMatch(emoji);
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(a.rarity);
      expect(a.xp).toBeGreaterThan(0);
      expect(a.target).toBeGreaterThan(0);
    }
    for (const g of Object.values(GLYPHS)) expect(g).not.toMatch(emoji);
  });

  it('keeps every id that older saves may hold', () => {
    for (const id of [
      'first-visit',
      'first-win',
      'win-streak-5',
      'klondike-10',
      'spider-4suit',
      'freecell-nocell',
      'war-flawless',
      'gofish-sweep',
      'collector-5',
      'story-ch1',
      'story-all',
      'night-owl',
      'passport-first',
      'halfway-home',
      'chronicles-complete',
    ])
      expect(getAchievement(id), id).toBeTruthy();
  });

  it('reports progress for every achievement on a brand-new profile without errors', () => {
    const f = buildFacts(createDefaultProfile());
    for (const a of ACHIEVEMENTS) {
      const v = progressOf(a, f);
      expect(Number.isFinite(v), a.id).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(a.target);
    }
    // A new player has earned nothing yet (not even the visit, until they enter).
    expect(newlyEarned(createDefaultProfile()).map((a) => a.id)).toEqual([]);
  });

  it('secret achievements are hidden', () => {
    expect(ACHIEVEMENTS.filter((a) => a.category === 'secrets').every((a) => a.hidden)).toBe(true);
  });
});

describe('journal', () => {
  it('only grows: counters add or keep a maximum, sets add members once', () => {
    let j = applyJournal(undefined, { add: { games: 1 }, max: { best: 4 }, seen: { decks: ['classic'] } });
    j = applyJournal(j, { add: { games: 2 }, max: { best: 2 }, seen: { decks: ['classic', 'inspire'] } });
    expect(j).toEqual({ counters: { games: 3, best: 4 }, seen: { decks: ['classic', 'inspire'] } });
  });

  it('merges a saved journal over defaults without losing anything', () => {
    const merged = mergeJournals(
      { counters: { a: 1 }, seen: { decks: ['classic'] } },
      { counters: { b: 2 }, seen: { decks: ['inspire'] } },
    );
    expect(merged).toEqual({ counters: { a: 1, b: 2 }, seen: { decks: ['classic', 'inspire'] } });
  });

  it('records the facts of a game', () => {
    const u = journalForGame(
      record({ details: { undos: 0, hints: 0, draw: 3 }, deckId: 'fredericksburg_downtown', boardId: 'downtown_cafe' }),
    );
    expect(u.add).toMatchObject({
      games: 1,
      'wins.klondike.draw3': 1,
      'wins.klondike.noUndo': 1,
      'wins.klondike.noHint': 1,
      'secret.hometown': 1,
      'deck.fredericksburg_downtown': 1,
    });
    expect(u.seen).toMatchObject({ games: ['klondike'], wonGames: ['klondike'], decks: ['fredericksburg_downtown'] });
    const loss = journalForGame(record({ outcome: 'loss', lossStreak: 2 }));
    expect(loss.set?.['streak.loss']).toBe(3);
    expect(loss.seen?.wonGames).toBeUndefined();
    const comeback = journalForGame(record({ lossStreak: 5 }));
    expect(comeback.add?.['secret.comeback']).toBe(1);
    expect(comeback.set?.['streak.loss']).toBe(0);
  });

  it('counts games per local day', () => {
    const j = applyJournal(undefined, journalForGame(record({ gamesToday: 0 })));
    expect(gamesToday(j, evening)).toBe(1);
    expect(gamesToday(j, new Date('2026-05-06T09:00:00'))).toBe(0);
  });
});

describe('unlocking', () => {
  it('unlocks each achievement once, with a date and its XP', () => {
    const p: Profile = { ...createDefaultProfile(), stats: { ...createDefaultProfile().stats } };
    p.stats.war = { ...p.stats.war, played: 1, won: 1 };
    const first = unlockEarned(p, 1_000);
    expect(first.earned).toEqual(expect.arrayContaining(['first-win', 'war-1', 'first-visit']));
    const after = { ...p, ...first.patch };
    expect(after.achievementDates['first-win']).toBe(1_000);
    expect(after.xp + after.level * 1000).toBeGreaterThan(p.xp + p.level * 1000);
    // Nothing more to pay on a second pass.
    expect(unlockEarned(after, 2_000).earned).toEqual([]);
    expect(after.unlockedAchievements.filter((id) => id === 'first-win')).toHaveLength(1);
  });

  it('cascades: XP from achievements can earn a level achievement in the same pass', () => {
    const p: Profile = { ...createDefaultProfile(), level: 4, xp: 600 };
    p.stats = { ...p.stats, klondike: { ...p.stats.klondike, played: 10, won: 10 } };
    const { earned, patch } = unlockEarned(p);
    expect(patch.level).toBeGreaterThanOrEqual(5);
    expect(earned).toContain('level-5');
  });

  it('a played game unlocks through the results pipeline, persists, and never twice', () => {
    const store = new Store();
    const r = recordGameResult(store, {
      gameId: 'freecell',
      outcome: 'win',
      durationMs: 100_000,
      details: { usedCell: false, undos: 0, hints: 0, moves: 90 },
      at: evening,
      deckId: 'classic',
      boardId: 'picnic_table',
    });
    expect(r.achievements).toEqual(
      expect.arrayContaining(['freecell-1', 'freecell-nocell', 'freecell-moves100', 'blink', 'freecell-fast3']),
    );
    const saved = JSON.parse(JSON.stringify(store.state.profile)) as Profile;
    // Reload: a new store hydrated from the saved profile keeps them and earns nothing again.
    const reloaded = new Store(reduce(createInitialState(), { type: 'HYDRATE', profile: migrateProfile(saved) }));
    expect(reloaded.state.profile.unlockedAchievements).toEqual(saved.unlockedAchievements);
    expect(reloaded.state.profile.achievementDates).toEqual(saved.achievementDates);
    expect(evaluateAchievements(reloaded)).toEqual([]);
  });

  it('collection achievements never depend on adult-only decks', () => {
    const f = buildFacts(createDefaultProfile());
    const publicDecks = allDecks().filter((d) => d.contentRating !== 'mature');
    expect(publicDecks.length).toBeLessThan(allDecks().length);
    expect(f.decksTotal).toBe(publicDecks.length);
    // Owning every public deck completes the set, whatever happens to adult decks.
    const all = { ...createDefaultProfile(), unlockedDecks: publicDecks.map((d) => d.id) } as Profile;
    expect(getAchievement('decks-all')!.progress(buildFacts(all))).toBe(1);
  });

  it('noon games count toward Lunch Break, evening games do not', () => {
    expect(journalForGame(record({ at: noon })).add?.['secret.lunch']).toBe(1);
    expect(journalForGame(record()).add?.['secret.lunch']).toBeUndefined();
  });
});
