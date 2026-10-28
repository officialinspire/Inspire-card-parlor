import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const DantesWorldDeck: DeckDefinition = {
  id: 'dantes_world',
  name: "Dante's World",
  description:
    'Neon psychedelic monsters: one-eyed jacks, wild-haired queens and grinning kings, framed in rainbow flame.',
  artist: studioCredit(),
  rarity: 'epic',
  contentRating: 'general',
  unlock: { type: 'story', value: 'chapter-3' },
  assets: extractedAssets('assets/cards/dantes_world/'),
  fallback: {
    back: { base: '#3b1d2e', accent: '#e6a3b8', pattern: 'stripe', mark: 'D' },
    face: { paper: '#fbf6f0', red: '#b33a4a', black: '#22161c' },
  },
  variants: [],
};
