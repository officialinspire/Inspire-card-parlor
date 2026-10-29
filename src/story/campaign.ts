import type { GameId } from '@/core/types';
import type { Difficulty } from '@/games/goFish/GoFishGame';

/**
 * THE CARD PARLOR CHRONICLES — the story campaign, as data.
 *
 * Seven chapters of five challenges. A challenge is always a normal game on
 * one of the five engines with a fixed set-up (options, deck, board and, for
 * solitaire and War, a verified deal) and an objective read from the game's
 * result. Story Mode never changes how a game is played.
 *
 * Every seeded deal below has been proven winnable (see src/story/verify.ts
 * and tests/unit/story.test.ts): solitaire seeds by the solver, War seeds by
 * simulating the whole game. Go Fish challenges are dealt fresh on each try
 * at an Easy table and their objectives are checked to be reachable.
 */

export type StoryRewardKind = 'credits' | 'xp' | 'deck' | 'board' | 'variant' | 'stamp' | 'achievement';

export type StoryReward =
  | { kind: 'credits'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'deck'; id: string }
  | { kind: 'board'; id: string }
  /** Alternate card art, as "deckId@variantId". */
  | { kind: 'variant'; id: string }
  | { kind: 'stamp'; id: string }
  | { kind: 'achievement'; id: string };

export type StoryObjective =
  | { kind: 'win' }
  /** Go Fish: lay down at least `min` books (winning is not required). */
  | { kind: 'books'; min: number };

export interface LevelSetup {
  /** Fixed deal. Required for solitaire and War (verified winnable); Go Fish deals fresh. */
  seed?: number;
  options?: {
    draw?: 1 | 3;
    suits?: 1 | 2 | 4;
    /** War opponent, or Go Fish opponents (personality ids). */
    opponent?: string;
    opponents?: string[];
    difficulty?: Difficulty;
  };
  /** Theme for the table (does not unlock the deck or board). */
  deckId: string;
  boardId: string;
}

export interface DialogueLine {
  /** Character id (CHARACTERS) or a CPU personality id. */
  who: string;
  text: string;
}

export interface StoryLevel {
  id: string;
  number: number;
  title: string;
  game: GameId;
  objective: StoryObjective;
  /** Short line shown on the level card. */
  objectiveText: string;
  setup: LevelSetup;
  intro: DialogueLine[];
  rewards: StoryReward[];
  finale?: boolean;
}

export interface ChapterArtwork {
  /** Painting behind the chapter card (public asset path), if any. */
  backdrop?: string;
  /** Decks whose real preview art is shown on the card. */
  decks: string[];
  /** Base colour for the card. */
  tint: string;
  /** Set while the chapter's own artwork has not been supplied. */
  placeholder?: string;
}

export interface StoryChapter {
  id: string;
  index: number;
  title: string;
  location: string;
  description: string;
  hostId: string;
  artwork: ChapterArtwork;
  intro: DialogueLine[];
  outro: DialogueLine[];
  levels: StoryLevel[];
  rewards: StoryReward[];
  unlockRequirements: { chapter?: string; level?: number };
}

export interface Character {
  id: string;
  name: string;
  role: string;
  color: string;
}

export const CAMPAIGN_TITLE = 'The Card Parlor Chronicles';

/** The parlor's regulars. Portraits are drawn as initials until character art is supplied. */
export const CHARACTERS: readonly Character[] = [
  { id: 'mae', name: 'Mae Holloway', role: 'Parlor owner', color: '#e2b866' },
  { id: 'jules', name: 'Jules Arden', role: 'Card sharp', color: '#7fb8d8' },
  { id: 'otto', name: 'Uncle Otto', role: 'Retired dealer', color: '#c98a5b' },
  { id: 'ivy', name: 'Ivy Song', role: 'Pianist', color: '#d48bb0' },
];

const credits = (amount: number): StoryReward => ({ kind: 'credits', amount });
const xp = (amount: number): StoryReward => ({ kind: 'xp', amount });

/** Short-hand for a level; ids are "<chapter>-<n>". */
function level(
  chapter: string,
  number: number,
  l: Omit<StoryLevel, 'id' | 'number' | 'rewards' | 'objectiveText' | 'objective'> & {
    objective?: StoryObjective;
    rewards?: StoryReward[];
    objectiveText?: string;
  },
): StoryLevel {
  const base = 40 + number * 10;
  return {
    ...l,
    id: `${chapter}-${number}`,
    number,
    objective: l.objective ?? { kind: 'win' },
    objectiveText: l.objectiveText ?? 'Win the game.',
    rewards: l.rewards ?? [credits(base), xp(base + 20)],
  };
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    id: 'chapter-1',
    index: 1,
    title: 'The Hometown',
    location: 'Downtown Fredericksburg',
    description: 'The parlor reopens on Caroline Street. Win over the neighbours, one table at a time.',
    hostId: 'mae',
    artwork: {
      backdrop: 'backgrounds/menu/day.webp',
      decks: ['fredericksburg', 'fredericksburg_downtown'],
      tint: '#c88a4a',
    },
    intro: [
      { who: 'mae', text: 'Keys, lamps, a fresh deck. The parlor’s open again!' },
      { who: 'mae', text: 'Win five tables and the whole street will know it.' },
    ],
    outro: [{ who: 'mae', text: 'Look at that — a full house. Fredericksburg is ours again.' }],
    levels: [
      level('chapter-1', 1, {
        title: 'Riverfront Warm-Up',
        game: 'war',
        setup: {
          seed: 2007,
          options: { opponent: 'friendly_local' },
          deckId: 'fredericksburg',
          boardId: 'picnic_table',
        },
        intro: [{ who: 'mae', text: 'Start easy: high card wins. Show the regulars how it’s done.' }],
      }),
      level('chapter-1', 2, {
        title: 'Caroline Street Klondike',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1008, options: { draw: 1 }, deckId: 'fredericksburg', boardId: 'backroom_card_table' },
        intro: [{ who: 'mae', text: 'A quiet morning game. Build the foundations, Ace to King.' }],
      }),
      level('chapter-1', 3, {
        title: 'Market Square Catch',
        game: 'go-fish',
        objectiveText: 'Win Go Fish against one opponent.',
        setup: {
          options: { opponents: ['friendly_local'], difficulty: 'easy' },
          deckId: 'fredericksburg_downtown',
          boardId: 'picnic_table',
        },
        intro: [{ who: 'friendly_local', text: 'Market day! Fancy a hand of Go Fish?' }],
      }),
      level('chapter-1', 4, {
        title: 'The Old Mill Puzzle',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1001, deckId: 'fredericksburg_downtown', boardId: 'backroom_card_table' },
        intro: [{ who: 'otto', text: 'Every card in view, nothing left to luck. Take your time.' }],
      }),
      level('chapter-1', 5, {
        title: 'Rappahannock Weave',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: {
          seed: 1035,
          options: { suits: 1 },
          deckId: 'fredericksburg_downtown',
          boardId: 'rappahannock_riverside',
        },
        intro: [{ who: 'mae', text: 'Down by the river, one last spread. Eight runs, King to Ace.' }],
        rewards: [credits(120), xp(150)],
      }),
    ],
    rewards: [
      { kind: 'deck', id: 'fredericksburg_downtown' },
      { kind: 'board', id: 'rappahannock_riverside' },
      { kind: 'stamp', id: 'hometown' },
      { kind: 'achievement', id: 'passport-first' },
      credits(300),
      xp(200),
    ],
    unlockRequirements: {},
  },
  {
    id: 'chapter-2',
    index: 2,
    title: 'Jak Gold’s Casino',
    location: 'The BlackJak universe',
    description: 'A golden invitation arrives. Jak Gold wants to see what the new parlor can do.',
    hostId: 'jak_gold',
    artwork: {
      backdrop: 'backgrounds/backroom_card_table/background.webp',
      decks: ['jak_gold', 'inspire'],
      tint: '#2c2a3a',
    },
    intro: [
      { who: 'jak_gold', text: 'So you’re the one reopening the old parlor. Cute.' },
      { who: 'jak_gold', text: 'Five tables at my place. Beat them and I’ll deal you in.' },
    ],
    outro: [{ who: 'jak_gold', text: 'Not bad, newcomer. The house remembers a winner.' }],
    levels: [
      level('chapter-2', 1, {
        title: 'High Card at the Door',
        game: 'war',
        setup: { seed: 2030, options: { opponent: 'jak_gold' }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [{ who: 'jak_gold', text: 'Doorman’s game. Flip and pray.' }],
      }),
      level('chapter-2', 2, {
        title: 'Three-Card Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1010, options: { draw: 3 }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [{ who: 'jak_gold', text: 'Three at a time, like the pros. Keep up.' }],
      }),
      level('chapter-2', 3, {
        title: 'Fishing for Chips',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Jak Gold.',
        setup: {
          options: { opponents: ['jak_gold'], difficulty: 'easy' },
          deckId: 'jak_gold',
          boardId: 'backroom_card_table',
        },
        intro: [{ who: 'jak_gold', text: 'Go Fish? In my casino? Fine. Bank three books.' }],
      }),
      level('chapter-2', 4, {
        title: 'The Vault',
        game: 'freecell',
        objectiveText: 'Crack this FreeCell deal.',
        setup: { seed: 1016, deckId: 'inspire', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'Psst — the vault’s a FreeCell lock. Four cells, no luck.' }],
      }),
      level('chapter-2', 5, {
        title: 'All In',
        game: 'war',
        finale: true,
        objectiveText: 'Finale: take every card from Jak Gold.',
        setup: { seed: 2035, options: { opponent: 'jak_gold' }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [{ who: 'jak_gold', text: 'All fifty-two on the felt. Winner takes the deck.' }],
        rewards: [credits(140), xp(170)],
      }),
    ],
    rewards: [
      { kind: 'deck', id: 'jak_gold' },
      { kind: 'board', id: 'jak_golds_casino' },
      { kind: 'stamp', id: 'casino' },
      credits(400),
      xp(250),
    ],
    unlockRequirements: { chapter: 'chapter-1' },
  },
  {
    id: 'chapter-3',
    index: 3,
    title: 'Dante’s World',
    location: 'Neon Monster country',
    description: 'A deck of grinning neon monsters turns up in the lost and found. It wants to play.',
    hostId: 'jules',
    artwork: { backdrop: 'backgrounds/menu/night.webp', decks: ['dantes_world'], tint: '#2a1240' },
    intro: [
      { who: 'jules', text: 'This deck winked at me. Cards shouldn’t wink.' },
      { who: 'jules', text: 'Play its five games and maybe it’ll settle down.' },
    ],
    outro: [{ who: 'jules', text: 'It’s purring now. I think it likes you.' }],
    levels: [
      level('chapter-3', 1, {
        title: 'Eye of the Spider',
        game: 'spider',
        objectiveText: 'Clear one-suit Spider.',
        setup: { seed: 1003, options: { suits: 1 }, deckId: 'dantes_world', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'Eight runs. Don’t stare back at the eyeballs.' }],
      }),
      level('chapter-3', 2, {
        title: 'Monster Pond',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against two opponents.',
        setup: {
          options: { opponents: ['friendly_local', 'strategic'], difficulty: 'easy' },
          deckId: 'dantes_world',
          boardId: 'picnic_table',
        },
        intro: [{ who: 'friendly_local', text: 'Something in this pond has teeth. Three books and we’re out.' }],
      }),
      level('chapter-3', 3, {
        title: 'Neon Columns',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1013, options: { draw: 1 }, deckId: 'dantes_world', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'Seven glowing columns. Red on black, black on red.' }],
      }),
      level('chapter-3', 4, {
        title: 'Clash of the Kings',
        game: 'war',
        setup: {
          seed: 2026,
          options: { opponent: 'strategic' },
          deckId: 'dantes_world',
          boardId: 'rappahannock_riverside',
        },
        intro: [{ who: 'strategic', text: 'Your monsters against mine. May the higher card win.' }],
      }),
      level('chapter-3', 5, {
        title: 'Monster Mash',
        game: 'freecell',
        finale: true,
        objectiveText: 'Finale: solve the monsters’ FreeCell.',
        setup: { seed: 1018, deckId: 'dantes_world', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'Last one. Put every monster back in its suit.' }],
        rewards: [credits(150), xp(180)],
      }),
    ],
    rewards: [{ kind: 'deck', id: 'dantes_world' }, { kind: 'stamp', id: 'dantes-world' }, credits(450), xp(280)],
    unlockRequirements: { chapter: 'chapter-2' },
  },
  {
    id: 'chapter-4',
    index: 4,
    title: 'The Woodlands',
    location: 'Eastern Woodland Virginia',
    description: 'Uncle Otto takes the cards upriver, into the forests and along the Rappahannock.',
    hostId: 'otto',
    artwork: {
      backdrop: 'backgrounds/rappahannock_riverside/background.webp',
      decks: ['eastern_woodlands'],
      tint: '#33452d',
    },
    intro: [
      { who: 'otto', text: 'Pack light. We’re playing under the trees today.' },
      { who: 'otto', text: 'Mind the river; it’s been known to take a card or two.' },
    ],
    outro: [{ who: 'otto', text: 'Fine playing. The woods will keep a seat for you.' }],
    levels: [
      level('chapter-4', 1, {
        title: 'Trailhead Klondike',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1017, options: { draw: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [{ who: 'otto', text: 'A gentle start. Let the deck show you the trail.' }],
      }),
      level('chapter-4', 2, {
        title: 'Bear Creek Battle',
        game: 'war',
        setup: {
          seed: 2001,
          options: { opponent: 'friendly_local' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [{ who: 'friendly_local', text: 'Out here, even War feels friendly.' }],
      }),
      level('chapter-4', 3, {
        title: 'The Heron’s Web',
        game: 'spider',
        objectiveText: 'Clear one-suit Spider.',
        setup: { seed: 1002, options: { suits: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [{ who: 'otto', text: 'Patience, like the heron. Eight runs.' }],
      }),
      level('chapter-4', 4, {
        title: 'Riverbank Fishing',
        game: 'go-fish',
        objectiveText: 'Win Go Fish against one opponent.',
        setup: {
          options: { opponents: ['friendly_local'], difficulty: 'easy' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [{ who: 'otto', text: 'Real fishing’s slow. This kind is faster.' }],
      }),
      level('chapter-4', 5, {
        title: 'Campfire FreeCell',
        game: 'freecell',
        finale: true,
        objectiveText: 'Finale: solve FreeCell by the fire.',
        setup: { seed: 1003, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [{ who: 'otto', text: 'One more by firelight, then home.' }],
        rewards: [credits(160), xp(190)],
      }),
    ],
    rewards: [
      { kind: 'deck', id: 'eastern_woodlands' },
      { kind: 'variant', id: 'eastern_woodlands@turtle' },
      { kind: 'board', id: 'woodland_clearing' },
      { kind: 'stamp', id: 'woodlands' },
      { kind: 'achievement', id: 'halfway-home' },
      credits(500),
      xp(300),
    ],
    unlockRequirements: { chapter: 'chapter-3' },
  },
  {
    id: 'chapter-5',
    index: 5,
    title: 'The Safehouse',
    location: 'A back room with no name on the door',
    description: 'Someone has been leaving coded cards under the parlor door. Time to answer.',
    hostId: 'jules',
    artwork: { backdrop: 'backgrounds/menu/night.webp', decks: ['spycraft'], tint: '#1d2328' },
    intro: [
      { who: 'jules', text: 'Coded cards. Fingerprint aces. Somebody’s testing us.' },
      { who: 'jules', text: 'We play their five games, we find the safehouse.' },
    ],
    outro: [{ who: 'jules', text: 'Message received. And our new friends want a rematch.' }],
    levels: [
      level('chapter-5', 1, {
        title: 'Dead Drop',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1017, deckId: 'spycraft', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'The drop is a FreeCell. Clean, quiet, no witnesses.' }],
      }),
      level('chapter-5', 2, {
        title: 'Codebreaker',
        game: 'war',
        setup: { seed: 2010, options: { opponent: 'strategic' }, deckId: 'spycraft', boardId: 'backroom_card_table' },
        intro: [{ who: 'strategic', text: 'Every card a cipher. Every war a negotiation.' }],
      }),
      level('chapter-5', 3, {
        title: 'Cipher Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1013, options: { draw: 3 }, deckId: 'spycraft', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'Three cards at a time. The pattern’s in there.' }],
      }),
      level('chapter-5', 4, {
        title: 'Debrief',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against the Strategist.',
        setup: {
          options: { opponents: ['strategic'], difficulty: 'easy' },
          deckId: 'spycraft',
          boardId: 'backroom_card_table',
        },
        intro: [{ who: 'strategic', text: 'Questions, questions. Got any sevens?' }],
      }),
      level('chapter-5', 5, {
        title: 'The Web of Eight',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1009, options: { suits: 1 }, deckId: 'spycraft', boardId: 'backroom_card_table' },
        intro: [{ who: 'jules', text: 'The safehouse door has eight locks. Spider opens them all.' }],
        rewards: [credits(170), xp(200)],
      }),
    ],
    rewards: [
      { kind: 'deck', id: 'spycraft' },
      { kind: 'board', id: 'safehouse' },
      { kind: 'stamp', id: 'safehouse' },
      credits(550),
      xp(320),
    ],
    unlockRequirements: { chapter: 'chapter-4' },
  },
  {
    id: 'chapter-6',
    index: 6,
    title: 'The Builders',
    location: 'The old lodge on Princess Anne Street',
    description: 'Uncle Otto’s old friends keep a study full of compasses, squares and very old card tables.',
    hostId: 'otto',
    artwork: {
      decks: ['classic'],
      tint: '#24304a',
      placeholder: 'Freemasonry artwork coming soon',
    },
    intro: [
      { who: 'otto', text: 'The builders measure twice and deal once.' },
      { who: 'otto', text: 'Their deck isn’t finished yet, so we’ll use the house cards.' },
    ],
    outro: [{ who: 'otto', text: 'Square and level. They’ve given you a key to the study.' }],
    levels: [
      level('chapter-6', 1, {
        title: 'Cornerstone',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1021, options: { draw: 1 }, deckId: 'classic', boardId: 'backroom_card_table' },
        intro: [{ who: 'otto', text: 'Lay the first stone: Aces up.' }],
      }),
      level('chapter-6', 2, {
        title: 'Level and Plumb',
        game: 'war',
        setup: {
          seed: 2021,
          options: { opponent: 'friendly_local' },
          deckId: 'classic',
          boardId: 'backroom_card_table',
        },
        intro: [{ who: 'friendly_local', text: 'Straight and fair: the higher card builds.' }],
      }),
      level('chapter-6', 3, {
        title: 'The Compass Rose',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1009, deckId: 'classic', boardId: 'backroom_card_table' },
        intro: [{ who: 'otto', text: 'Four cells, four corners. Plan every move.' }],
      }),
      level('chapter-6', 4, {
        title: 'Lodge Night',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against two opponents.',
        setup: {
          options: { opponents: ['friendly_local', 'strategic'], difficulty: 'easy' },
          deckId: 'classic',
          boardId: 'picnic_table',
        },
        intro: [{ who: 'otto', text: 'Members’ night. Bring three books to the table.' }],
      }),
      level('chapter-6', 5, {
        title: 'The Keystone',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1014, options: { suits: 1 }, deckId: 'classic', boardId: 'backroom_card_table' },
        intro: [{ who: 'otto', text: 'The keystone holds the arch. Eight runs hold this one.' }],
        rewards: [credits(180), xp(210)],
      }),
    ],
    rewards: [{ kind: 'board', id: 'masonic_study' }, { kind: 'stamp', id: 'builders' }, credits(600), xp(340)],
    unlockRequirements: { chapter: 'chapter-5' },
  },
  {
    id: 'chapter-7',
    index: 7,
    title: 'Artist’s Alley',
    location: 'The studios behind the parlor',
    description: 'The people who draw the cards open their studios for one night only.',
    hostId: 'ivy',
    artwork: {
      backdrop: 'backgrounds/picnic_table/background.webp',
      decks: ['inspire', 'classic'],
      tint: '#c8643f',
    },
    intro: [
      { who: 'ivy', text: 'Every deck you’ve played started on someone’s drawing table.' },
      { who: 'ivy', text: 'Tonight the studios are open. Let’s play in all of them.' },
    ],
    outro: [
      { who: 'ivy', text: 'That’s the whole alley. The parlor’s story is yours now.' },
      { who: 'mae', text: 'Welcome home, partner.' },
    ],
    levels: [
      level('chapter-7', 1, {
        title: 'Open Studio',
        game: 'go-fish',
        objective: { kind: 'books', min: 2 },
        objectiveText: 'Lay down 2 books against three opponents.',
        setup: {
          options: { opponents: ['jak_gold', 'friendly_local', 'strategic'], difficulty: 'easy' },
          deckId: 'inspire',
          boardId: 'picnic_table',
        },
        intro: [{ who: 'ivy', text: 'Everybody’s here! A big table of Go Fish to start.' }],
      }),
      level('chapter-7', 2, {
        title: 'Ink and Paper',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1018, options: { draw: 3 }, deckId: 'inspire', boardId: 'picnic_table' },
        intro: [{ who: 'ivy', text: 'Black and white INSPIRE cards. Clean lines only.' }],
      }),
      level('chapter-7', 3, {
        title: 'Print Run',
        game: 'war',
        setup: { seed: 2024, options: { opponent: 'jak_gold' }, deckId: 'classic', boardId: 'picnic_table' },
        intro: [{ who: 'jak_gold', text: 'Even I started with a standard deck. Prove it still bites.' }],
      }),
      level('chapter-7', 4, {
        title: 'The Proof Sheet',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1019, deckId: 'inspire', boardId: 'picnic_table' },
        intro: [{ who: 'ivy', text: 'Check every card on the proof before it goes to print.' }],
      }),
      level('chapter-7', 5, {
        title: 'Gallery Opening',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1001, options: { suits: 1 }, deckId: 'inspire', boardId: 'picnic_table' },
        intro: [{ who: 'ivy', text: 'Last piece for the gallery wall. Make it count.' }],
        rewards: [credits(200), xp(240)],
      }),
    ],
    rewards: [
      { kind: 'board', id: 'artists_studio' },
      { kind: 'stamp', id: 'artists-alley' },
      { kind: 'achievement', id: 'chronicles-complete' },
      credits(800),
      xp(400),
    ],
    unlockRequirements: { chapter: 'chapter-6' },
  },
];

/** Passport stamps, one per chapter. */
export const STAMPS: readonly { id: string; chapter: string; label: string }[] = STORY_CHAPTERS.flatMap((c) =>
  c.rewards.flatMap((r) => (r.kind === 'stamp' ? [{ id: r.id, chapter: c.id, label: c.title }] : [])),
);

export const ALL_LEVELS: readonly StoryLevel[] = STORY_CHAPTERS.flatMap((c) => c.levels);

export const getChapter = (id: string) => STORY_CHAPTERS.find((c) => c.id === id);
export const getLevel = (id: string) => ALL_LEVELS.find((l) => l.id === id);
export const chapterOfLevel = (levelId: string) => STORY_CHAPTERS.find((c) => c.levels.some((l) => l.id === levelId));
