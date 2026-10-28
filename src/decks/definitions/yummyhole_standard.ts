import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const YummyholeStandardDeck: DeckDefinition = {
  id: 'yummyhole_standard',
  name: 'Yummyhole Standard',
  description: 'Yummyhole Standard deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'level', value: 6 },
  assets: standardAssets('assets/cards/yummyhole_standard/'),
  fallback: {
    back: { base: '#2f5d50', accent: '#f2c6a0', pattern: 'dots', mark: 'Y' },
    face: { paper: '#fffaf3', red: '#c2453a', black: '#1f2b28' },
  },
  variants: [],
};
