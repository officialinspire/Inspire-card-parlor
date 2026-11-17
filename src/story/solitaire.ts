import { Random } from '@/engine';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import type { SolitaireGame } from '@/games/solitaire/SolitaireGame';
import { ALL_LEVELS, type StoryLevel } from './campaign';

export function createStorySolitaire(level: StoryLevel, seed = level.setup.seed): SolitaireGame {
  const { options = {} } = level.setup;
  if (level.game === 'klondike') return KlondikeGame.create({ seed, draw: options.draw ?? 1 });
  if (level.game === 'spider') return SpiderGame.create({ seed, suits: options.suits ?? 1 });
  return options.freecellPuzzle
    ? FreeCellGame.createPuzzle({ seed, shuffle: seed !== level.setup.seed })
    : FreeCellGame.create({ seed });
}

/** Other campaign deals verified for the same rules, including the original after a redeal. */
export function storySolitaireSeeds(level: StoryLevel): number[] {
  const { draw, suits, freecellPuzzle } = level.setup.options ?? {};
  const seeds = ALL_LEVELS.flatMap((candidate) => {
    const options = candidate.setup.options ?? {};
    const seed = candidate.setup.seed;
    return candidate.game === level.game &&
      options.draw === draw &&
      options.suits === suits &&
      options.freecellPuzzle === freecellPuzzle &&
      seed !== undefined
      ? [seed]
      : [];
  });
  return [...new Set(seeds)];
}

export function nextStorySolitaireSeed(level: StoryLevel, previous: number): number | undefined {
  const choices = storySolitaireSeeds(level).filter((seed) => seed !== previous);
  return choices[new Random().int(choices.length)] ?? level.setup.seed;
}
