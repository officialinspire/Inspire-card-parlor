import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const InspireDeck: DeckDefinition = {
  id: 'inspire',
  name: 'INSPIRE',
  description: 'The house deck of INSPIRE CARD PARLOR by OFFICIAL INSPIRE.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'common',
  contentRating: 'general',
  unlock: { type: 'default' },
  assets: standardAssets('assets/cards/inspire/'),
  fallback: {
    back: { base: '#c8643f', accent: '#fbe3cf', pattern: 'plain', mark: 'I' },
    face: { paper: '#fffaf1', red: '#b8432f', black: '#2f2a24' },
  },
  variants: [],
};
