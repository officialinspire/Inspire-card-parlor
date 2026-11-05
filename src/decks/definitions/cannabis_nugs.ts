import { uploadedPngAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';
import { DantesWorldDeck } from './dantes_world';
export const CannabisNugsDeck: DeckDefinition = {
  ...DantesWorldDeck,
  id: 'cannabis_nugs',
  name: 'Cannabis Nugs',
  description: 'Botanical cannabis nug artwork, earned by completing the iSmokeShop chapter.',
  artist: studioCredit(),
  contentRating: 'general',
  unlock: { type: 'story', value: 'th-3' },
  assets: uploadedPngAssets('assets/cards/cannabis_nugs/'),
  variants: [],
};
