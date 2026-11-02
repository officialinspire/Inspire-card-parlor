import type { Evidence } from './types';

/**
 * Collectible evidence: what the player finds, chapter by chapter. Pictures
 * are story sprites cut from the uploaded artwork (ids are "sheet/name").
 *
 * The central puzzle: the Thirteenth Hand card has four blank corners. One
 * suit mark is found in each of chapters 2–5 (clubs at the river, hearts in
 * Dante's commission, diamonds in Jak's footage, spades in Mrs. Gray's
 * dossier); the tunnels' sealed door needs all four, set in the order Steve
 * reads in Chapter 6 (spade, diamond, heart, club).
 *
 * Every clue is used later: each one points to the next place or person, or
 * is shown again (Dante's card and Mary's letter in Chapter 9).
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
    importance: 'key',
    status: 'final',
  },
  {
    id: 'estate-sale-receipt',
    name: 'Estate-sale receipt',
    chapter: 'th-1',
    kind: 'document',
    description: 'Cheryl’s receipt for the box: “Lot 13 — one card box, contents as found. Paid in full.”',
    sprite: 'cheryls-antique-store-receipt/cheryls-antique-store-receipt',
    importance: 'optional',
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
    importance: 'key',
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
    importance: 'key',
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
    importance: 'optional',
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
    importance: 'key',
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
    importance: 'key',
    status: 'final',
  },
  {
    id: 'sophia-river-map',
    name: 'Sophia’s annotated river map',
    chapter: 'th-2',
    kind: 'document',
    description:
      'Sophia’s own map of the river trail, covered in her field notes. Near the old waterfront, four small marks traced from an older survey are circled in pencil; one of them is a club.',
    sprite: 'rappahannock-river-map/rappahannock-river-map',
    importance: 'key',
    status: 'final',
  },

  // Chapter 3 — Dante's iSMOKESHOP
  {
    id: 'commission-form',
    name: 'Anonymous commission form',
    chapter: 'th-3',
    kind: 'document',
    description:
      'A typed order for thirteen card designs — George Washington as a neon monster — paid in advance in one-dollar bills and signed only “G. W.”',
    sprite: 'dantes-gw-commission-form/dantes-gw-commission-form',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'monster-card',
    name: 'General Monsterton',
    chapter: 'th-3',
    kind: 'card',
    description:
      'Dante’s first finished design: a three-eyed, neon-blue George Washington holding twelve cards, with a thirteenth left blank.',
    sprite: 'neon-art-supplies/monster-trading-card',
    importance: 'optional',
    status: 'final',
  },
  {
    id: 'heart-mark',
    name: 'The heart mark',
    chapter: 'th-3',
    kind: 'object',
    description:
      'A heart (♥) drawn in invisible ink in the lace cuff of the client’s reference sketch. It shows under black light and fits the card’s second blank corner.',
    sprite: 'neon-art-supplies/monster-sketch-page',
    importance: 'key',
    status: 'final',
  },

  // Chapter 4 — Jak's Backroom Card Parlor
  {
    id: 'cardistry-receipt',
    name: 'Card-case receipt',
    chapter: 'th-4',
    kind: 'document',
    description:
      'A receipt from Jak’s card-case maker: two custom cases ordered by “G. W.”, paid in ones — one shipped to Dante’s shop, one to an office with no name on the door.',
    sprite: 'jaks-cardistry-receipt/jaks-cardistry-receipt',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'redacted-reply',
    name: 'Redacted records reply',
    chapter: 'th-4',
    kind: 'document',
    description:
      'The reply to Jak’s public-records request about the old cellars: almost all black bars. One phrase survives — OPERATION THIRTEENTH HAND — with “four marks”, “waterfront” and “not concluded”.',
    sprite: 'cold-war-spycraft/redacted-document',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'diamond-mark',
    name: 'The diamond mark',
    chapter: 'th-4',
    kind: 'recording',
    description:
      'Jak’s 240-frames-a-second footage of a spring flourish: as the card flexes, a diamond (♦) printed inside its edge shows for a few frames.',
    sprite: 'jak-black-gold/smartphone-recording',
    importance: 'key',
    status: 'final',
  },

  // Chapter 5 — Mrs. Gray's Intelligence Safehouse
  {
    id: 'thirteenth-hand-dossier',
    name: 'Operation Thirteenth Hand dossier',
    chapter: 'th-5',
    kind: 'document',
    description:
      'The fictional operation’s file, opened in 1962: survey photos pin each of the four marks to a spot near the old waterfront. Its cover story was a legend — a card game George Washington never finished.',
    sprite: 'mrs-grays-thirteenth-hand-dossier/mrs-grays-thirteenth-hand-dossier',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'spade-mark',
    name: 'The spade mark',
    chapter: 'th-5',
    kind: 'card',
    description:
      'The ace of spades that sealed the dossier’s last folder. In its corner is a spade (♠) cut to fit the card’s last blank corner.',
    sprite: 'cold-war-spycraft/spycraft-ace-of-spades',
    importance: 'key',
    status: 'final',
  },

  // Chapter 6 — Fredericksburg Masonic Lodge No. 4
  {
    id: 'lodge-sketchbook-page',
    name: 'Steve’s suit-order diagram',
    chapter: 'th-6',
    kind: 'document',
    description:
      'Steve’s compasses drawing over Sophia’s map and the dossier’s survey: the four marks on the corners of a square, read downstream from the north — spade, diamond, heart, club. Labelled in his hand: “Not Masonic. Borrowed tools.”',
    sprite: 'lodge-research-sketchbook-page/lodge-research-sketchbook-page',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'ledger-impression',
    name: 'The thirteenth line',
    chapter: 'th-6',
    kind: 'document',
    description:
      'Under Steve’s raking light, the ledger’s blank thirteenth line shows words pressed into the paper by a dry pen: KENMORE — ASK MOTHER.',
    sprite: 'lodge-relics/sketch-notebook',
    importance: 'key',
    status: 'final',
  },

  // Chapter 7 — Kenmore
  {
    id: 'mary-letter',
    name: 'Mary’s letter to George',
    chapter: 'th-7',
    kind: 'document',
    description:
      'A letter sealed by Mary Ball Washington’s ghost. On the front: George. On the back: You owe me a hand. She says to give it to him when he starts to sulk.',
    sprite: 'kenmore-heirlooms/wax-sealed-letter',
    importance: 'key',
    status: 'final',
  },
  {
    id: 'kenmore-iron-key',
    name: 'Iron key',
    chapter: 'th-7',
    kind: 'object',
    description: 'A cold iron key from Mary Ball Washington’s ghost. It opens a cellar door on the old waterfront.',
    sprite: 'kenmore-heirlooms/iron-key',
    importance: 'key',
    status: 'final',
  },

  // Chapter 8 — The Underground Tunnels
  {
    id: 'neon-tunnel-map',
    name: 'Dante’s tunnel map',
    chapter: 'th-8',
    kind: 'document',
    description: 'Dante’s glowing sketch of every turn of the tunnels, with a small monster waving at each one.',
    sprite: 'neon-art-supplies/monster-sketchbook',
    importance: 'optional',
    status: 'final',
  },
  {
    id: 'four-suit-puzzle',
    name: 'The four-suit door',
    chapter: 'th-8',
    kind: 'object',
    description:
      'The sealed door under the old town. Set with the four marks — spade, diamond, heart, club — its thirteen tumblers fell from king to ace.',
    sprite: 'underground-four-suit-puzzle/underground-four-suit-puzzle',
    importance: 'key',
    status: 'final',
  },

  // Chapter 9 — Washington's Spectral Card Parlor
  {
    id: 'awakened-card',
    name: 'The awakened card',
    chapter: 'th-9',
    kind: 'card',
    description:
      'The Thirteenth Hand card after the final game, glowing at all four corners: spade, diamond, heart and club. The game is finished.',
    sprite: 'awakened-thirteenth-hand-card/awakened-thirteenth-hand-card',
    importance: 'key',
    status: 'final',
  },
];

export const getEvidence = (id: string) => EVIDENCE.find((e) => e.id === id);
