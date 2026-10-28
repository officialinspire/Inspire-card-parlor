import { extractedAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';

export const EasternWoodlandsDeck: DeckDefinition = {
  id: 'eastern_woodlands',
  name: 'Eastern Woodlands',
  description: 'Wildlife, plants and river scenes of the Eastern Woodlands on every card, with woven-pattern backs.',
  artist: studioCredit(),
  rarity: 'rare',
  contentRating: 'general',
  unlock: { type: 'story', value: 'chapter-2' },
  assets: extractedAssets('assets/cards/eastern_woodlands/'),
  fallback: {
    back: { base: '#33452d', accent: '#d9c48f', pattern: 'diamond', mark: 'E' },
    face: { paper: '#fbf7ec', red: '#a4402c', black: '#202a1c' },
  },
  variants: [
    {
      id: 'turtle',
      name: 'Turtle Back',
      description: 'The second woven back from the Eastern Woodlands sheet, with a turtle at its centre.',
      artist: studioCredit(),
      rarity: 'rare',
      unlock: { type: 'credits', value: 150 },
      assets: { status: 'ready', back: { path: 'back_turtle', formats: ['webp'] } },
    },
  ],
};
