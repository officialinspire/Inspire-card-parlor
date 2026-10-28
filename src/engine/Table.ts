import { Card, type SerializedCard } from './Card';
import { Hand } from './Hand';
import { Pile, type SerializedPile } from './Pile';
import { Random } from './random';
import { moveCards, undoMove, type Move, type MoveOptions } from './moves';

export const SNAPSHOT_VERSION = 1;

export interface TableSnapshot {
  version: number;
  gameId: string;
  /** Deal seed and current RNG state, so a restored game continues identically. */
  seed: number;
  rngState: number;
  /** Total cards in play; restoration verifies nothing was lost or duplicated. */
  cardCount: number;
  piles: (SerializedPile & { owner?: string })[];
  history: Move[];
  /** Game-specific data (score, timer, variant…). Must be JSON-safe. */
  data: Record<string, unknown>;
  savedAt: number;
}

export class SnapshotError extends Error {}

/**
 * All piles of one game plus its RNG and move history. Every game mode builds
 * on this, and it is the unit that gets saved and restored.
 */
export class Table {
  readonly gameId: string;
  readonly random: Random;
  readonly piles = new Map<string, Pile>();
  readonly history: Move[] = [];
  data: Record<string, unknown> = {};

  constructor(gameId: string, random: Random = new Random()) {
    this.gameId = gameId;
    this.random = random;
  }

  add<P extends Pile>(pile: P): P {
    if (this.piles.has(pile.id)) throw new Error(`Duplicate pile id "${pile.id}"`);
    this.piles.set(pile.id, pile);
    return pile;
  }

  pile<P extends Pile = Pile>(id: string): P {
    const p = this.piles.get(id);
    if (!p) throw new Error(`No pile "${id}"`);
    return p as P;
  }

  /** Piles whose id starts with `prefix`, in insertion order (e.g. "tableau:"). */
  group(prefix: string): Pile[] {
    return [...this.piles.values()].filter((p) => p.id.startsWith(prefix));
  }

  get cardCount(): number {
    let n = 0;
    for (const p of this.piles.values()) n += p.size;
    return n;
  }

  /** Locate a card anywhere on the table. */
  find(cardId: string): { pile: Pile; index: number; card: Card } | null {
    for (const pile of this.piles.values()) {
      const index = pile.indexOf(cardId);
      if (index !== -1) return { pile, index, card: pile.at(index)! };
    }
    return null;
  }

  move(fromId: string, toId: string, count = 1, opts: MoveOptions = {}): Move | null {
    const move = moveCards(this.pile(fromId), this.pile(toId), count, opts);
    if (move) this.history.push(move);
    return move;
  }

  undo(): Move | null {
    const move = this.history.pop();
    if (!move) return null;
    undoMove(move, this.piles);
    return move;
  }

  snapshot(): TableSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      gameId: this.gameId,
      seed: this.random.seed,
      rngState: this.random.state,
      cardCount: this.cardCount,
      piles: [...this.piles.values()].map((p) => p.toJSON()),
      history: structuredClone(this.history),
      data: structuredClone(this.data),
      savedAt: Date.now(),
    };
  }

  /** Rebuilds a table from a snapshot, validating it first. */
  static restore(snapshot: TableSnapshot): Table {
    validateSnapshot(snapshot);
    const table = new Table(snapshot.gameId, Random.restore(snapshot.seed, snapshot.rngState));
    for (const p of snapshot.piles) table.add(p.kind === 'hand' ? Hand.fromJSON(p) : Pile.fromJSON(p));
    table.history.push(...structuredClone(snapshot.history));
    table.data = structuredClone(snapshot.data);
    return table;
  }
}

/** Throws SnapshotError if a snapshot is malformed, from another version, or loses/duplicates cards. */
export function validateSnapshot(s: TableSnapshot): void {
  if (!s || typeof s !== 'object') throw new SnapshotError('Snapshot is not an object');
  if (s.version !== SNAPSHOT_VERSION) throw new SnapshotError(`Unsupported snapshot version ${s.version}`);
  if (typeof s.gameId !== 'string' || !Array.isArray(s.piles)) throw new SnapshotError('Snapshot is missing fields');
  const ids = new Set<string>();
  const pileIds = new Set<string>();
  let count = 0;
  for (const p of s.piles) {
    if (pileIds.has(p.id)) throw new SnapshotError(`Duplicate pile "${p.id}"`);
    pileIds.add(p.id);
    for (const c of p.cards as SerializedCard[]) {
      if (ids.has(c.id)) throw new SnapshotError(`Card ${c.id} appears twice`);
      ids.add(c.id);
      try {
        new Card(c.r, c.s);
      } catch {
        throw new SnapshotError(`Invalid card ${JSON.stringify(c)}`);
      }
      count++;
    }
  }
  if (count !== s.cardCount) throw new SnapshotError(`Expected ${s.cardCount} cards, found ${count}`);
  for (const m of s.history ?? []) {
    if (!pileIds.has(m.from) || !pileIds.has(m.to)) throw new SnapshotError('History references an unknown pile');
  }
}
