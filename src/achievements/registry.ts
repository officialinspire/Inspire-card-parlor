import type { GameId } from '@/core/types';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'general' | 'collection' | 'story' | GameId;
  xp: number;
  hidden?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'passport-first',
    name: 'First Stamp',
    description: 'Finish The Hometown and earn your first passport stamp.',
    icon: '✦',
    category: 'story',
    xp: 50,
  },
  {
    id: 'halfway-home',
    name: 'Halfway Home',
    description: 'Finish four chapters of The Card Parlor Chronicles.',
    icon: '✧',
    category: 'story',
    xp: 100,
  },
  {
    id: 'chronicles-complete',
    name: 'The Card Parlor Chronicles',
    description: 'Finish all seven chapters of the story.',
    icon: '♛',
    category: 'story',
    xp: 250,
  },
  {
    id: 'first-visit',
    name: 'Doors Open',
    description: 'Enter the parlor for the first time.',
    icon: '🗝',
    category: 'general',
    xp: 10,
  },
  { id: 'first-win', name: 'Beginner’s Luck', description: 'Win any game.', icon: '★', category: 'general', xp: 25 },
  {
    id: 'win-streak-5',
    name: 'On a Roll',
    description: 'Win 5 games in a row.',
    icon: '🔥',
    category: 'general',
    xp: 75,
  },
  {
    id: 'klondike-10',
    name: 'Gold Rush',
    description: 'Win 10 games of Klondike.',
    icon: '♠',
    category: 'klondike',
    xp: 50,
  },
  { id: 'spider-4suit', name: 'Weaver', description: 'Win four-suit Spider.', icon: '✶', category: 'spider', xp: 150 },
  {
    id: 'freecell-nocell',
    name: 'No Help Needed',
    description: 'Win FreeCell without using a free cell.',
    icon: '◈',
    category: 'freecell',
    xp: 120,
    hidden: true,
  },
  {
    id: 'war-flawless',
    name: 'Total Victory',
    description: 'Win War without losing a war.',
    icon: '⚔',
    category: 'war',
    xp: 60,
  },
  {
    id: 'gofish-sweep',
    name: 'Big Catch',
    description: 'Collect 7 books in one game of Go Fish.',
    icon: '❀',
    category: 'go-fish',
    xp: 60,
  },
  {
    id: 'collector-5',
    name: 'Collector',
    description: 'Own 5 decks or boards.',
    icon: '🃏',
    category: 'collection',
    xp: 50,
  },
  { id: 'story-ch1', name: 'Welcome Home', description: 'Complete Chapter 1.', icon: '📖', category: 'story', xp: 40 },
  {
    id: 'story-all',
    name: 'Parlor Legend',
    description: 'Complete every story chapter.',
    icon: '👑',
    category: 'story',
    xp: 300,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Play a game after midnight.',
    icon: '🌙',
    category: 'general',
    xp: 15,
    hidden: true,
  },
];
