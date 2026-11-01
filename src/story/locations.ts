import type { StoryLocation } from './types';

/**
 * The places of THE THIRTEENTH HAND.
 *
 * Every location says what kind of place it is. Notes marked `history` are
 * documented and give a source to check; notes marked `fiction` say plainly
 * what the story invents (shops, a ranger station, a covert operation, the
 * tunnels, the ghosts), so the two are never confused.
 */
export const LOCATIONS: readonly StoryLocation[] = [
  {
    id: 'cheryls-antique-shop',
    name: 'Cheryl’s Antique Shop',
    kind: 'fictional',
    description: 'A narrow antique shop in downtown Fredericksburg, full of clocks, ledgers and estate-sale boxes.',
    boardId: 'cheryls_antique_shop',
    sprite: 'location-cheryls-antique-shop/location-cheryls-antique-shop',
    notes: [
      {
        kind: 'history',
        title: 'Fredericksburg',
        text: 'Fredericksburg was established by the Virginia General Assembly in 1728 on the Rappahannock River. Its downtown streets, including Caroline Street, are known today for their antique shops.',
        source: 'City of Fredericksburg; Fredericksburg Area Museum',
      },
      {
        kind: 'fiction',
        title: 'About this shop',
        text: 'Cheryl and her shop are invented for the story.',
      },
    ],
  },
  {
    id: 'rappahannock-river-station',
    name: 'Rappahannock River Station',
    kind: 'fictional',
    description:
      'A small Parks & Recreation ranger station on the riverbank, with field guides, maps and a heron that will not leave.',
    boardId: 'rappahannock_riverside',
    sprite: 'location-ranger-station/location-ranger-station',
    notes: [
      {
        kind: 'history',
        title: 'The Rappahannock River',
        text: 'The Rappahannock runs from the Blue Ridge Mountains to the Chesapeake Bay. Fredericksburg grew at the river’s fall line, the farthest point ships could sail upstream.',
        source: 'Friends of the Rappahannock; Virginia Department of Conservation and Recreation',
      },
      {
        kind: 'history',
        title: 'The river’s name',
        text: 'The river shares its name with the Rappahannock people. The Rappahannock Tribe, based in Virginia’s Northern Neck, was federally recognized in 2018.',
        source: 'Rappahannock Tribe; U.S. Bureau of Indian Affairs',
      },
      {
        kind: 'history',
        title: 'Ferry Farm',
        text: 'Across the river from downtown is Ferry Farm, where George Washington spent most of his boyhood.',
        source: 'George Washington’s Ferry Farm (George Washington Foundation)',
      },
      {
        kind: 'fiction',
        title: 'About this station',
        text: 'The River Station and its staff are invented for the story.',
      },
    ],
  },
  {
    id: 'ismokeshop',
    name: 'iSMOKESHOP',
    kind: 'fictional',
    description: 'Dante’s shop, where the back counter doubles as a studio for neon monster illustrations.',
    boardId: 'artists_studio',
    sprite: 'location-neon-art-shop/location-neon-art-shop',
    notes: [
      {
        kind: 'fiction',
        title: 'About this chapter',
        text: 'The story takes place at Dante’s art counter and is about his artwork. The anonymous art commission is invented for the story.',
      },
    ],
  },
  {
    id: 'jaks-backroom-parlor',
    name: 'Jak’s Backroom Card Parlor',
    kind: 'fictional',
    description:
      'A back room set up as a studio: ring lights, tripods, a felt table and a wall of filed records requests.',
    boardId: 'backroom_card_table',
    sprite: 'location-jaks-cardistry-parlor/location-jaks-cardistry-parlor',
    notes: [
      {
        kind: 'history',
        title: 'Public records',
        text: 'Anyone may request public records from Virginia public bodies under the Virginia Freedom of Information Act, and from federal agencies under the federal Freedom of Information Act.',
        source: 'Virginia FOIA Council; FOIA.gov',
      },
      {
        kind: 'fiction',
        title: 'About this parlor',
        text: 'Jak’s parlor and the records in this chapter are invented for the story.',
      },
    ],
  },
  {
    id: 'mrs-gray-safehouse',
    name: 'Mrs. Gray’s Intelligence Safehouse',
    kind: 'fictional',
    description:
      'An unmarked office above a shuttered storefront: an olive desk, a reel-to-reel recorder and very few chairs.',
    boardId: 'mrs_gray_safehouse',
    sprite: 'location-intelligence-safehouse/location-intelligence-safehouse',
    notes: [
      {
        kind: 'fiction',
        title: 'Operation Thirteenth Hand',
        text: 'Operation Thirteenth Hand is fictional. It is not a real government program, and nothing in the story describes the real work of any intelligence agency.',
      },
    ],
  },
  {
    id: 'masonic-lodge-no4',
    name: 'Fredericksburg Masonic Lodge No. 4',
    kind: 'real',
    description:
      'The historic lodge where George Washington became a Freemason. The story’s scenes inside it are fiction.',
    boardId: 'masonic_lodge_no4',
    sprite: 'location-masonic-lodge/location-masonic-lodge',
    notes: [
      {
        kind: 'history',
        title: 'Washington’s initiation',
        text: 'George Washington was initiated as a Freemason in the Fredericksburg lodge on November 4, 1752, at the age of twenty. The lodge, Fredericksburg Lodge No. 4, still meets in Fredericksburg.',
        source: 'Fredericksburg Lodge No. 4, A.F. & A.M.; George Washington’s Mount Vernon',
      },
      {
        kind: 'history',
        title: 'Washington’s spies',
        text: 'During the Revolutionary War, Washington relied on intelligence networks such as the Culper Ring, which used codes, invisible ink and dead drops around New York from 1778.',
        source: 'George Washington’s Mount Vernon; CIA Museum (public history)',
      },
      {
        kind: 'fiction',
        title: 'About this chapter',
        text: 'The cipher, the card and the lodge’s part in the mystery are invented. No secret card ceremony is a real Masonic practice.',
      },
    ],
  },
  {
    id: 'kenmore',
    name: 'Kenmore',
    kind: 'real',
    description:
      'The Georgian house built for Fielding Lewis and Betty Washington Lewis, famous for its plaster ceilings.',
    boardId: 'kenmore_parlor',
    sprite: 'location-kenmore-mansion/location-kenmore-mansion',
    notes: [
      {
        kind: 'history',
        title: 'Kenmore',
        text: 'Kenmore was built in the 1770s for Fielding Lewis and his wife, Betty Washington Lewis, George Washington’s sister. It is known for its elaborate decorative plaster ceilings.',
        source: 'Washington Heritage Museums; George Washington Foundation',
      },
      {
        kind: 'history',
        title: 'Mary Ball Washington',
        text: 'George Washington’s mother, Mary Ball Washington, did not live at Kenmore. From 1772 she lived in a house on Charles Street in Fredericksburg, near her daughter; she died in 1789 and is buried in the city.',
        source: 'Mary Washington House (Washington Heritage Museums)',
      },
      {
        kind: 'fiction',
        title: 'About this chapter',
        text: 'The ghost of Mary Ball Washington is a story character. Her visit to her daughter’s house is invented.',
      },
    ],
  },
  {
    id: 'underground-tunnels',
    name: 'The Underground Tunnels',
    kind: 'fictional',
    description: 'Brick passages under the old town, ending at a sealed door with four suits carved in it.',
    boardId: 'underground_tunnels',
    sprite: 'location-sealed-door-cellar/location-sealed-door-cellar',
    notes: [
      {
        kind: 'fiction',
        title: 'About these tunnels',
        text: 'The tunnels and the sealed door are invented for the story. They are not a documented part of Fredericksburg’s history.',
      },
    ],
  },
  {
    id: 'washington-spectral-parlor',
    name: 'Washington’s Spectral Card Parlor',
    kind: 'supernatural',
    description: 'A card room that exists only after midnight, lit by candles that do not burn down.',
    boardId: 'washington_final_table',
    sprite: 'location-generals-spectral-parlor/location-generals-spectral-parlor',
    notes: [
      {
        kind: 'fiction',
        title: 'About this parlor',
        text: 'The spectral parlor, the ghost and the unfinished “thirteenth hand” are a legend invented for the story.',
      },
    ],
  },
];

export const getLocation = (id: string) => LOCATIONS.find((l) => l.id === id);
