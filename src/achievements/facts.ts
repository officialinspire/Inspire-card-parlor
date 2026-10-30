import type { GameId, Profile } from '@/core/types';
import { GAME_IDS } from '@/core/defaults';
import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';
import { collectionProgress } from '@/progression/collection';
import { isBoardUnlocked, isDeckUnlocked, isVariantOwned } from '@/progression/levels';
import { STORY_CHAPTERS } from '@/story/campaign';
import { isChapterComplete, storyOf } from '@/story/progress';
import { emptyJournal } from './journal';

/**
 * A read-only view of a profile in the terms achievements use. Built once
 * per evaluation; every achievement's progress is a number read from it.
 * Collection counts leave adult-only decks out, so no achievement ever
 * depends on mature content.
 */
export interface Facts {
  profile: Profile;
  /** Journal counter (0 when unset). */
  c(key: string): number;
  /** Size of a journal "seen" set. */
  n(key: string): number;
  has(set: string, value: string): boolean;
  won(game?: GameId): number;
  played(game?: GameId): number;
  /** Longest win streak (in one game, or the best of all). */
  streak(game?: GameId): number;
  /** Fastest win in seconds (Infinity if none). */
  fastest(game: GameId): number;
  level: number;
  storyCleared: number;
  chaptersComplete: number;
  chapterDone(index: number): boolean;
  firstTryClears: number;
  decksOwned: number;
  decksTotal: number;
  boardsOwned: number;
  boardsTotal: number;
  variantsOwned: number;
  variantsTotal: number;
  collectionPercent: number;
  favorites: number;
}

export function buildFacts(profile: Profile): Facts {
  const j = profile.journal ?? emptyJournal();
  const stats = profile.stats;
  const games = (g?: GameId) => (g ? [g] : GAME_IDS);
  const story = storyOf(profile);
  const decks = allDecks().filter((d) => d.contentRating !== 'mature');
  const variants = decks.flatMap((d) => d.variants.filter((v) => v.contentRating !== 'mature').map((v) => ({ d, v })));
  const boards = allBoards();
  return {
    profile,
    c: (k) => j.counters[k] ?? 0,
    n: (k) => j.seen[k]?.length ?? 0,
    has: (set, v) => !!j.seen[set]?.includes(v),
    won: (g) => games(g).reduce((n, id) => n + (stats[id]?.won ?? 0), 0),
    played: (g) => games(g).reduce((n, id) => n + (stats[id]?.played ?? 0), 0),
    streak: (g) => Math.max(0, ...games(g).map((id) => stats[id]?.longestStreak ?? 0)),
    fastest: (g) => (stats[g]?.bestTimeMs != null && stats[g].won > 0 ? stats[g].bestTimeMs! / 1000 : Infinity),
    level: profile.level,
    storyCleared: story.completed.length,
    chaptersComplete: STORY_CHAPTERS.filter((c) => isChapterComplete(profile, c)).length,
    chapterDone: (i) => {
      const ch = STORY_CHAPTERS.find((c) => c.index === i);
      return !!ch && isChapterComplete(profile, ch);
    },
    firstTryClears: story.completed.filter((id) => story.attempts[id] === 1).length,
    decksOwned: decks.filter((d) => isDeckUnlocked(d.id, profile)).length,
    decksTotal: decks.length,
    boardsOwned: boards.filter((b) => isBoardUnlocked(b.id, profile)).length,
    boardsTotal: boards.length,
    variantsOwned: variants.filter(({ d, v }) => isVariantOwned(d.id, v, profile)).length,
    variantsTotal: variants.length,
    collectionPercent: collectionProgress(profile, decks, boards).percent,
    favorites: profile.favoriteDecks.length,
  };
}
