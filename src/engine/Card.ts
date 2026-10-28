/** Suits in their canonical order (also the default sprite-sheet row order). */
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

/** Ace = 1 … King = 13. */
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_CODE: Record<Suit, string> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' };
export const SUIT_SYMBOL: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const RANK_CODE: Record<Rank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};
const RANK_NAME: Record<Rank, string> = {
  1: 'Ace',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
};

/** Asset code for a card face, e.g. "AS", "10H", "KD". Identical across decks and artwork. */
export type CardCode =
  `${'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'}${'S' | 'H' | 'D' | 'C'}`;

export const cardCode = (rank: Rank, suit: Suit) => `${RANK_CODE[rank]}${SUIT_CODE[suit]}` as CardCode;

/** All 52 face codes of a standard deck, suit-major (♠A…♠K, ♥A…). */
export const ALL_CARD_CODES: readonly CardCode[] = SUITS.flatMap((s) => RANKS.map((r) => cardCode(r, s)));

export function parseCardCode(code: string): { rank: Rank; suit: Suit } | null {
  const m = /^(A|[2-9]|10|J|Q|K)([SHDC])$/.exec(code);
  if (!m) return null;
  const rank = (Object.entries(RANK_CODE).find(([, c]) => c === m[1])![0] as unknown as number) * 1;
  const suit = SUITS.find((s) => SUIT_CODE[s] === m[2])!;
  return { rank: rank as Rank, suit };
}

export interface SerializedCard {
  /** Unique id within a game, e.g. "1:QH" (deck copy 1, queen of hearts). */
  id: string;
  r: Rank;
  s: Suit;
  up: boolean;
}

/**
 * One physical card. Identity (`id`) is unique even when several decks are
 * in play (Spider uses two), so moves, saves and animations can track it.
 * Rules and artwork never live on the card: alternate art changes how a card
 * looks, never what it is.
 */
export class Card {
  readonly id: string;
  readonly rank: Rank;
  readonly suit: Suit;
  /** Which copy of the deck this card came from (0-based). */
  readonly copy: number;
  faceUp: boolean;

  constructor(rank: Rank, suit: Suit, copy = 0, faceUp = false, id?: string) {
    if (!RANKS.includes(rank)) throw new RangeError(`Invalid rank: ${rank}`);
    if (!SUITS.includes(suit)) throw new RangeError(`Invalid suit: ${suit}`);
    this.rank = rank;
    this.suit = suit;
    this.copy = copy;
    this.faceUp = faceUp;
    this.id = id ?? `${copy}:${cardCode(rank, suit)}`;
  }

  get code(): CardCode {
    return cardCode(this.rank, this.suit);
  }

  get color(): 'red' | 'black' {
    return this.suit === 'hearts' || this.suit === 'diamonds' ? 'red' : 'black';
  }

  get label(): string {
    return `${RANK_NAME[this.rank]} of ${this.suit[0]!.toUpperCase()}${this.suit.slice(1)}`;
  }

  get shortLabel(): string {
    return `${RANK_CODE[this.rank]}${SUIT_SYMBOL[this.suit]}`;
  }

  flip(faceUp = !this.faceUp): this {
    this.faceUp = faceUp;
    return this;
  }

  toJSON(): SerializedCard {
    return { id: this.id, r: this.rank, s: this.suit, up: this.faceUp };
  }

  static fromJSON(data: SerializedCard): Card {
    const copy = Number.parseInt(data.id.split(':')[0] ?? '0', 10) || 0;
    return new Card(data.r, data.s, copy, data.up, data.id);
  }
}
