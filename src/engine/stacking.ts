import type { Card, Rank } from './Card';

/**
 * Stacking predicates shared by the solitaire games. They only describe card
 * relationships; each game composes them into its own rules.
 */

/** `upper` may sit on `lower` in a descending, alternating-colour build (Klondike, FreeCell tableau). */
export const descendingAlternating = (lower: Card, upper: Card) =>
  lower.rank === upper.rank + 1 && lower.color !== upper.color;

/** `upper` may sit on `lower` in a descending build of any suit (Spider placement). */
export const descendingAnySuit = (lower: Card, upper: Card) => lower.rank === upper.rank + 1;

/** `upper` may sit on `lower` in a descending same-suit build (Spider runs). */
export const descendingSameSuit = (lower: Card, upper: Card) =>
  lower.rank === upper.rank + 1 && lower.suit === upper.suit;

/** `upper` may sit on `lower` on a foundation: same suit, one higher. */
export const ascendingSameSuit = (lower: Card, upper: Card) =>
  lower.rank + 1 === upper.rank && lower.suit === upper.suit;

/** True when every adjacent pair satisfies `link` and all cards are face up. */
export function isSequence(cards: readonly Card[], link: (lower: Card, upper: Card) => boolean): boolean {
  if (!cards.every((c) => c.faceUp)) return false;
  for (let i = 1; i < cards.length; i++) if (!link(cards[i - 1]!, cards[i]!)) return false;
  return true;
}

/** Length of the longest valid run at the top of `cards`. */
export function topRunLength(cards: readonly Card[], link: (lower: Card, upper: Card) => boolean): number {
  let n = 0;
  for (let i = cards.length - 1; i >= 0 && cards[i]!.faceUp; i--) {
    if (n > 0 && !link(cards[i]!, cards[i + 1]!)) break;
    n++;
  }
  return n;
}

/** A complete King→Ace same-suit run (Spider clears these). */
export function isCompleteRun(cards: readonly Card[]): boolean {
  return cards.length === 13 && cards[0]!.rank === 13 && isSequence(cards, descendingSameSuit);
}

/** War comparison with Ace high. Positive when `a` beats `b`. */
export const compareAceHigh = (a: Card, b: Card) => aceHigh(a.rank) - aceHigh(b.rank);
const aceHigh = (r: Rank) => (r === 1 ? 14 : r);

/** FreeCell's supermove limit: (free cells + 1) × 2^(empty columns). */
export const maxSupermove = (freeCells: number, emptyColumns: number) => (freeCells + 1) * 2 ** emptyColumns;
