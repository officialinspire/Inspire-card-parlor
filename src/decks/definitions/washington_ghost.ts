import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

/**
 * Faces: "Spectral Washington Colonial Playing Card Atlas" (Continental Army
 * courts, Washington as the kings); back: the spectral tricorn back. Built by
 * extract_cards.py; seven misprinted bottom indices are corrected in the build
 * (see atlas.json indexFixes).
 */
export const WashingtonGhostDeck: DeckDefinition = {
  id: 'washington_ghost',
  name: "George Washington's Ghost",
  description:
    'A spectral colonial deck: Continental officers on the court cards, Washington as every king, and a ghostly tricorn back.',
  artist: studioCredit(),
  rarity: 'legendary',
  contentRating: 'general',
  // The final chapter of The Card Parlor Chronicles.
  unlock: { type: 'story', value: 'chapter-7' },
  assets: extractedAssets('assets/cards/washington_ghost/'),
  fallback: {
    back: { base: '#16233f', accent: '#9cc3ff', pattern: 'sunburst', mark: 'W' },
    face: { paper: '#faf5e8', red: '#b3262e', black: '#141b2b' },
  },
  variants: [],
};
