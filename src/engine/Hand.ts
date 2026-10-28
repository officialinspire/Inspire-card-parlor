import { Card, RANK_CODE, type Rank, type Suit, SUITS } from './Card';
import { Pile, type SerializedPile } from './Pile';

/**
 * A player's hand (War, Go Fish). Order is the player's arrangement; helpers
 * cover asking for ranks and laying down books of four.
 */
export class Hand extends Pile {
  readonly owner: string;

  constructor(owner: string, cards: Card[] = [], id = `hand:${owner}`) {
    super(id, 'hand', 'fan-right', cards);
    this.owner = owner;
  }

  ranks(): Rank[] {
    return [...new Set(this.cards.map((c) => c.rank))];
  }

  countRank(rank: Rank): number {
    return this.cards.filter((c) => c.rank === rank).length;
  }

  hasRank(rank: Rank): boolean {
    return this.cards.some((c) => c.rank === rank);
  }

  /** Remove and return every card of a rank ("Got any sevens?"). */
  takeRank(rank: Rank): Card[] {
    return this.remove(this.cards.filter((c) => c.rank === rank).map((c) => c.id));
  }

  /** Remove complete sets of `size` same-rank cards and return them grouped. */
  extractBooks(size = 4): Card[][] {
    const books: Card[][] = [];
    for (const rank of this.ranks()) {
      while (this.countRank(rank) >= size) {
        const ids = this.cards
          .filter((c) => c.rank === rank)
          .slice(0, size)
          .map((c) => c.id);
        books.push(this.remove(ids));
      }
    }
    return books;
  }

  /** Sort by rank, then suit (Ace low). */
  sort(): this {
    this.cards.sort((a, b) => a.rank - b.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
    return this;
  }

  describe(): string {
    return this.cards.map((c) => `${RANK_CODE[c.rank]}${c.suit[0]}`).join(' ');
  }

  hasCard(rank: Rank, suit: Suit): boolean {
    return this.cards.some((c) => c.rank === rank && c.suit === suit);
  }

  override toJSON(): SerializedPile & { owner: string } {
    return { ...super.toJSON(), owner: this.owner };
  }

  static override fromJSON(data: SerializedPile & { owner?: string }): Hand {
    return new Hand(data.owner ?? data.id.replace(/^hand:/, ''), data.cards.map(Card.fromJSON), data.id);
  }
}
