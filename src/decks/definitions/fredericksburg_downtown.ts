import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const FredericksburgDowntownDeck: DeckDefinition = {
  id: 'fredericksburg_downtown',
  name: 'Downtown Fredericksburg Collector',
  description:
    'Watercolour landmarks of downtown Fredericksburg and the Rappahannock on every card, with colonial court cards.',
  artist: studioCredit(),
  rarity: 'epic',
  contentRating: 'general',
  unlock: { type: 'level', value: 5 },
  assets: extractedAssets('assets/cards/fredericksburg_downtown/'),
  fallback: {
    back: { base: '#1f3557', accent: '#e9dfc6', pattern: 'diamond', mark: 'F' },
    face: { paper: '#fbf7ee', red: '#b3352c', black: '#1f2430' },
  },
  variants: [],
};
