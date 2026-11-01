import type { Evidence } from './types';

/**
 * Collectible evidence: what the player finds, chapter by chapter. Pictures
 * are story sprites cut from the uploaded artwork (ids are "sheet/name").
 *
 * The central puzzle: the Thirteenth Hand card has four blank corners. One
 * suit mark is found in each of chapters 2–5 (clubs at the river, hearts in
 * Dante's commission, diamonds in Jak's footage, spades in Mrs. Gray's
 * dossier); the tunnels' sealed door needs all four.
 *
 * Chapters 1–2 are written; later entries are draft outlines.
 */
export const EVIDENCE: readonly Evidence[] = [
  // Chapter 1 — Cheryl's Antique Shop
  {
    id: 'thirteenth-hand-card',
    name: 'The Thirteenth Hand',
    chapter: 'th-1',
    kind: 'card',
    description:
      'An antique playing card with no suit and no rank, titled “The Thirteenth Hand”. Its four corners are blank where suit marks should be.',
    sprite: 'thirteenth-hand-antique-card/thirteenth-hand-antique-card',
    status: 'final',
  },
  {
    id: 'estate-sale-receipt',
    name: 'Estate-sale receipt',
    chapter: 'th-1',
    kind: 'document',
    description: 'Cheryl’s receipt for the box: “Lot 13 — one card box, contents as found. Paid in full.”',
    sprite: 'cheryls-antique-store-receipt/cheryls-antique-store-receipt',
    status: 'final',
  },
  {
    id: 'ledger-of-twelve',
    name: 'Ledger of twelve hands',
    chapter: 'th-1',
    kind: 'document',
    description:
      'A leather ledger from the box. Twelve hands of cards are recorded in faded ink; the thirteenth line is blank.',
    sprite: 'mystery-parlor/leather-journal',
    status: 'final',
  },
  {
    id: 'river-postcard',
    name: 'River postcard',
    chapter: 'th-1',
    kind: 'document',
    description:
      'An old postcard of the Rappahannock. Someone has sketched a heron on the back in pencil and written: “River Station.”',
    sprite: 'mystery-parlor/old-town-postcard',
    status: 'final',
  },

  // Chapter 2 — Sophia's Rappahannock River Station
  {
    id: 'field-journal-page',
    name: 'Field journal page',
    chapter: 'th-2',
    kind: 'document',
    description:
      'A page from the station’s wildlife log: the same heron, logged at the same bend of the river, every morning.',
    sprite: 'river-ranger/field-journal',
    status: 'final',
  },
  {
    id: 'club-mark',
    name: 'The club mark',
    chapter: 'th-2',
    kind: 'object',
    description:
      'A small club (♣) carved into an old trail marker at the heron’s bend. It matches one blank corner of the card exactly.',
    sprite: 'river-ranger/trail-marker-post',
    status: 'final',
  },
  {
    id: 'returned-envelope',
    name: 'Returned envelope',
    chapter: 'th-2',
    kind: 'document',
    description:
      'An envelope from the station’s lost-and-found, addressed to Dante at iSMOKESHOP and marked “Return to sender”. Inside: a card with a heron on it.',
    sprite: 'river-ranger/envelope-with-card',
    status: 'final',
  },
  {
    id: 'old-river-map',
    name: 'Old river map',
    chapter: 'th-2',
    kind: 'document',
    description:
      'A hand-drawn map of the river and the old town. Four small marks sit near the waterfront; Sophia cannot match them to any survey she knows.',
    sprite: 'river-ranger/old-river-map',
    status: 'final',
  },

  // Chapter 3 — Dante's iSMOKESHOP (draft)
  {
    id: 'commission-form',
    name: 'Anonymous commission form',
    chapter: 'th-3',
    kind: 'document',
    description: 'Draft: an anonymous order for thirteen neon monster card designs, paid in advance.',
    sprite: 'dantes-gw-commission-form/dantes-gw-commission-form',
    status: 'draft',
  },
  {
    id: 'heart-mark',
    name: 'The heart mark',
    chapter: 'th-3',
    kind: 'object',
    description: 'Draft: a heart (♥) hidden in the reference sketch the commission asked Dante to copy.',
    sprite: 'neon-art-supplies/monster-sketch-page',
    status: 'draft',
  },

  // Chapter 4 — Jak's Backroom Card Parlor (draft)
  {
    id: 'cardistry-receipt',
    name: 'Jak’s cardistry receipt',
    chapter: 'th-4',
    kind: 'document',
    description: 'Draft: a receipt for a custom card case, ordered under the same name as the commission.',
    sprite: 'jaks-cardistry-receipt/jaks-cardistry-receipt',
    status: 'draft',
  },
  {
    id: 'diamond-mark',
    name: 'The diamond mark',
    chapter: 'th-4',
    kind: 'recording',
    description: 'Draft: Jak’s slow-motion footage of a flourish shows a diamond (♦) printed inside the card’s edge.',
    sprite: 'jak-black-gold/smartphone-recording',
    status: 'draft',
  },

  // Chapter 5 — Mrs. Gray's Intelligence Safehouse (draft)
  {
    id: 'thirteenth-hand-dossier',
    name: 'Operation Thirteenth Hand dossier',
    chapter: 'th-5',
    kind: 'document',
    description: 'Draft: a fictional dossier. The operation borrowed an old local legend as cover.',
    sprite: 'mrs-grays-thirteenth-hand-dossier/mrs-grays-thirteenth-hand-dossier',
    status: 'draft',
  },
  {
    id: 'spade-mark',
    name: 'The spade mark',
    chapter: 'th-5',
    kind: 'card',
    description: 'Draft: the ace of spades from the dossier, with a spade (♠) matching the last blank corner.',
    sprite: 'cold-war-spycraft/spycraft-ace-of-spades',
    status: 'draft',
  },

  // Chapter 6 — Fredericksburg Masonic Lodge No. 4 (draft)
  {
    id: 'lodge-sketchbook-page',
    name: 'Steve’s research sketch',
    chapter: 'th-6',
    kind: 'document',
    description:
      'Draft: Steve’s notes separating the lodge’s documented history from the cipher invented by the legend’s later borrowers.',
    sprite: 'lodge-research-sketchbook-page/lodge-research-sketchbook-page',
    status: 'draft',
  },

  // Chapter 7 — Kenmore (draft)
  {
    id: 'kenmore-iron-key',
    name: 'Iron key',
    chapter: 'th-7',
    kind: 'object',
    description: 'Draft: an iron key Mary Ball Washington’s ghost entrusts to you.',
    sprite: 'kenmore-heirlooms/iron-key',
    status: 'draft',
  },

  // Chapter 8 — The Underground Tunnels (draft)
  {
    id: 'four-suit-puzzle',
    name: 'The four-suit door',
    chapter: 'th-8',
    kind: 'object',
    description: 'Draft: the sealed door’s four-suit lock, opened with all four marks.',
    sprite: 'underground-four-suit-puzzle/underground-four-suit-puzzle',
    status: 'draft',
  },

  // Chapter 9 — Washington's Spectral Card Parlor (draft)
  {
    id: 'awakened-card',
    name: 'The awakened card',
    chapter: 'th-9',
    kind: 'card',
    description: 'Draft: the Thirteenth Hand card with all four corners filled, after the final game.',
    sprite: 'awakened-thirteenth-hand-card/awakened-thirteenth-hand-card',
    status: 'draft',
  },
];

export const getEvidence = (id: string) => EVIDENCE.find((e) => e.id === id);
