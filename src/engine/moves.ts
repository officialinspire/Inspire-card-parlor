import type { Card } from './Card';
import type { Pile } from './Pile';

/** A rule decides whether `cards` (bottom → top) may move from one pile onto another. */
export type MoveRule = (cards: readonly Card[], from: Pile, to: Pile) => boolean;

export interface Move {
  from: string;
  to: string;
  cardIds: string[];
  /** Card revealed in `from` after the move (so undo can hide it again). */
  revealed?: string;
  /** Facing changes applied to the moved cards: id → previous faceUp. */
  flipped?: Record<string, boolean>;
}

export interface MoveOptions {
  rule?: MoveRule;
  /** Turn the newly exposed top of the source pile face up. */
  revealSource?: boolean;
  /** Force the moved cards' facing. */
  faceUp?: boolean;
}

/**
 * Moves the top `count` cards from one pile to another, keeping their order.
 * Returns a Move record (for undo/animation), or null if the rule rejects it.
 */
export function moveCards(from: Pile, to: Pile, count = 1, opts: MoveOptions = {}): Move | null {
  if (count < 1 || count > from.size || from === to) return null;
  const cards = from.peek(count);
  if (opts.rule && !opts.rule(cards, from, to)) return null;

  from.take(count);
  const flipped: Record<string, boolean> = {};
  if (opts.faceUp !== undefined) {
    for (const c of cards) {
      if (c.faceUp !== opts.faceUp) flipped[c.id] = c.faceUp;
      c.faceUp = opts.faceUp;
    }
  }
  to.push(...cards);

  const move: Move = { from: from.id, to: to.id, cardIds: cards.map((c) => c.id) };
  if (Object.keys(flipped).length) move.flipped = flipped;
  if (opts.revealSource) {
    const revealed = from.revealTop();
    if (revealed) move.revealed = revealed.id;
  }
  return move;
}

/** Reverses a Move produced by `moveCards`. */
export function undoMove(move: Move, piles: Record<string, Pile> | Map<string, Pile>): void {
  const get = (id: string) => (piles instanceof Map ? piles.get(id) : piles[id]);
  const from = get(move.from);
  const to = get(move.to);
  if (!from || !to) throw new Error(`Unknown pile in move ${move.from} → ${move.to}`);
  if (move.revealed) from.top?.flip(false);
  const cards = to.take(move.cardIds.length);
  if (cards.map((c) => c.id).join() !== move.cardIds.join()) {
    to.push(...cards);
    throw new Error('Move can no longer be undone: pile changed');
  }
  if (move.flipped) for (const c of cards) if (c.id in move.flipped) c.faceUp = move.flipped[c.id]!;
  from.push(...cards);
}
