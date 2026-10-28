import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const FredericksburgDeck: DeckDefinition = {
  id: 'fredericksburg',
  name: 'Fredericksburg',
  description: 'Fredericksburg deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'level', value: 3 },
  assets: standardAssets('assets/cards/fredericksburg/'),
  fallback: {
    back: { base: '#5a2a27', accent: '#e8d6b5', pattern: 'stripe', mark: 'F' },
    face: { paper: '#fdf8ee', red: '#a8322d', black: '#2a1e19' },
  },
  variants: [],
};
