import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const ClassicDeck: DeckDefinition = {
  id: 'classic',
  name: 'BlackJak Standard',
  description: 'A traditional deck with crisp pips and classic court cards. The everyday house deck.',
  artist: studioCredit(),
  rarity: 'common',
  contentRating: 'general',
  unlock: { type: 'default' },
  assets: extractedAssets('assets/cards/classic/'),
  fallback: {
    back: { base: '#1f3a5f', accent: '#e9dcc0', pattern: 'diamond', mark: '♠' },
    face: { paper: '#fffdf7', red: '#c0392b', black: '#1d1d1f' },
  },
  variants: [],
};
