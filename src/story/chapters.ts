import type { GameId } from '@/core/types';

export interface Character {
  id: string;
  name: string;
  role: string;
  /** Portrait art will live in /public/assets/characters. */
  portrait: string;
  color: string;
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  synopsis: string;
  hostId: string;
  gameId: GameId;
  reward: { coins: number; unlock?: string };
}

export const CHARACTERS: readonly Character[] = [
  { id: 'mae', name: 'Mae Holloway', role: 'Parlor owner', portrait: 'mae.png', color: '#e2b866' },
  { id: 'jules', name: 'Jules Arden', role: 'Card sharp', portrait: 'jules.png', color: '#7fb8d8' },
  { id: 'otto', name: 'Uncle Otto', role: 'Retired dealer', portrait: 'otto.png', color: '#c98a5b' },
  { id: 'ivy', name: 'Ivy Song', role: 'Pianist', portrait: 'ivy.png', color: '#d48bb0' },
];

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'chapter-1',
    index: 1,
    title: 'The Key Under the Mat',
    synopsis: 'You inherit a dusty card parlor. Mae shows you the ropes with a patient game of Klondike.',
    hostId: 'mae',
    gameId: 'klondike',
    reward: { coins: 100 },
  },
  {
    id: 'chapter-2',
    index: 2,
    title: 'Tea and Tactics',
    synopsis: 'Uncle Otto swears no FreeCell deal is unwinnable. Prove him right.',
    hostId: 'otto',
    gameId: 'freecell',
    reward: { coins: 150, unlock: 'garden-tea' },
  },
  {
    id: 'chapter-3',
    index: 3,
    title: 'A Sharp Arrives',
    synopsis: 'Jules challenges the house to a round of War. Defend the parlor’s honor.',
    hostId: 'jules',
    gameId: 'war',
    reward: { coins: 200, unlock: 'walnut-study' },
  },
  {
    id: 'chapter-4',
    index: 4,
    title: 'Encore at Midnight',
    synopsis: 'Ivy plays the late set while regulars gather for Go Fish.',
    hostId: 'ivy',
    gameId: 'go-fish',
    reward: { coins: 250 },
  },
  {
    id: 'chapter-5',
    index: 5,
    title: 'The Web of Eight',
    synopsis: 'An old Spider layout hides the parlor’s oldest secret.',
    hostId: 'mae',
    gameId: 'spider',
    reward: { coins: 400 },
  },
];

export const getCharacter = (id: string) => CHARACTERS.find((c) => c.id === id);
