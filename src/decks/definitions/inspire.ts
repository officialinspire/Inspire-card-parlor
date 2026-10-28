import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const InspireDeck: DeckDefinition = {
  id: 'inspire',
  name: 'BlackJak INSPIRE',
  description: 'Bold black-and-white INSPIRE design: leaf-mark aces, branded court cards and the INSPIRE back.',
  artist: studioCredit(),
  rarity: 'common',
  contentRating: 'general',
  unlock: { type: 'default' },
  assets: extractedAssets('assets/cards/inspire/'),
  fallback: {
    back: { base: '#c8643f', accent: '#fbe3cf', pattern: 'plain', mark: 'I' },
    face: { paper: '#fffaf1', red: '#b8432f', black: '#2f2a24' },
  },
  variants: [],
};
