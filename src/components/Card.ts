import { cardRenderer, deckThemes } from '@/decks';
import type { DeckDefinition } from '@/decks/types';
import type { PreviewContext } from '@/decks/DeckThemeManager';
import { cardCode, RANKS, type Rank, type Suit as EngineSuit } from '@/engine/Card';

/** Suit symbols used by menu screens; mapped onto engine suits. */
export type Suit = '♠' | '♥' | '♦' | '♣';
export const SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];
export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

const SUIT_OF: Record<Suit, EngineSuit> = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const rankOf = (label: string) => RANKS[RANK_LABELS.indexOf(label as (typeof RANK_LABELS)[number])] as Rank;

/**
 * Card back for menus and previews. In ordinary previews, adult-themed decks
 * show a neutral cover instead of their artwork.
 */
export function cardBack(deck: DeckDefinition, extraClass = '', context: PreviewContext = 'ordinary'): HTMLElement {
  return cardRenderer.renderBack(deckThemes.resolve(deck.id), {
    className: extraClass,
    cover: !deckThemes.canShowArt(deck.id, context),
  });
}

export function cardFace(
  deck: DeckDefinition,
  rank: string,
  suit: Suit,
  extraClass = '',
  context: PreviewContext = 'ordinary',
): HTMLElement {
  if (!deckThemes.canShowArt(deck.id, context)) return cardBack(deck, extraClass, context);
  return cardRenderer.renderFace(deckThemes.resolve(deck.id), cardCode(rankOf(rank), SUIT_OF[suit]), {
    className: extraClass,
  });
}
