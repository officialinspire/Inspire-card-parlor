import { Hand, Table, compareAceHigh, fisherYates, type Card } from '@/engine';
import { setupWar } from '../setups';

/*
 * WAR — rules as implemented
 *
 * 1. A standard 52-card deck is shuffled and dealt evenly: 26 cards each, face down.
 * 2. Each round both players turn over their top card. The higher rank wins
 *    (Ace high; suits do not matter). The winner takes every card in play.
 * 3. A tie starts a War: each player puts up to three cards face down, then turns
 *    one more face up. The higher face-up card takes everything; another tie repeats.
 * 4. Short of cards: a player who cannot put down three face-down cards puts down
 *    all but their last card and turns that last card face up. A player with no card
 *    left to turn over when one is needed loses the game.
 * 5. Won cards are shuffled and placed at the bottom of the winner's pile. (Shuffling
 *    the winnings guarantees a game cannot loop forever.)
 * 6. A player wins when they own all 52 cards. If both players run out during the
 *    same War, the game is a draw.
 */

export type WarSide = 'player' | 'cpu';
export type WarStatus = 'playing' | 'won' | 'lost' | 'draw';

export interface WarBattle {
  player: Card;
  cpu: Card;
  /** Face-down cards each side put in before this battle (empty for the opening flip). */
  faceDown: Record<WarSide, Card[]>;
}

export interface WarRound {
  round: number;
  battles: WarBattle[];
  /** Round winner; null only when the game ends in a draw. */
  winner: WarSide | null;
  pot: Card[];
  /** Set when a side ran out of cards during a War. */
  outOfCards?: WarSide;
  status: WarStatus;
}

export interface WarData {
  [key: string]: unknown;
  opponentId: string;
  round: number;
  wars: number;
  warsLost: number;
  status: WarStatus;
  startedAt: number;
}

const SIDES: WarSide[] = ['player', 'cpu'];

export class WarGame {
  readonly table: Table;

  constructor(table: Table) {
    if (table.gameId !== 'war') throw new Error('Not a War table');
    this.table = table;
  }

  static create(opts: { seed?: number; opponentId?: string } = {}): WarGame {
    const table = setupWar({ ...(opts.seed !== undefined ? { seed: opts.seed } : {}), players: SIDES });
    const data: WarData = {
      opponentId: opts.opponentId ?? 'jak_gold',
      round: 0,
      wars: 0,
      warsLost: 0,
      status: 'playing',
      startedAt: Date.now(),
    };
    table.data = data;
    return new WarGame(table);
  }

  get data(): WarData {
    return this.table.data as WarData;
  }

  hand(side: WarSide): Hand {
    return this.table.pile<Hand>(`hand:${side}`);
  }

  count(side: WarSide): number {
    return this.hand(side).size;
  }

  get status(): WarStatus {
    return this.data.status;
  }

  get isOver(): boolean {
    return this.data.status !== 'playing';
  }

  /** Turn over the top card of a pile. */
  #flip(side: WarSide): Card {
    const [card] = this.hand(side).take(1);
    return card!.flip(true);
  }

  playRound(): WarRound {
    if (this.isOver) throw new Error('The game is over');
    const d = this.data;
    d.round++;
    const pot: Card[] = [];
    const battles: WarBattle[] = [];
    let faceDown: Record<WarSide, Card[]> = { player: [], cpu: [] };
    let winner: WarSide | null = null;
    let outOfCards: WarSide | undefined;

    for (;;) {
      const battle: WarBattle = { player: this.#flip('player'), cpu: this.#flip('cpu'), faceDown };
      battles.push(battle);
      pot.push(...faceDown.player, ...faceDown.cpu, battle.player, battle.cpu);
      const cmp = compareAceHigh(battle.player, battle.cpu);
      if (cmp !== 0) {
        winner = cmp > 0 ? 'player' : 'cpu';
        break;
      }

      // Tie: War.
      d.wars++;
      const p = this.count('player');
      const c = this.count('cpu');
      if (p === 0 && c === 0) break; // both out: draw
      if (p === 0 || c === 0) {
        outOfCards = p === 0 ? 'player' : 'cpu';
        winner = p === 0 ? 'cpu' : 'player';
        break;
      }
      faceDown = {
        player: this.hand('player')
          .take(Math.min(3, p - 1))
          .reverse(),
        cpu: this.hand('cpu')
          .take(Math.min(3, c - 1))
          .reverse(),
      };
    }

    if (battles.length > 1 && winner === 'cpu') d.warsLost += battles.length - 1;

    if (winner) {
      const winnings = fisherYates([...pot], this.table.random).map((card) => card.flip(false));
      this.hand(winner).insertBottom(...winnings);
      const loser: WarSide = winner === 'player' ? 'cpu' : 'player';
      if (this.count(loser) === 0) d.status = winner === 'player' ? 'won' : 'lost';
    } else {
      // Draw: split the pot back so both piles stay valid for display.
      d.status = 'draw';
      pot.forEach((card, i) => this.hand(SIDES[i % 2]!).insertBottom(card.flip(false)));
    }

    return { round: d.round, battles, winner, pot, ...(outOfCards ? { outOfCards } : {}), status: d.status };
  }

  static restore(table: Table): WarGame {
    return new WarGame(table);
  }
}
