import type { BoardMove, SolitaireGame } from './SolitaireGame';

/**
 * Proves a solitaire deal can be won, by searching for a winning line with
 * the game's own rules (`legalMoves`, `move`, `stockAction`, `undo`), so the
 * solver can never disagree with the engine the player uses.
 *
 * The search is conservative: it prunes moves that are rarely needed (e.g.
 * shuffling cards between columns without revealing anything), so it may
 * give up on a deal that is actually winnable — but when it says `solved`,
 * the returned line wins. Story Mode only makes a seeded deal mandatory after
 * this verifier has solved it.
 */
export type SolverStep = { kind: 'move'; move: BoardMove } | { kind: 'stock' };

export interface SolveResult {
  solved: boolean;
  /** Winning line from the initial deal (when solved). */
  line: SolverStep[];
  /** Positions examined. */
  nodes: number;
  /** True when the node budget ran out before a verdict. */
  exhausted: boolean;
}

/** A canonical key for the position (free cells are unordered). */
function positionKey(game: SolitaireGame): string {
  const parts: string[] = [];
  const cells: string[] = [];
  for (const p of game.table.piles.values()) {
    const s = p.all.map((c) => (c.faceUp ? c.code : `(${c.code})`)).join(',');
    if (p.kind === 'cell') cells.push(s);
    else if (p.kind === 'foundation') parts.push(`${p.id}=${p.size}`);
    else parts.push(`${p.id}=${s}`);
  }
  return `${parts.join('|')}|cells=${cells.sort().join(';')}`;
}

/** Moves worth trying, best first. Returns [] for moves we prune. */
function candidateSteps(game: SolitaireGame): SolverStep[] {
  const scored: { step: SolverStep; score: number }[] = [];
  const id = game.gameId;
  for (const m of game.legalMoves()) {
    const from = game.pile(m.from);
    const to = game.pile(m.to);
    const card = from.at(m.index)!;
    const below = from.at(m.index - 1);
    let score = -1;
    if (to.kind === 'foundation') score = 100 - card.rank;
    else if (from.kind === 'foundation')
      score = -1; // taking cards back down is rarely needed
    else if (from.kind === 'waste' && to.kind === 'tableau') score = 40;
    else if (from.kind === 'cell' && to.kind === 'tableau') score = 45;
    else if (from.kind === 'tableau' && to.kind === 'tableau') {
      if (below && !below.faceUp)
        score = 70; // reveals a card
      else if (!below)
        score = to.isEmpty ? -1 : 30; // empties a column
      else if (id === 'spider') {
        // Spider: building on a same-suit card, or freeing a card that can then build.
        const top = to.top;
        score = top && top.suit === card.suit ? 35 : below.suit !== card.suit ? 20 : -1;
      } else if (id === 'freecell') score = to.isEmpty ? 5 : 25;
      else {
        // Klondike: only shift a run if the card beneath can then go up.
        score = game.foundations.some((f) => game.canDrop([below], from, f)) ? 50 : -1;
      }
    } else if (from.kind === 'tableau' && to.kind === 'cell') {
      // One empty cell is enough to try; the others are equivalent.
      const firstEmpty = game.table.group('cell:').find((c) => c.isEmpty);
      score = firstEmpty?.id === to.id ? 10 : -1;
    }
    if (score >= 0) scored.push({ step: { kind: 'move', move: m }, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const steps = scored.map((s) => s.step);
  if (game.table.piles.has('stock') && (game.pile('stock').size || game.table.piles.has('waste')))
    steps.push({ kind: 'stock' });
  return steps;
}

function apply(game: SolitaireGame, step: SolverStep): boolean {
  return step.kind === 'stock' ? game.stockAction() : game.move(step.move);
}

/** Depth-first search with a visited set. `game` is left in its starting position. */
export function solve(game: SolitaireGame, budget = 200_000): SolveResult {
  const seen = new Set<string>([positionKey(game)]);
  const line: SolverStep[] = [];
  const stack: { steps: SolverStep[]; i: number }[] = [{ steps: candidateSteps(game), i: 0 }];
  let nodes = 0;
  while (stack.length) {
    if (game.data.won) return { solved: true, line: [...line], nodes, exhausted: false };
    if (nodes >= budget) break;
    const top = stack[stack.length - 1]!;
    if (top.i >= top.steps.length) {
      stack.pop();
      if (line.length) {
        line.pop();
        game.undo();
      }
      continue;
    }
    const step = top.steps[top.i++]!;
    if (!apply(game, step)) continue;
    nodes++;
    if (game.data.won) {
      line.push(step);
      return { solved: true, line: [...line], nodes, exhausted: false };
    }
    const key = positionKey(game);
    if (seen.has(key)) {
      game.undo();
      continue;
    }
    seen.add(key);
    line.push(step);
    stack.push({ steps: candidateSteps(game), i: 0 });
  }
  // Unwind to the start.
  while (line.length) {
    line.pop();
    game.undo();
  }
  return { solved: false, line: [], nodes, exhausted: nodes >= budget };
}

/** Replays a line on a fresh deal; true if it wins (used to double-check verdicts). */
export function replay(game: SolitaireGame, line: SolverStep[]): boolean {
  for (const step of line) if (!apply(game, step)) return false;
  return game.data.won;
}
