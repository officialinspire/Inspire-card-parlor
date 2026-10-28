import { standardAssets } from '../assets';
import type { DeckDefinition } from '../types';

export const YummyholeAfterDarkDeck: DeckDefinition = {
  id: 'yummyhole_after_dark',
  name: 'Yummyhole After Dark',
  description: 'Yummyhole After Dark deck. Description to be supplied with the commissioned artwork.',
  artist: { name: null, note: 'Adult-themed. Hidden until enabled in Settings; never used in ordinary previews.' },
  rarity: 'epic',
  contentRating: 'mature',
  unlock: { type: 'level', value: 6 },
  assets: standardAssets('assets/cards/mature/yummyhole_after_dark/'),
  fallback: {
    back: { base: '#1b1424', accent: '#c86bb0', pattern: 'dots', mark: 'Y' },
    face: { paper: '#f7f2f8', red: '#c0306f', black: '#1b1424' },
  },
  variants: [],
};
