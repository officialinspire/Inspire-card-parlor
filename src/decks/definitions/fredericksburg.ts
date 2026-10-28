import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const FredericksburgDeck: DeckDefinition = {
  id: 'fredericksburg',
  name: 'Fredericksburg Heritage',
  description:
    'Historic Fredericksburg in pen and watercolour: colonial figures, riverside sketches and the FXBG back.',
  artist: studioCredit(),
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'level', value: 3 },
  assets: extractedAssets('assets/cards/fredericksburg/'),
  fallback: {
    back: { base: '#5a2a27', accent: '#e8d6b5', pattern: 'stripe', mark: 'F' },
    face: { paper: '#fdf8ee', red: '#a8322d', black: '#2a1e19' },
  },
  variants: [],
};
