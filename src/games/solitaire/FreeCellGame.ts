import {
  Table,
  ascendingSameSuit,
  descendingAlternating,
  isSequence,
  maxSupermove,
  type Card,
  type Pile,
} from '@/engine';
import { setupFreeCell } from '../setups';
import { SolitaireGame, bestOf, initSolitaireData, type Hint } from './SolitaireGame';

/*
 * FREECELL — rules as implemented
 * · All 52 cards dealt face up into eight columns (7,7,7,7,6,6,6,6).
 * · Four free cells hold one card each. Four foundations build up by suit, Ace to King.
 *   Cards on foundations stay there.
 * · Tableau builds down in alternating colours; any card may go into an empty column.
 * · Multi-card moves: a run may move together if it follows the building rule and its
 *   length is at most (empty free cells + 1) × 2^(empty columns). An empty destination
 *   column does not count towards that capacity.
 * · Won when all 52 cards are on the foundations.
 * Scoring: +10 for each card to a foundation.
 */

export class FreeCellGame extends SolitaireGame {
  static create(opts: { seed?: number } = {}): FreeCellGame {
    const table = setupFreeCell({ ...(opts.seed !== undefined ? { seed: opts.seed } : {}) });
    initSolitaireData(table, { usedCell: false });
    return new FreeCellGame(table);
  }

  static restore(table: Table): FreeCellGame {
    return new FreeCellGame(table);
  }

  get cells(): Pile[] {
    return this.table.group('cell:');
  }

  /** How many cards may move together onto `to`. */
  capacity(to: Pile): number {
    const freeCells = this.cells.filter((c) => c.isEmpty).length;
    const emptyColumns = this.tableau.filter((p) => p.isEmpty && p !== to).length;
    return maxSupermove(freeCells, emptyColumns);
  }

  canPick(pile: Pile, index: number): boolean {
    const card = pile.at(index);
    if (!card?.faceUp) return false;
    if (pile.kind === 'cell') return index === 0;
    if (pile.kind !== 'tableau') return false;
    const run = pile.all.slice(index);
    return isSequence(run, descendingAlternating) && run.length <= this.capacity(pile);
  }

  canDrop(cards: readonly Card[], _from: Pile, to: Pile): boolean {
    const first = cards[0]!;
    switch (to.kind) {
      case 'cell':
        return cards.length === 1 && to.isEmpty;
      case 'foundation':
        return cards.length === 1 && (to.isEmpty ? first.rank === 1 : ascendingSameSuit(to.top!, first));
      case 'tableau':
        if (cards.length > this.capacity(to)) return false;
        return to.isEmpty || descendingAlternating(to.top!, first);
      default:
        return false;
    }
  }

  protected override moveScore(_from: Pile, to: Pile): number {
    if (to.kind === 'cell') this.data.usedCell = true;
    return to.kind === 'foundation' ? 10 : 0;
  }

  stockAction(): boolean {
    return false; // FreeCell has no stock
  }

  get isWon(): boolean {
    return this.foundations.reduce((n, f) => n + f.size, 0) === 52;
  }

  hint(): Hint | null {
    const best = bestOf(this.legalMoves(), (m) => {
      const from = this.pile(m.from);
      const to = this.pile(m.to);
      const card = from.at(m.index)!;
      const below = from.at(m.index - 1);
      const exposesFoundationCard = !!below && this.foundations.some((f) => this.canDrop([below], from, f));
      if (to.kind === 'foundation') return 100 - card.rank;
      if (to.kind === 'cell') return exposesFoundationCard ? 50 : 0;
      if (from.kind === 'cell') return to.isEmpty ? 15 : 40;
      // tableau → tableau
      if (below && descendingAlternating(below, card)) return 0; // would split a built run
      if (to.isEmpty) return below ? (exposesFoundationCard ? 45 : 8) : 0;
      return exposesFoundationCard ? 70 : 30;
    });
    return best ? { kind: 'move', ...best } : null;
  }

  /** Safe auto-play target: a top card that can go to a foundation. */
  foundationTarget(from: Pile): string | null {
    const card = from.top;
    if (!card) return null;
    return this.foundations.find((f) => this.canDrop([card], from, f))?.id ?? null;
  }
}
