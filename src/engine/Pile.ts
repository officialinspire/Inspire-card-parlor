import { Card, type SerializedCard } from './Card';

export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell' | 'hand' | 'pond' | 'book' | 'pile';

/** How a pile fans its cards on the table (used by the renderer). */
export type PileLayout = 'stack' | 'fan-down' | 'fan-right' | 'spread';

export interface SerializedPile {
  id: string;
  kind: PileKind;
  layout: PileLayout;
  cards: SerializedCard[];
}

/**
 * An ordered stack of cards. Index 0 is the bottom; the last card is the top.
 * Piles hold cards but no rules: games decide what may be placed where.
 */
export class Pile {
  readonly id: string;
  readonly kind: PileKind;
  layout: PileLayout;
  protected cards: Card[] = [];

  constructor(id: string, kind: PileKind = 'pile', layout: PileLayout = 'stack', cards: Card[] = []) {
    this.id = id;
    this.kind = kind;
    this.layout = layout;
    this.cards = [...cards];
  }

  get size(): number {
    return this.cards.length;
  }

  get isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /** Top card, or undefined. */
  get top(): Card | undefined {
    return this.cards.at(-1);
  }

  /** Read-only view, bottom → top. */
  get all(): readonly Card[] {
    return this.cards;
  }

  /** The top `count` cards, bottom → top, without removing them. */
  peek(count = 1): Card[] {
    return count <= 0 ? [] : this.cards.slice(-count);
  }

  at(index: number): Card | undefined {
    return this.cards.at(index);
  }

  indexOf(cardId: string): number {
    return this.cards.findIndex((c) => c.id === cardId);
  }

  has(cardId: string): boolean {
    return this.indexOf(cardId) !== -1;
  }

  /** Number of cards from `cardId` to the top (inclusive), or 0 when absent. */
  depthOf(cardId: string): number {
    const i = this.indexOf(cardId);
    return i === -1 ? 0 : this.cards.length - i;
  }

  /** Place cards on top (in the order given). */
  push(...cards: Card[]): this {
    this.cards.push(...cards);
    return this;
  }

  /** Remove and return the top card. */
  pop(): Card | undefined {
    return this.cards.pop();
  }

  /** Remove and return the top `count` cards, keeping their order (bottom → top). */
  take(count: number): Card[] {
    if (count < 0 || count > this.cards.length) {
      throw new RangeError(`Cannot take ${count} card(s) from "${this.id}" (has ${this.cards.length})`);
    }
    return count === 0 ? [] : this.cards.splice(this.cards.length - count, count);
  }

  /** Remove specific cards by id (any position). Returns them in pile order. */
  remove(ids: Iterable<string>): Card[] {
    const set = new Set(ids);
    const removed = this.cards.filter((c) => set.has(c.id));
    if (removed.length !== set.size) throw new RangeError(`Some cards are not in "${this.id}"`);
    this.cards = this.cards.filter((c) => !set.has(c.id));
    return removed;
  }

  /** Place cards underneath the pile (e.g. War winnings go to the bottom of the hand). */
  insertBottom(...cards: Card[]): this {
    this.cards.unshift(...cards);
    return this;
  }

  clear(): Card[] {
    return this.cards.splice(0);
  }

  /** Turn the top card face up (e.g. after uncovering a tableau card). Returns it if it changed. */
  revealTop(): Card | undefined {
    const top = this.top;
    if (top && !top.faceUp) {
      top.flip(true);
      return top;
    }
    return undefined;
  }

  /** Set every card's facing at once. */
  setFaceUp(faceUp: boolean): this {
    for (const c of this.cards) c.faceUp = faceUp;
    return this;
  }

  /** Reverse the pile and flip every card (e.g. recycling waste into stock). */
  turnOver(): this {
    this.cards.reverse();
    for (const c of this.cards) c.flip();
    return this;
  }

  /** Number of face-up cards on top. */
  get faceUpCount(): number {
    let n = 0;
    for (let i = this.cards.length - 1; i >= 0 && this.cards[i]!.faceUp; i--) n++;
    return n;
  }

  toJSON(): SerializedPile {
    return { id: this.id, kind: this.kind, layout: this.layout, cards: this.cards.map((c) => c.toJSON()) };
  }

  static fromJSON(data: SerializedPile): Pile {
    return new Pile(data.id, data.kind, data.layout, data.cards.map(Card.fromJSON));
  }
}
