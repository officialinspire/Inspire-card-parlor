import type { Profile } from '@/core/types';
import type { DeckDefinition } from '@/decks/types';
import type { BoardDefinition } from '@/boards/types';
import { isBoardUnlocked, isDeckUnlocked, isVariantOwned } from './levels';

export interface Tally {
  owned: number;
  total: number;
}

export interface CollectionProgress {
  decks: Tally;
  artwork: Tally;
  boards: Tally;
  owned: number;
  total: number;
  /** 0–100, rounded down so 100% means everything. */
  percent: number;
}

/**
 * Completion across decks, collectible alternate artwork and gameboards.
 * Only items the player can see count (hidden adult content is excluded).
 */
export function collectionProgress(
  profile: Profile,
  decks: DeckDefinition[],
  boards: BoardDefinition[],
): CollectionProgress {
  const deckTally = { owned: decks.filter((d) => isDeckUnlocked(d.id, profile)).length, total: decks.length };
  const variants = decks.flatMap((d) => d.variants.filter((v) => v.contentRating !== 'mature').map((v) => ({ d, v })));
  const artTally = {
    owned: variants.filter(({ d, v }) => isVariantOwned(d.id, v, profile)).length,
    total: variants.length,
  };
  const boardTally = { owned: boards.filter((b) => isBoardUnlocked(b.id, profile)).length, total: boards.length };
  const owned = deckTally.owned + artTally.owned + boardTally.owned;
  const total = deckTally.total + artTally.total + boardTally.total;
  return {
    decks: deckTally,
    artwork: artTally,
    boards: boardTally,
    owned,
    total,
    percent: total ? Math.floor((owned / total) * 100) : 0,
  };
}
