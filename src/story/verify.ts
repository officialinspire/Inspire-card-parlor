import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import type { SolitaireGame } from '@/games/solitaire/SolitaireGame';
import { solve, replay, type SolveResult } from '@/games/solitaire/solver';
import { WarGame } from '@/games/war/WarGame';
import { GoFishGame } from '@/games/goFish/GoFishGame';
import { goFishPlayers } from './players';
export { goFishPlayers };
import { chooseAsk } from '@/games/goFish/cpu';
import { playerView } from '@/games/goFish/view';
import { getPersonality } from '@/games/cpu/personalities';
import type { StoryLevel } from './campaign';

/**
 * Proof that a story challenge can be met, using the real game engines.
 *
 *  · Seeded solitaire: the solver finds a winning line, and the line is
 *    replayed on a fresh deal to confirm it.
 *  · Seeded War: War has no decisions, so the seed alone decides the game;
 *    the full game is simulated and must end in the player's favour.
 *  · Go Fish depends on the player's choices and the deal; levels are not
 *    seeded and use an Easy table. `goFishWinRate` measures, over many deals,
 *    how often a sensible player meets the objective.
 */

export function createSolitaire(level: StoryLevel): SolitaireGame {
  const { seed, options = {} } = level.setup;
  if (level.game === 'klondike') return KlondikeGame.create({ seed, draw: options.draw ?? 1 });
  if (level.game === 'spider') return SpiderGame.create({ seed, suits: options.suits ?? 1 });
  return FreeCellGame.create({ seed });
}

export function verifySolitaire(level: StoryLevel, budget = 200_000): SolveResult & { replayed: boolean } {
  const r = solve(createSolitaire(level), budget);
  return { ...r, replayed: r.solved && replay(createSolitaire(level), r.line) };
}

export function simulateWar(seed: number, opponentId = 'jak_gold'): { status: string; rounds: number } {
  const game = WarGame.create({ seed, opponentId });
  let rounds = 0;
  while (!game.isOver && rounds < 5000) {
    game.playRound();
    rounds++;
  }
  return { status: game.status, rounds };
}

/** Plays one Go Fish game with a sensible human (the Strategic persona on Normal) and returns the result. */
export function simulateGoFish(seed: number, opponents: readonly string[], difficulty: 'easy' | 'normal' | 'hard') {
  const game = GoFishGame.create({ players: goFishPlayers(opponents), difficulty, seed });
  const rand = () => game.table.random.next();
  let turns = 0;
  while (!game.isOver && turns++ < 2000) {
    const cur = game.current;
    const persona = getPersonality(cur.cpu ?? 'strategic');
    const choice = chooseAsk(playerView(game, cur.id), persona, cur.cpu ? difficulty : 'normal', rand);
    game.ask(cur.id, choice.target, choice.rank);
  }
  return { won: game.data.winners.length === 1 && game.data.winners[0] === 'you', books: game.books('you').length };
}

/** Share of deals on which a sensible player meets a Go Fish objective. */
export function goFishWinRate(level: StoryLevel, deals = 60): number {
  const opponents = level.setup.options?.opponents ?? ['friendly_local'];
  const difficulty = level.setup.options?.difficulty ?? 'easy';
  let met = 0;
  for (let seed = 1; seed <= deals; seed++) {
    const r = simulateGoFish(seed * 7919, opponents, difficulty);
    if (level.objective.kind === 'books' ? r.books >= level.objective.min : r.won) met++;
  }
  return met / deals;
}
