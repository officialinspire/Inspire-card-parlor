import {
  Table,
  descendingAnySuit,
  descendingSameSuit,
  isCompleteRun,
  isSequence,
  type Card,
  type Pile,
} from '@/engine';
import { setupSpider } from '../setups';
import { SolitaireGame, bestOf, initSolitaireData, type Hint } from './SolitaireGame';

/*
 * SPIDER — rules as implemented
 * · Two decks (104 cards). One-suit mode uses 8 runs of spades, two-suit 4 spades +
 *   4 hearts, four-suit two full decks.
 * · Ten columns: 54 cards (6,6,6,6,5,5,5,5,5,5), only the top card face up; 50 in the stock.
 * · Any card may be placed on a card one rank higher, of any suit. A group of cards can
 *   only be moved together when it is a descending run of one suit.
 * · Any card or same-suit run may go into an empty column.
 * · Dealing puts one face-up card on every column. You cannot deal while a column is empty.
 * · A complete King→Ace run of one suit is removed to the foundations at once
 *   (after a move or a deal). A face-down card left on top is turned up.
 * · Won when all eight runs are complete.
 * Scoring: start at 500, −1 per move or deal, +100 per completed run.
 */

export type SpiderSuits = 1 | 2 | 4;
export type DealBlock = 'empty-column' | 'empty-stock' | null;

export class SpiderGame extends SolitaireGame {
  lastDealBlock: DealBlock = null;

  static create(opts: { seed?: number; suits?: SpiderSuits } = {}): SpiderGame {
    const table = setupSpider({ ...(opts.seed !== undefined ? { seed: opts.seed } : {}), suits: opts.suits ?? 1 });
    initSolitaireData(table, { suits: opts.suits ?? 1 }, 500);
    return new SpiderGame(table);
  }

  static restore(table: Table): SpiderGame {
    return new SpiderGame(table);
  }

  get suits(): SpiderSuits {
    return (this.data.suits as SpiderSuits) ?? 1;
  }

  get stock(): Pile {
    return this.pile('stock');
  }

  get completedRuns(): number {
    return this.foundations.filter((f) => !f.isEmpty).length;
  }

  canPick(pile: Pile, index: number): boolean {
    if (pile.kind !== 'tableau') return false;
    const card = pile.at(index);
    return !!card?.faceUp && isSequence(pile.all.slice(index), descendingSameSuit);
  }

  canDrop(cards: readonly Card[], _from: Pile, to: Pile): boolean {
    if (to.kind !== 'tableau') return false;
    if (to.isEmpty) return true;
    const top = to.top!;
    return top.faceUp && descendingAnySuit(top, cards[0]!);
  }

  protected override moveScore(): number {
    return -1;
  }

  /** Removes a finished King→Ace run from the top of `pile`. Returns the score for it. */
  protected override afterMove(pile: Pile): number {
    if (pile.size < 13) return 0;
    const run = pile.peek(13);
    if (!isCompleteRun(run)) return 0;
    const slot = this.foundations.find((f) => f.isEmpty);
    if (!slot) return 0;
    this.table.move(pile.id, slot.id, 13, { revealSource: true });
    return 100;
  }

  /** Deals one card to every column. */
  stockAction(): boolean {
    this.lastDealBlock = null;
    if (this.data.won) return false;
    if (this.stock.isEmpty) {
      this.lastDealBlock = 'empty-stock';
      return false;
    }
    if (this.tableau.some((p) => p.isEmpty)) {
      this.lastDealBlock = 'empty-column';
      return false;
    }
    this.action(() => {
      for (const p of this.tableau) this.table.move('stock', p.id, 1, { faceUp: true });
      let score = -1;
      for (const p of this.tableau) score += this.afterMove(p);
      return score;
    });
    return true;
  }

  get isWon(): boolean {
    return this.completedRuns === 8;
  }

  hint(): Hint | null {
    const best = bestOf(this.legalMoves(), (m) => {
      const from = this.pile(m.from);
      const to = this.pile(m.to);
      const card = from.at(m.index)!;
      const below = from.at(m.index - 1);
      let score = 5;
      if (below && !below.faceUp) score += 60; // turns a card up
      if (!to.isEmpty && to.top!.suit === card.suit) score += 40; // builds a suit run
      if (to.isEmpty) score -= below ? 10 : 100; // moving a whole column to an empty one is pointless
      // Splitting a same-suit run or shuffling between equal spots gains nothing.
      if (below?.faceUp && descendingAnySuit(below, card)) {
        if (below.suit === card.suit) score -= 100;
        else if (to.isEmpty || to.top!.suit !== card.suit) score -= 100;
      }
      return score;
    });
    if (best) return { kind: 'move', ...best };
    if (!this.stock.isEmpty && !this.tableau.some((p) => p.isEmpty)) return { kind: 'stock' };
    return null;
  }
}
