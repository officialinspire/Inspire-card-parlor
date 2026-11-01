import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

/**
 * Faces: "Engraved Georgian 52-card deck atlas" (square-and-compasses aces,
 * colonial craftsmen as court cards); back: the navy-gold square-and-compasses
 * back. Built by extract_cards.py; five misprinted bottom indices are corrected
 * in the build (see atlas.json indexFixes) and the four 5s show four pips.
 */
export const FreemasonryDeck: DeckDefinition = {
  id: 'freemasonry',
  name: 'Freemasonry',
  description:
    'Engraved Georgian cards with square-and-compasses aces, lodge craftsmen on the court cards and a navy-and-gold back.',
  artist: studioCredit(),
  rarity: 'legendary',
  contentRating: 'general',
  // Unchanged from before the artwork arrived, so saves keep their unlock state.
  unlock: { type: 'level', value: 12 },
  assets: extractedAssets('assets/cards/freemasonry/'),
  fallback: {
    back: { base: '#14234a', accent: '#d9b45a', pattern: 'sunburst', mark: 'F' },
    face: { paper: '#fbf8f0', red: '#a8323a', black: '#141a2a' },
  },
  variants: [],
};
