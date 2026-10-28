import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const DantesWorldDeck: DeckDefinition = {
  id: 'dantes_world',
  name: "Dante's World",
  description: "Dante's World deck. Description to be supplied with the commissioned artwork.",
  artist: { name: null, note: 'Commissioned artwork pending upload.' },
  rarity: 'epic',
  contentRating: 'general',
  unlock: { type: 'story', value: 'chapter-3' },
  assets: standardAssets('assets/cards/dantes_world/'),
  fallback: {
    back: { base: '#3b1d2e', accent: '#e6a3b8', pattern: 'stripe', mark: 'D' },
    face: { paper: '#fbf6f0', red: '#b33a4a', black: '#22161c' },
  },
  variants: [],
};
