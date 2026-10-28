import { Table, type Card, type Pile } from '@/engine';

/** A move on the board: the cards from `index` to the top of `from`, onto `to`. */
export interface BoardMove {
  from: string;
  index: number;
  to: string;
}

export type Hint = (BoardMove & { kind: 'move' }) | { kind: 'stock' };

/** One player action = one or more engine moves, undone together. */
interface ActionRecord {
  n: number;
  score: number;
}

export interface SolitaireData {
  [key: string]: unknown;
  seed: number;
  score: number;
  moves: number;
  elapsedMs: number;
  actions: ActionRecord[];
  won: boolean;
  startedAt: number;
}

/** Why a move was refused (for UI feedback and tests). */
export type RejectReason = 'same-pile' | 'not-pickable' | 'illegal-drop' | 'game-over';

/**
 * Shared solitaire engine on top of the universal Table: validation hooks,
 * grouped undo for compound actions, hints, scoring and timing.
 * Each game supplies `canPick`, `canDrop`, its stock action and win rule.
 */
export abstract class SolitaireGame {
  readonly table: Table;
  lastReject: RejectReason | null = null;

  constructor(table: Table) {
    this.table = table;
  }

  get data(): SolitaireData {
    return this.table.data as SolitaireData;
  }

  get gameId(): string {
    return this.table.gameId;
  }

  pile(id: string): Pile {
    return this.table.pile(id);
  }

  get tableau(): Pile[] {
    return this.table.group('tableau:');
  }

  get foundations(): Pile[] {
    return this.table.group('foundation:');
  }

  // ----- Rules supplied by each game -----

  /** May the cards from `index` to the top of `pile` be picked up together? */
  abstract canPick(pile: Pile, index: number): boolean;
  /** May `cards` (bottom → top), taken from `from`, be placed on `to`? */
  abstract canDrop(cards: readonly Card[], from: Pile, to: Pile): boolean;
  /** Draw/deal/recycle. Returns false if nothing can happen. */
  abstract stockAction(): boolean;
  abstract get isWon(): boolean;
  abstract hint(): Hint | null;
  /** Score change for a successful move (before follow-up effects). */
  protected moveScore(_from: Pile, _to: Pile, _cards: readonly Card[]): number {
    return 0;
  }
  /** Follow-up effects after a move (e.g. Spider removing a finished run). Returns extra score. */
  protected afterMove(_to: Pile): number {
    return 0;
  }

  // ----- Moves -----

  canMove(m: BoardMove): boolean {
    this.lastReject = null;
    if (this.data.won) return this.#reject('game-over');
    if (m.from === m.to) return this.#reject('same-pile');
    const from = this.table.piles.get(m.from);
    const to = this.table.piles.get(m.to);
    if (!from || !to || m.index < 0 || m.index >= from.size) return this.#reject('not-pickable');
    if (!this.canPick(from, m.index)) return this.#reject('not-pickable');
    if (!this.canDrop(from.all.slice(m.index), from, to)) return this.#reject('illegal-drop');
    return true;
  }

  #reject(r: RejectReason): false {
    this.lastReject = r;
    return false;
  }

  /** Performs a legal move as one undoable action. Illegal moves change nothing. */
  move(m: BoardMove): boolean {
    if (!this.canMove(m)) return false;
    const from = this.pile(m.from);
    const to = this.pile(m.to);
    const cards = from.all.slice(m.index);
    this.action(() => {
      const revealedBefore = from.size > cards.length && !from.at(m.index - 1)!.faceUp;
      this.table.move(m.from, m.to, cards.length, { revealSource: true });
      let score = this.moveScore(from, to, cards);
      if (revealedBefore) score += this.revealScore();
      score += this.afterMove(to);
      return score;
    });
    return true;
  }

  protected revealScore(): number {
    return 0;
  }

  /** Runs `fn` as one undoable action; `fn` performs table moves and returns the score change. */
  protected action(fn: () => number): void {
    const before = this.table.history.length;
    const score = fn();
    const n = this.table.history.length - before;
    if (n === 0) return;
    this.data.actions.push({ n, score });
    this.data.score += score;
    this.data.moves++;
    if (this.isWon) this.data.won = true;
  }

  get canUndo(): boolean {
    return this.data.actions.length > 0 && !this.data.won;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const a = this.data.actions.pop()!;
    for (let i = 0; i < a.n; i++) this.table.undo();
    this.data.score -= a.score;
    this.data.moves++; // undo counts as a move, as in most solitaire scoring
    return true;
  }

  /** Every legal move on the board right now. */
  legalMoves(): BoardMove[] {
    const out: BoardMove[] = [];
    const piles = [...this.table.piles.values()];
    for (const from of piles) {
      for (let index = from.size - 1; index >= 0; index--) {
        if (!this.canPick(from, index)) continue;
        const cards = from.all.slice(index);
        for (const to of piles)
          if (to !== from && this.canDrop(cards, from, to)) out.push({ from: from.id, index, to: to.id });
      }
    }
    return out;
  }

  /** Best destination for a double-tap: foundation first, then tableau with cards, then empty spaces. */
  autoTarget(from: string, index: number): string | null {
    const moves = this.legalMoves().filter((m) => m.from === from && m.index === index);
    const rank = (id: string) => {
      const p = this.pile(id);
      if (p.kind === 'foundation') return 0;
      if (p.kind === 'tableau' && !p.isEmpty) return 1;
      if (p.kind === 'tableau') return 2;
      return 3;
    };
    moves.sort((a, b) => rank(a.to) - rank(b.to));
    return moves[0]?.to ?? null;
  }

  /** Adds play time (the view calls this while the game is running). */
  tick(ms: number): void {
    if (!this.data.won) this.data.elapsedMs += ms;
  }
}

/** Picks the highest-scoring candidate with a positive score. */
export function bestOf<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

/** Shared data for a freshly dealt solitaire table. */
export function initSolitaireData(table: Table, extra: Record<string, unknown>, score = 0): void {
  const data: SolitaireData = {
    seed: table.random.seed,
    score,
    moves: 0,
    elapsedMs: 0,
    actions: [],
    won: false,
    startedAt: Date.now(),
    ...extra,
  };
  table.data = data;
}
