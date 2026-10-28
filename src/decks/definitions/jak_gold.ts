import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const JakGoldDeck: DeckDefinition = {
  id: 'jak_gold',
  name: 'BlackJak Jak Gold',
  description: 'Celestial court cards with globes and starry robes, a winged-heart ace and a night-sky back.',
  artist: studioCredit(),
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'level', value: 4 },
  assets: extractedAssets('assets/cards/jak_gold/'),
  fallback: {
    back: { base: '#3a2d12', accent: '#e0b54a', pattern: 'sunburst', mark: 'J' },
    face: { paper: '#fffaf0', red: '#b0362a', black: '#231c10' },
  },
  variants: [],
};
