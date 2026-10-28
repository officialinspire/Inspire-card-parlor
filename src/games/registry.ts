import type { GameId } from '@/core/types';

export interface GameDefinition {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  players: string;
  difficulty: 1 | 2 | 3;
  durationMin: number;
  /** Glyph shown on the selection tile. */
  icon: string;
  available: boolean;
}

/**
 * Gameplay modules will register rules engines here. For now each entry is
 * metadata only — selection, deck and board flows are fully wired.
 */
export const GAMES: readonly GameDefinition[] = [
  {
    id: 'klondike',
    name: 'Klondike',
    tagline: 'The timeless solitaire',
    description: 'Build four foundations from Ace to King, alternating colors down the tableau.',
    players: 'Solo',
    difficulty: 1,
    durationMin: 8,
    icon: '♠',
    available: false,
  },
  {
    id: 'spider',
    name: 'Spider',
    tagline: 'Eight runs, endless patience',
    description: 'Arrange full suited runs from King to Ace to clear them from the table.',
    players: 'Solo',
    difficulty: 3,
    durationMin: 15,
    icon: '✶',
    available: false,
  },
  {
    id: 'freecell',
    name: 'FreeCell',
    tagline: 'Every deal is a puzzle',
    description: 'Four free cells, all cards face up — pure strategy from the very first move.',
    players: 'Solo',
    difficulty: 2,
    durationMin: 10,
    icon: '◈',
    available: false,
  },
  {
    id: 'war',
    name: 'War',
    tagline: 'Flip, clash, conquer',
    description: 'A quick duel of high cards against Jak Gold or another parlor regular. Ties mean war!',
    players: '1 vs CPU',
    difficulty: 1,
    durationMin: 5,
    icon: '⚔',
    available: true,
  },
  {
    id: 'go-fish',
    name: 'Go Fish',
    tagline: 'Ask, guess, collect',
    description: 'Collect books of four by asking your opponents for the ranks you need.',
    players: '1 vs 1–3 CPU',
    difficulty: 1,
    durationMin: 7,
    icon: '❀',
    available: true,
  },
];

export const getGame = (id: GameId | null) => GAMES.find((g) => g.id === id) ?? null;
