import { Hand, Pile, Table, RANKS, type Card, type Rank } from '@/engine';
import { setupGoFish } from '../setups';

/*
 * GO FISH — rules as implemented (applied identically to people and CPUs)
 *
 * Setup   2–4 players. Seven cards each with 2–3 players, five each with 4.
 *         The rest form the stock ("pond"). Any four of a kind dealt is laid
 *         down as a book at once.
 * Asking  On your turn, ask one opponent who has cards for a rank you hold.
 * Success If they hold that rank they hand over every card of it, and you ask again.
 * Go Fish If they have none, you draw the top card of the stock.
 *         · Drawing the rank you asked for: show it and ask again.
 *         · Any other card: keep it; your turn ends.
 * Books   Whenever you hold all four cards of a rank you lay them down at once.
 * Empty   If your hand is empty when you need to ask, draw one card from the stock and
 *  hand   carry on. If the stock is empty too, you are out of cards and your turns are
 *         skipped from then on.
 * No one  If you hold cards but every opponent's hand is empty, draw one card from
 *  to ask the stock instead of asking; your turn ends.
 * Empty   When you go fishing and the stock is empty, nothing is drawn and your turn
 *  stock  ends.
 * End     The game ends when all 13 books are down (or no one can play on). Most books
 *         wins; equal books share the win.
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GoFishPlayer {
  id: string;
  name: string;
  /** CPU personality id; absent for the human player. */
  cpu?: string;
}

/** Everything in the log is public: every player at the table could see or hear it. */
export type GoFishEvent =
  | { t: 'turn'; p: string }
  | { t: 'ask'; p: string; to: string; rank: Rank }
  | { t: 'give'; from: string; to: string; rank: Rank; count: number }
  | { t: 'fish'; p: string; drew: boolean }
  | { t: 'lucky'; p: string; rank: Rank }
  | { t: 'book'; p: string; rank: Rank }
  | { t: 'refill'; p: string; drew: boolean }
  | { t: 'draw-instead'; p: string; drew: boolean }
  | { t: 'out'; p: string }
  | { t: 'end'; winners: string[] };

export interface GoFishData {
  [key: string]: unknown;
  players: GoFishPlayer[];
  difficulty: Difficulty;
  current: number;
  turns: number;
  log: GoFishEvent[];
  over: boolean;
  winners: string[];
  startedAt: number;
}

/** Result of one action. `privateDraw` is known only to the player who drew it. */
export interface StepResult {
  events: GoFishEvent[];
  privateDraw?: { player: string; card: Card };
  /** True if the same player keeps the turn. */
  again: boolean;
}

export const BOOKS_TOTAL = 13;
const LOG_LIMIT = 400;

export class GoFishGame {
  readonly table: Table;

  constructor(table: Table) {
    if (table.gameId !== 'go-fish') throw new Error('Not a Go Fish table');
    this.table = table;
  }

  static create(opts: { players: GoFishPlayer[]; difficulty?: Difficulty; seed?: number }): GoFishGame {
    const table = setupGoFish({
      players: opts.players.map((p) => p.id),
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    });
    const data: GoFishData = {
      players: opts.players,
      difficulty: opts.difficulty ?? 'normal',
      current: 0,
      turns: 0,
      log: [],
      over: false,
      winners: [],
      startedAt: Date.now(),
    };
    table.data = data;
    const game = new GoFishGame(table);
    const events: GoFishEvent[] = [];
    for (const p of opts.players) game.#books(p.id, events);
    game.#log(events);
    game.#log([{ t: 'turn', p: opts.players[0]!.id }]);
    game.#startTurn([]);
    return game;
  }

  static restore(table: Table): GoFishGame {
    return new GoFishGame(table);
  }

  get data(): GoFishData {
    return this.table.data as GoFishData;
  }

  get players(): GoFishPlayer[] {
    return this.data.players;
  }

  get current(): GoFishPlayer {
    return this.data.players[this.data.current]!;
  }

  get isOver(): boolean {
    return this.data.over;
  }

  hand(id: string): Hand {
    return this.table.pile<Hand>(`hand:${id}`);
  }

  get pond(): Pile {
    return this.table.pile('pond');
  }

  books(id: string): Rank[] {
    return this.data.log
      .filter((e): e is Extract<GoFishEvent, { t: 'book' }> => e.t === 'book' && e.p === id)
      .map((e) => e.rank);
  }

  get booksDown(): number {
    return this.data.log.filter((e) => e.t === 'book').length;
  }

  /** Ranks the player may ask for (ranks they hold). */
  askableRanks(id: string): Rank[] {
    return RANKS.filter((r) => this.hand(id).hasRank(r));
  }

  /** Opponents who can be asked (they still hold cards). */
  askableOpponents(id: string): GoFishPlayer[] {
    return this.players.filter((p) => p.id !== id && this.hand(p.id).size > 0);
  }

  /** True when the current player must choose a rank and opponent. */
  get awaitingAsk(): boolean {
    return !this.isOver && this.hand(this.current.id).size > 0 && this.askableOpponents(this.current.id).length > 0;
  }

  /** Rank → finished books. Moves cards to the player's book pile. */
  #books(id: string, events: GoFishEvent[]): void {
    for (const book of this.hand(id).extractBooks()) {
      for (const c of book) c.faceUp = true;
      this.table.pile(`books:${id}`).push(...book);
      events.push({ t: 'book', p: id, rank: book[0]!.rank });
    }
  }

  #log(events: GoFishEvent[]): void {
    const log = this.data.log;
    log.push(...events);
    if (log.length > LOG_LIMIT) {
      // Keep every book (scores are read from the log) and the most recent events.
      const books = log.filter((e) => e.t === 'book');
      const recent = log.slice(-LOG_LIMIT).filter((e) => e.t !== 'book');
      this.data.log = [...books, ...recent];
    }
  }

  #draw(id: string): Card | undefined {
    const [card] = this.pond.take(Math.min(1, this.pond.size));
    if (!card) return undefined;
    card.faceUp = this.players[0]!.id === id; // only the human's cards are shown face up
    this.hand(id).push(card);
    return card;
  }

  #checkEnd(events: GoFishEvent[]): boolean {
    if (this.data.over) return true;
    const booked = this.booksDown + events.filter((e) => e.t === 'book').length;
    // With a full deck, an empty stock and at most one player holding cards means every
    // book is down; the second check also stops play if no one could ever act again.
    const stuck = this.pond.size === 0 && this.players.filter((p) => this.hand(p.id).size > 0).length <= 1;
    if (booked < BOOKS_TOTAL && !stuck) return false;
    const counts = this.players.map(
      (p) => this.books(p.id).length + events.filter((e) => e.t === 'book' && e.p === p.id).length,
    );
    const best = Math.max(...counts);
    const winners = this.players.filter((_, i) => counts[i] === best).map((p) => p.id);
    events.push({ t: 'end', winners });
    this.data.over = true;
    this.data.winners = winners;
    return true;
  }

  /**
   * Applies the start-of-turn rules for the current player until someone can ask
   * (or the game ends): refill an empty hand, draw instead of asking, skip players
   * who are out.
   */
  #startTurn(events: GoFishEvent[], result?: StepResult): void {
    for (let guard = 0; guard < 200 && !this.#checkEnd(events); guard++) {
      const p = this.current;
      const hand = this.hand(p.id);
      if (hand.size === 0) {
        const card = this.#draw(p.id);
        events.push({ t: 'refill', p: p.id, drew: !!card });
        if (!card) {
          events.push({ t: 'out', p: p.id });
          this.#advance(events);
          continue;
        }
        if (result) result.privateDraw = { player: p.id, card };
        this.#books(p.id, events);
        continue; // re-check (the drawn card might have completed a book and emptied the hand)
      }
      if (this.askableOpponents(p.id).length === 0) {
        const card = this.#draw(p.id);
        events.push({ t: 'draw-instead', p: p.id, drew: !!card });
        if (card && result) result.privateDraw = { player: p.id, card };
        this.#books(p.id, events);
        this.#advance(events);
        continue;
      }
      break; // the current player can ask
    }
    this.#log(events);
  }

  #advance(events: GoFishEvent[]): void {
    this.data.current = (this.data.current + 1) % this.players.length;
    this.data.turns++;
    events.push({ t: 'turn', p: this.current.id });
  }

  /** The current player asks `targetId` for `rank`. */
  ask(askerId: string, targetId: string, rank: Rank): StepResult {
    if (this.isOver) throw new Error('The game is over');
    if (askerId !== this.current.id) throw new Error(`It is ${this.current.name}'s turn`);
    if (!this.hand(askerId).hasRank(rank)) throw new Error('You can only ask for a rank you hold');
    if (!this.askableOpponents(askerId).some((p) => p.id === targetId)) throw new Error('That player cannot be asked');

    const events: GoFishEvent[] = [{ t: 'ask', p: askerId, to: targetId, rank }];
    const result: StepResult = { events, again: false };
    const target = this.hand(targetId);

    if (target.hasRank(rank)) {
      const given = target.takeRank(rank);
      for (const c of given) c.faceUp = this.players[0]!.id === askerId;
      this.hand(askerId).push(...given);
      events.push({ t: 'give', from: targetId, to: askerId, rank, count: given.length });
      this.#books(askerId, events);
      result.again = true;
    } else {
      const card = this.#draw(askerId);
      events.push({ t: 'fish', p: askerId, drew: !!card });
      if (card) result.privateDraw = { player: askerId, card };
      if (card && card.rank === rank) {
        events.push({ t: 'lucky', p: askerId, rank });
        result.again = true;
      }
      this.#books(askerId, events);
    }

    if (!result.again) this.#advance(events);
    this.#startTurn(events, result);
    result.again = !this.isOver && this.current.id === askerId;
    return result;
  }

  /** Books per player, highest first. */
  standings(): { player: GoFishPlayer; books: number }[] {
    return this.players
      .map((player) => ({ player, books: this.books(player.id).length }))
      .sort((a, b) => b.books - a.books);
  }
}
