import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const FreemasonryDeck: DeckDefinition = {
  id: 'freemasonry',
  name: 'Freemasonry',
  description: 'Freemasonry deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'legendary',
  contentRating: 'general',
  unlock: { type: 'level', value: 12 },
  assets: standardAssets('assets/cards/freemasonry/'),
  fallback: {
    back: { base: '#14234a', accent: '#d9b45a', pattern: 'sunburst', mark: 'F' },
    face: { paper: '#fbf8f0', red: '#a8323a', black: '#141a2a' },
  },
  variants: [],
};
