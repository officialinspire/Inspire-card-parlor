import type { DialogueLine, StorySuit, SuitPuzzle } from './types';

/**
 * The suit-order puzzle (the Chapter 8 door), as pure rules: the screen only
 * collects the player's order and shows what these functions return.
 */

export const SUITS: readonly StorySuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const SUIT_GLYPH: Record<StorySuit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_NAME: Record<StorySuit, string> = {
  spades: 'Spade',
  hearts: 'Heart',
  diamonds: 'Diamond',
  clubs: 'Club',
};

/**
 * The marks in the order the player found them (club at the river, heart at
 * Dante's, diamond at Jak's, spade at Mrs. Gray's). The picker lists them this
 * way, which is deliberately not the answer.
 */
export const FOUND_ORDER: readonly StorySuit[] = ['clubs', 'hearts', 'diamonds', 'spades'];

/** True when the order opens it: every mark used once, in the puzzle's order. */
export function checkSuitOrder(puzzle: SuitPuzzle, order: readonly StorySuit[]): boolean {
  return order.length === puzzle.answer.length && order.every((s, i) => s === puzzle.answer[i]);
}

/** The hint after the given number of wrong tries (0 = the first). The last hint repeats and gives the answer. */
export function puzzleHint(puzzle: SuitPuzzle, wrongTries: number): DialogueLine {
  return puzzle.hints[Math.min(wrongTries, puzzle.hints.length - 1)]!;
}
