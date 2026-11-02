import type { Profile } from '@/core/types';
import { STORY_CHAPTERS } from './campaign';
import { isChapterComplete } from './progress';

/**
 * Ghost rematches: opened by finishing the campaign (the epilogue's note,
 * "Best of thirteen? — G. W."). A rematch is an ordinary free-play War table
 * against a ghost, on that ghost's deck and board: no story rewards, nothing
 * recorded as campaign progress, and it uses the War engine as it is.
 */
export interface GhostRematch {
  id: string;
  title: string;
  /** CPU personality (src/games/cpu/storyOpponents.ts). */
  opponent: string;
  deckId: string;
  boardId: string;
  blurb: string;
}

export const GHOST_REMATCHES: readonly GhostRematch[] = [
  {
    id: 'rematch-george',
    title: 'Best of Thirteen',
    opponent: 'george_washington',
    deckId: 'washington_ghost',
    boardId: 'washington_final_table',
    blurb: 'George Washington’s ghost would like a rematch. And another one after that.',
  },
  {
    id: 'rematch-mary',
    title: 'A Mother’s Rematch',
    opponent: 'mary_ball_washington',
    deckId: 'fredericksburg',
    boardId: 'kenmore_parlor',
    blurb: 'Mary Ball Washington’s ghost, at her daughter’s card table. Sit up straight.',
  },
];

/** The whole campaign is finished: every challenge of all nine chapters. */
export const isCampaignComplete = (profile: Profile) => STORY_CHAPTERS.every((c) => isChapterComplete(profile, c));

/** Rematches open with the end of the story. */
export const rematchesUnlocked = isCampaignComplete;

/** Ghost opponents the War table offers in free play (only once the story is finished). */
export const unlockedGhostOpponents = (profile: Profile): string[] =>
  rematchesUnlocked(profile) ? GHOST_REMATCHES.map((r) => r.opponent) : [];
