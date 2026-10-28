import { Card, RANKS, SUITS, type Rank, type SerializedCard, type Suit } from './Card';
import { Pile } from './Pile';
import { fisherYates, Random } from './random';

export interface DeckComposition {
  /** Full copies of the suit set (Spider: 2 for four suits, 8 for one suit). */
  copies?: number;
  suits?: readonly Suit[];
  ranks?: readonly Rank[];
}

export interface DealOptions {
  faceUp?: boolean;
  /** Turn just the last card dealt to each pile face up (Klondike/Spider). */
  revealLast?: boolean;
}

/**
 * The draw pile a game starts from. Composition is independent of artwork,
 * so any deck theme (or alternate art) renders the same cards.
 */
export class Deck extends Pile {
  constructor(cards: Card[] = []) {
    super('deck', 'stock', 'stack', cards);
  }

  /** A standard 52-card deck (or several, for multi-deck games). */
  static standard(opts: DeckComposition = {}): Deck {
    const { copies = 1, suits = SUITS, ranks = RANKS } = opts;
    const cards: Card[] = [];
    for (let copy = 0; copy < copies; copy++) {
      for (const suit of suits) for (const rank of ranks) cards.push(new Card(rank, suit, copy));
    }
    return new Deck(cards);
  }

  /**
   * Spider's 104 cards: always 8 suit-runs of 13, built from 1, 2 or 4 suits.
   * (1 suit → 8× spades; 2 suits → 4× spades + 4× hearts; 4 suits → 2 full decks.)
   */
  static spider(suitCount: 1 | 2 | 4 = 4): Deck {
    const suits = suitCount === 1 ? (['spades'] as const) : suitCount === 2 ? (['spades', 'hearts'] as const) : SUITS;
    return Deck.standard({ copies: 8 / suits.length, suits });
  }

  /** Fisher–Yates shuffle in place. Pass a seeded Random for reproducible deals. */
  shuffle(random: Random = new Random()): this {
    fisherYates(this.cards, random);
    return this;
  }

  /** Draw from the top. Returns fewer cards if the deck runs out. */
  draw(count = 1, faceUp = false): Card[] {
    const cards = this.take(Math.min(count, this.size)).reverse();
    for (const c of cards) c.faceUp = faceUp;
    return cards;
  }

  /**
   * Deal round-robin, one card at a time, like a dealer at the table.
   * `counts[i]` is how many cards pile i receives; piles that are full are skipped.
   */
  deal(piles: Pile[], counts: number | number[], opts: DealOptions = {}): void {
    const target = piles.map((_, i) => (Array.isArray(counts) ? (counts[i] ?? 0) : counts));
    const needed = target.reduce((a, b) => a + b, 0);
    if (needed > this.size) throw new RangeError(`Deal needs ${needed} cards, deck has ${this.size}`);
    const dealt = piles.map(() => 0);
    while (dealt.some((n, i) => n < target[i]!)) {
      piles.forEach((pile, i) => {
        if (dealt[i]! >= target[i]!) return;
        const [card] = this.draw(1, !!opts.faceUp);
        pile.push(card!);
        dealt[i]!++;
      });
    }
    if (opts.revealLast) for (const p of piles) p.revealTop();
  }

  static fromCards(cards: SerializedCard[]): Deck {
    return new Deck(cards.map(Card.fromJSON));
  }
}
