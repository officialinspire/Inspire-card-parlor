import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const EasternWoodlandsDeck: DeckDefinition = {
  id: 'eastern_woodlands',
  name: 'Eastern Woodlands',
  description: 'Eastern Woodlands deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'story', value: 'chapter-2' },
  assets: standardAssets('assets/cards/eastern_woodlands/'),
  fallback: {
    back: { base: '#33452d', accent: '#d9c48f', pattern: 'diamond', mark: 'E' },
    face: { paper: '#fbf7ec', red: '#a4402c', black: '#202a1c' },
  },
  variants: [],
};
