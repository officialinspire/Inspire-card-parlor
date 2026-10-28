import { Table, ascendingSameSuit, descendingAlternating, isSequence, type Card, type Pile } from '@/engine';
import { setupKlondike } from '../setups';
import { SolitaireGame, bestOf, initSolitaireData, type Hint } from './SolitaireGame';

/*
 * KLONDIKE — rules as implemented
 * · 28 cards in seven columns (1…7), top card of each face up; 24 in the stock.
 * · Tap the stock to turn 1 or 3 cards onto the waste (Draw 1 / Draw 3). Only the
 *   top waste card can be played. An empty stock recycles the waste, unlimited times.
 * · Tableau builds down in alternating colours. Any face-up run that follows that rule
 *   moves together. Only a King (or a run starting with a King) may fill an empty column.
 * · Foundations build up by suit from Ace to King. The top foundation card may be
 *   moved back onto the tableau (not to another foundation).
 * · A face-down card left on top of a column is turned up automatically.
 * · Won when all 52 cards are on the foundations. Once the stock and waste are empty
 *   and every card is face up, Auto-finish plays the rest.
 * Scoring (Windows-style): waste→tableau +5, to foundation +10, turning a card up +5,
 * foundation→tableau −15.
 */

export type DrawCount = 1 | 3;

export class KlondikeGame extends SolitaireGame {
  static create(opts: { seed?: number; draw?: DrawCount } = {}): KlondikeGame {
    const table = setupKlondike({ ...(opts.seed !== undefined ? { seed: opts.seed } : {}), drawCount: opts.draw ?? 1 });
    initSolitaireData(table, { draw: opts.draw ?? 1, passes: 0 });
    return new KlondikeGame(table);
  }

  static restore(table: Table): KlondikeGame {
    return new KlondikeGame(table);
  }

  get draw(): DrawCount {
    return (this.data.draw as DrawCount) ?? 1;
  }

  get stock(): Pile {
    return this.pile('stock');
  }

  get waste(): Pile {
    return this.pile('waste');
  }

  canPick(pile: Pile, index: number): boolean {
    const card = pile.at(index);
    if (!card?.faceUp) return false;
    switch (pile.kind) {
      case 'tableau':
        return isSequence(pile.all.slice(index), descendingAlternating);
      case 'waste':
      case 'foundation':
        return index === pile.size - 1;
      default:
        return false;
    }
  }

  canDrop(cards: readonly Card[], from: Pile, to: Pile): boolean {
    const first = cards[0]!;
    if (to.kind === 'tableau') {
      if (to.isEmpty) return first.rank === 13;
      const top = to.top!;
      return top.faceUp && descendingAlternating(top, first);
    }
    if (to.kind === 'foundation') {
      if (cards.length !== 1 || from.kind === 'foundation') return false;
      return to.isEmpty ? first.rank === 1 : ascendingSameSuit(to.top!, first);
    }
    return false;
  }

  protected override moveScore(from: Pile, to: Pile): number {
    if (to.kind === 'foundation') return 10;
    if (from.kind === 'waste' && to.kind === 'tableau') return 5;
    if (from.kind === 'foundation' && to.kind === 'tableau') return -15;
    return 0;
  }

  protected override revealScore(): number {
    return 5;
  }

  /** Turn cards from the stock (or recycle the waste when the stock is empty). */
  stockAction(): boolean {
    if (this.data.won) return false;
    if (!this.stock.isEmpty) {
      const n = Math.min(this.draw, this.stock.size);
      this.action(() => {
        for (let i = 0; i < n; i++) this.table.move('stock', 'waste', 1, { faceUp: true });
        return 0;
      });
      return true;
    }
    if (!this.waste.isEmpty) {
      const n = this.waste.size;
      this.action(() => {
        // One card at a time reverses the order, so the first card drawn is on top again.
        for (let i = 0; i < n; i++) this.table.move('waste', 'stock', 1, { faceUp: false });
        return 0;
      });
      this.data.passes = Number(this.data.passes) + 1;
      return true;
    }
    return false;
  }

  get isWon(): boolean {
    return this.foundations.reduce((n, f) => n + f.size, 0) === 52;
  }

  /** Stock and waste empty and every tableau card face up: the rest can be played automatically. */
  get canAutoFinish(): boolean {
    return (
      !this.data.won &&
      this.stock.isEmpty &&
      this.waste.isEmpty &&
      this.tableau.every((p) => p.all.every((c) => c.faceUp))
    );
  }

  /** Plays one card to a foundation (lowest rank first). Returns false when stuck or done. */
  autoFinishStep(): boolean {
    const candidates = this.tableau
      .filter((p) => !p.isEmpty)
      .map((p) => ({ p, card: p.top! }))
      .sort((a, b) => a.card.rank - b.card.rank);
    for (const { p } of candidates) {
      for (const f of this.foundations) {
        if (this.move({ from: p.id, index: p.size - 1, to: f.id })) return true;
      }
    }
    return false;
  }

  hint(): Hint | null {
    const best = bestOf(this.legalMoves(), (m) => {
      const from = this.pile(m.from);
      const to = this.pile(m.to);
      const card = from.at(m.index)!;
      if (to.kind === 'foundation') return 100 - card.rank;
      if (from.kind === 'foundation') return 0;
      if (from.kind === 'waste') return 50;
      // tableau → tableau
      const below = from.at(m.index - 1);
      if (below && !below.faceUp) return 80; // turns a card up
      if (!below) return 0; // moving a whole column (King to an empty column) gains nothing
      // Exposes a card that can go up to a foundation.
      if (this.foundations.some((f) => this.canDrop([below], from, f))) return 60;
      return 0;
    });
    if (best) return { kind: 'move', ...best };
    if (!this.stock.isEmpty || !this.waste.isEmpty) return { kind: 'stock' };
    return null;
  }
}
