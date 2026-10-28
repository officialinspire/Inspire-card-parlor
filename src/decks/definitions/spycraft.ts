import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const SpycraftDeck: DeckDefinition = {
  id: 'spycraft',
  name: 'Spycraft',
  description:
    'Vintage espionage: agents in trench coats, fingerprint and target aces, and a gold-and-black dossier back.',
  artist: studioCredit(),
  rarity: 'epic',
  contentRating: 'general',
  unlock: { type: 'achievement', value: 'win-streak-5' },
  assets: extractedAssets('assets/cards/spycraft/'),
  fallback: {
    back: { base: '#1d2328', accent: '#9fb4c2', pattern: 'stripe', mark: 'S' },
    face: { paper: '#f5f6f4', red: '#b23a32', black: '#14181b' },
  },
  variants: [],
};
