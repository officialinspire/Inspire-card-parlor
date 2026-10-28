import type { Rank } from '@/engine';

/**
 * CPU opponents. Traits shape how they play; lines are what they say in
 * speech bubbles. Personalities describe play style only.
 */
export interface CpuPersonality {
  id: string;
  name: string;
  title: string;
  /** Portrait in /public/assets/characters/<id>.webp|png once uploaded. */
  portrait: { status: 'pending' | 'ready'; formats?: ('webp' | 'png')[] };
  /** Deck whose artwork can stand in for a portrait when it is ready. */
  deckId?: string;
  initials: string;
  color: string;
  traits: {
    /** 0–1: how much of the public history they keep in mind. */
    memory: number;
    /** 0–1: chance of an off-the-cuff (random) request. */
    whimsy: number;
    /** 0–1: preference for asking whoever is ahead. */
    pressure: number;
    /** 0–1: preference for ranks they hold many of. */
    greed: number;
  };
  lines: {
    greet: string[];
    ask: (rank: Rank, target: string) => string;
    gave: string[];
    goFish: string[];
    lucky: string[];
    book: string[];
    warStart: string[];
    roundWin: string[];
    roundLose: string[];
    win: string[];
    lose: string[];
  };
}

const RANK_PLURAL: Record<Rank, string> = {
  1: 'Aces',
  2: 'Twos',
  3: 'Threes',
  4: 'Fours',
  5: 'Fives',
  6: 'Sixes',
  7: 'Sevens',
  8: 'Eights',
  9: 'Nines',
  10: 'Tens',
  11: 'Jacks',
  12: 'Queens',
  13: 'Kings',
};
export const rankPlural = (r: Rank) => RANK_PLURAL[r];
const RANK_SINGULAR: Record<Rank, string> = {
  1: 'Ace',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
};
export const rankSingular = (r: Rank) => RANK_SINGULAR[r];

export const PERSONALITIES: readonly CpuPersonality[] = [
  {
    id: 'jak_gold',
    name: 'Jak Gold',
    title: 'Parlor challenger',
    portrait: { status: 'pending' },
    deckId: 'jak_gold',
    initials: 'JG',
    color: '#e0b54a',
    traits: { memory: 0.75, whimsy: 0.1, pressure: 0.8, greed: 0.7 },
    lines: {
      greet: ['Deal me in.', 'Let’s see what you’ve got.'],
      ask: (r, t) => `${t}, hand over your ${rankPlural(r)}.`,
      gave: ['Knew it.', 'Much obliged.'],
      goFish: ['Go fish.', 'Not a one. Go fish.'],
      lucky: ['Look at that!', 'Right off the top.'],
      book: ['That’s a book.', 'Four of a kind. Next.'],
      warStart: ['War! Let’s see it.', 'Tie? Then it’s war.'],
      roundWin: ['Mine.', 'I’ll take those.'],
      roundLose: ['Take it — for now.', 'Enjoy it while it lasts.'],
      win: ['Good game. Rematch any time.', 'That one’s mine.'],
      lose: ['Well played. Rematch?', 'You earned that one.'],
    },
  },
  {
    id: 'friendly_local',
    name: 'Friendly Local',
    title: 'Regular at the corner table',
    portrait: { status: 'pending' },
    initials: 'FL',
    color: '#7fa58a',
    traits: { memory: 0.45, whimsy: 0.3, pressure: 0.2, greed: 0.5 },
    lines: {
      greet: ['Oh, lovely — a game!', 'Pull up a chair.'],
      ask: (r, t) => `${t}, any ${rankPlural(r)} for me?`,
      gave: ['Oh, thank you kindly!', 'How nice of you.'],
      goFish: ['Sorry, dear — go fish!', 'None here. Go fish!'],
      lucky: ['Well, would you look at that!', 'Ha! Just what I needed.'],
      book: ['A whole set! How fun.', 'Oh, that makes four!'],
      warStart: ['Ooh, a war!', 'A tie! Here we go.'],
      roundWin: ['Oh, that one’s mine!', 'Lucky me.'],
      roundLose: ['Good one!', 'All yours.'],
      win: ['What a nice game. Thank you!', 'Oh my, I won!'],
      lose: ['You’re too good! Again?', 'Lovely game.'],
    },
  },
  {
    id: 'strategic',
    name: 'Strategic Opponent',
    title: 'Keeps careful track',
    portrait: { status: 'pending' },
    initials: 'SO',
    color: '#6f8fae',
    traits: { memory: 1, whimsy: 0, pressure: 0.5, greed: 0.9 },
    lines: {
      greet: ['Ready.', 'Shall we?'],
      ask: (r, t) => `${t}: ${rankPlural(r)}.`,
      gave: ['As expected.', 'Noted.'],
      goFish: ['Go fish.', 'None.'],
      lucky: ['Convenient.', 'Probability favors me.'],
      book: ['Book.', 'Complete.'],
      warStart: ['War.', 'A tie. Proceed.'],
      roundWin: ['Mine.', 'Expected.'],
      roundLose: ['Acceptable.', 'Yours.'],
      win: ['Good game.', 'Victory.'],
      lose: ['Well played.', 'A worthy result.'],
    },
  },
];

export const getPersonality = (id: string | undefined) => PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0]!;

export const pickLine = (lines: string[], rand: () => number = Math.random) =>
  lines[Math.floor(rand() * lines.length)]!;
