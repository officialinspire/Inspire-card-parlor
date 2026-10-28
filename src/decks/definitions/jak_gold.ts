import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const JakGoldDeck: DeckDefinition = {
  id: 'jak_gold',
  name: 'Jak Gold',
  description: 'Jak Gold deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'level', value: 4 },
  assets: standardAssets('assets/cards/jak_gold/'),
  fallback: {
    back: { base: '#3a2d12', accent: '#e0b54a', pattern: 'sunburst', mark: 'J' },
    face: { paper: '#fffaf0', red: '#b0362a', black: '#231c10' },
  },
  variants: [],
};
