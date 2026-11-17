import { uploadedPngAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const YummyholeStandardDeck: DeckDefinition = {
  id: 'yummyhole_standard',
  name: 'YummyHole',
  description: 'Moonlit YummyHole artwork, earned by completing Jak’s Backroom chapter.',
  artist: studioCredit(),
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'story', value: 'th-4' },
  assets: uploadedPngAssets('assets/cards/yummyhole_standard/'),
  fallback: {
    back: { base: '#2f5d50', accent: '#f2c6a0', pattern: 'dots', mark: 'Y' },
    face: { paper: '#fffaf3', red: '#c2453a', black: '#1f2b28' },
  },
  variants: [],
};
