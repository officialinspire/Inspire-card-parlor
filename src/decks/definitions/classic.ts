import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const ClassicDeck: DeckDefinition = {
  id: 'classic',
  name: 'Classic',
  description: 'A traditional 52-card deck for everyday play.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'common',
  contentRating: 'general',
  unlock: { type: 'default' },
  assets: standardAssets('assets/cards/classic/'),
  fallback: {
    back: { base: '#1f3a5f', accent: '#e9dcc0', pattern: 'diamond', mark: '♠' },
    face: { paper: '#fffdf7', red: '#c0392b', black: '#1d1d1f' },
  },
  variants: [],
};
