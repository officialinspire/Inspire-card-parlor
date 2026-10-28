export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface DeckDefinition {
  id: string;
  name: string;
  artist: string;
  rarity: Rarity;
  description: string;
  /** CSS-driven card back until illustrated art lands in /public/assets/cards. */
  back: { base: string; accent: string; pattern: 'diamond' | 'stripe' | 'dots' | 'sunburst' };
  face: { paper: string; red: string; black: string };
  unlock: { type: 'default' | 'level' | 'achievement' | 'story'; value?: number | string };
}

export const DECKS: readonly DeckDefinition[] = [
  {
    id: 'inspire-classic',
    name: 'INSPIRE Classic',
    artist: 'OFFICIAL INSPIRE',
    rarity: 'common',
    description: 'The house deck — deep oxblood backs with gilded diamonds.',
    back: { base: '#5b1a1f', accent: '#e2b866', pattern: 'diamond' },
    face: { paper: '#fbf5ea', red: '#b3262e', black: '#1d1410' },
    unlock: { type: 'default' },
  },
  {
    id: 'midnight-jazz',
    name: 'Midnight Jazz',
    artist: 'OFFICIAL INSPIRE',
    rarity: 'rare',
    description: 'Indigo velvet and brass, straight from the late set.',
    back: { base: '#1c2150', accent: '#d9a441', pattern: 'stripe' },
    face: { paper: '#f6f1e6', red: '#c0392b', black: '#14163a' },
    unlock: { type: 'level', value: 3 },
  },
  {
    id: 'garden-tea',
    name: 'Garden Tea',
    artist: 'OFFICIAL INSPIRE',
    rarity: 'rare',
    description: 'Sage, cream and blush — a quiet afternoon deck.',
    back: { base: '#4f6b4a', accent: '#f2d4c4', pattern: 'dots' },
    face: { paper: '#fffaf1', red: '#c4515b', black: '#2c3a2a' },
    unlock: { type: 'story', value: 'chapter-2' },
  },
  {
    id: 'neon-alley',
    name: 'Neon Alley',
    artist: 'OFFICIAL INSPIRE',
    rarity: 'epic',
    description: 'Streetwear-inspired backs that glow after hours.',
    back: { base: '#141018', accent: '#ff4fa3', pattern: 'sunburst' },
    face: { paper: '#f7f4fb', red: '#e0246f', black: '#141018' },
    unlock: { type: 'achievement', value: 'win-streak-5' },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    artist: 'OFFICIAL INSPIRE',
    rarity: 'legendary',
    description: 'Hand-gilded sunset backs reserved for parlor legends.',
    back: { base: '#7a3c12', accent: '#ffd98a', pattern: 'sunburst' },
    face: { paper: '#fff6e3', red: '#b8401c', black: '#2b1606' },
    unlock: { type: 'level', value: 20 },
  },
];

export const getDeck = (id: string) => DECKS.find((d) => d.id === id) ?? DECKS[0]!;
