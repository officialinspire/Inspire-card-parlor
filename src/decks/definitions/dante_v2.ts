import { uploadedPngAssets, studioCredit } from '../assets';
import type { DeckDefinition } from '../types';
import { DantesWorldDeck } from './dantes_world';
export const DanteV2Deck: DeckDefinition = {
  ...DantesWorldDeck,
  id: 'dante_v2',
  name: 'Dante V2',
  description: 'A second collection of Dante’s neon monsters with a custom illustrated back.',
  artist: studioCredit(),
  contentRating: 'general',
  unlock: { type: 'credits', value: 500 },
  assets: uploadedPngAssets('assets/cards/dante_v2/'),
  variants: [],
};
