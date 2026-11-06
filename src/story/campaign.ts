import { CHARACTERS } from './cast';
import {
  NARRATOR,
  type DialogueLine,
  type PassportStamp,
  type StoryChapter,
  type StoryLevel,
  type StoryObjective,
  type StoryReward,
} from './types';

export * from './types';
export { CHARACTERS };

/**
 * THE THIRTEENTH HAND — the story campaign, as data.
 *
 * Nine chapters of five challenges. A challenge is always a normal game on
 * one of the five engines with a fixed set-up (options, deck, board and, for
 * solitaire and War, a verified deal) and an objective read from the game's
 * result. Story Mode never changes how a game is played.
 *
 * Every seeded deal has been proven winnable (src/story/verify.ts,
 * tests/unit/story.test.ts): solitaire by the solver, War by simulating the
 * whole game. Go Fish challenges are dealt fresh on each try at Easy or Normal tables,
 * and their objectives are checked to be reachable.
 *
 * All nine chapters are written (`status: 'final'`). The `draft` status and
 * its labels remain in the data model for future chapters: draft text is never
 * put in a character's mouth and is labelled in the UI.
 *
 * Real history and the story's legend are kept apart: field notes of kind
 * `history` carry a source, and notes of kind `note` say what is invented.
 *
 * Ids start with "th-" so they can never be mistaken for the first campaign's
 * "chapter-N" ids (see ./legacy.ts).
 */
export { CAMPAIGN_ID, CAMPAIGN_VERSION } from './ids';
export const CAMPAIGN_TITLE = 'The Thirteenth Hand';

const credits = (amount: number): StoryReward => ({ kind: 'credits', amount });
const xp = (amount: number): StoryReward => ({ kind: 'xp', amount });
const deck = (id: string): StoryReward => ({ kind: 'deck', id });
const board = (id: string): StoryReward => ({ kind: 'board', id });
const stamp = (id: string): StoryReward => ({ kind: 'stamp', id });
const achievement = (id: string): StoryReward => ({ kind: 'achievement', id });

/** A character's line. */
const say = (who: string, text: string, pose?: string): DialogueLine => ({ who, text, ...(pose ? { pose } : {}) });
/** Second-person narration; may reveal a piece of evidence. */
const narrate = (text: string, discovers?: string): DialogueLine => ({
  who: NARRATOR,
  text,
  narration: true,
  ...(discovers ? { discovers } : {}),
});

/** Evidence revealed in a list of beats. */
export const discoveriesIn = (lines: readonly DialogueLine[]) =>
  lines.flatMap((l) => (l.discovers ? [l.discovers] : []));

/** Short-hand for a level; ids are "<chapter>-<n>". Evidence found in its outro is part of its rewards. */
function level(
  chapter: string,
  number: number,
  l: Omit<StoryLevel, 'id' | 'number' | 'rewards' | 'objectiveText' | 'objective' | 'outro'> & {
    objective?: StoryObjective;
    rewards?: StoryReward[];
    objectiveText?: string;
    outro?: DialogueLine[];
  },
): StoryLevel {
  const index = Number(chapter.slice(3));
  const base = 30 + index * 5 + number * 10;
  const outro = l.outro ?? [];
  return {
    ...l,
    id: `${chapter}-${number}`,
    number,
    objective: l.objective ?? { kind: 'win' },
    objectiveText: l.objectiveText ?? 'Win the game.',
    outro,
    rewards: [
      ...(l.rewards ?? [credits(base), xp(base + 20)]),
      ...discoveriesIn(outro).map((id): StoryReward => ({ kind: 'evidence', id })),
    ],
  };
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  // ───────────────────────────── Chapter 1 (written) ─────────────────────────────
  {
    id: 'th-1',
    index: 1,
    title: 'The Card Without a Suit',
    locationId: 'cheryls-antique-shop',
    location: 'Cheryl’s Antique Shop',
    description: 'An estate-sale box, twelve old decks and one card that should not exist.',
    hostId: 'cheryl',
    cast: ['cheryl'],
    status: 'final',
    music: 'lamplight',
    mysteryThread:
      'The Thirteenth Hand card turns up in Lot 13 with a ledger of twelve recorded hands; its four corners are blank, waiting for suit marks. A postcard points to the River Station.',
    beats: [
      'You enter Cheryl’s shop as she is closing.',
      'Cheryl shows you an estate-sale box; on top lies a card with no suit or rank, titled The Thirteenth Hand.',
      'A collector is due at nine for the decks, and Cheryl will not sell a lot she has not counted, so you help her take inventory.',
      'The box gives up a receipt (Lot 13), a ledger of twelve hands with the thirteenth blank, and a river postcard.',
      'Under the lamp, the card shows four blank corners shaped for suit marks.',
      'Cheryl sends you to Sophia at the River Station.',
    ],
    artwork: {
      backdrop: 'backgrounds/cheryls_antique_shop/background.webp',
      decks: ['fredericksburg', 'freemasonry'],
      tint: '#7a5232',
      locationSprite: 'location-cheryls-antique-shop/location-cheryls-antique-shop',
    },
    intro: [
      narrate(
        'You step into Cheryl’s Antique Shop. A bell rings over the door, and forty clocks disagree about the time.',
      ),
      say('cheryl', 'We close at five. It’s ten to.', 'portrait-neutral'),
      narrate(
        'On the counter you see an estate-sale box tied with string, a twenty-dollar tag still on the knot. One card lies on top.',
      ),
      say(
        'cheryl',
        'Lot 13, from an estate sale across the river. Twelve old decks, a ledger, and that. A collector comes at nine for the decks.',
        'cards-reveal',
      ),
      narrate(
        'You pick up the card. It has no suit and no number — only the words THE THIRTEENTH HAND, and four blank corners.',
        'thirteenth-hand-card',
      ),
      say(
        'cheryl',
        'Provenance is a story with receipts. That card has neither. Nobody prints a card without a suit unless they want it noticed.',
        'portrait-doubt',
      ),
      say(
        'cheryl',
        'I don’t sell a lot I haven’t counted. Help me inventory it tonight, and you can look at anything in the box.',
        'portrait-talk',
      ),
    ],
    outro: [
      say(
        'cheryl',
        'River Station is Sophia’s. Parks and Rec. If anyone can tell you who stood at that bend and drew a heron, it’s her.',
      ),
      say(
        'cheryl',
        'I called the collector. Told him Monday. Take the card, bring it back, and get a receipt for anything you spend.',
        'portrait-greet',
      ),
      narrate('You tuck the card into your pocket and head for the river.'),
    ],
    levels: [
      level('th-1', 1, {
        title: 'Price Check',
        game: 'war',
        objectiveText: 'Win War against Cheryl.',
        setup: {
          seed: 2007,
          options: { opponent: 'cheryl' },
          deckId: 'fredericksburg',
          boardId: 'cheryls_antique_shop',
        },
        intro: [
          say('cheryl', 'We split the twelve decks by War. High card picks. It’s faster than arguing.', 'cards-deal'),
        ],
        outro: [
          narrate(
            'Cheryl slides a receipt across the counter to you: Lot 13, one card box, contents as found.',
            'estate-sale-receipt',
          ),
          say('cheryl', 'Lot thirteen. The auction house thought that was funny. I didn’t.'),
        ],
      }),
      level('th-1', 2, {
        title: 'Sorting the Box',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1008, options: { draw: 1 }, deckId: 'fredericksburg', boardId: 'cheryls_antique_shop' },
        intro: [
          narrate('The box holds twelve loose decks, all shuffled together. Cheryl hands you one to sort.'),
          say(
            'cheryl',
            'Aces up. A short deck sells for half. A complete one in its box sells for more than you’d think.',
          ),
        ],
        outro: [
          narrate(
            'Under the decks you find a leather ledger. Twelve hands of cards are written out in faded ink. The thirteenth line is blank.',
            'ledger-of-twelve',
          ),
          say('cheryl', 'Somebody kept score. And somebody stopped.', 'portrait-think'),
          say('cheryl', 'One handwriting, twelve hands. That isn’t a game night. That’s a record.'),
        ],
      }),
      level('th-1', 3, {
        title: 'Matched Sets',
        game: 'go-fish',
        objectiveText: 'Win Go Fish against Cheryl.',
        setup: {
          options: { opponents: ['cheryl'], difficulty: 'easy' },
          deckId: 'fredericksburg',
          boardId: 'cheryls_antique_shop',
        },
        intro: [
          say(
            'cheryl',
            'Go Fish. Don’t laugh. Asking for matches is the quickest way to find out a set is short.',
            'cards-shuffle',
          ),
        ],
        outro: [
          say(
            'cheryl',
            'Every deck in the box is complete. Fifty-two each. So the extra card didn’t come with them. Somebody added it.',
            'portrait-think',
          ),
        ],
      }),
      level('th-1', 4, {
        title: 'The Locked Case',
        game: 'freecell',
        objectiveText: 'FreeCell puzzle: finish the last four ranks. Use the free cells to plan ahead.',
        setup: {
          seed: 1001,
          options: { freecellPuzzle: true },
          deckId: 'fredericksburg',
          boardId: 'cheryls_antique_shop',
        },
        intro: [
          narrate('You notice that Cheryl’s display case has a puzzle lock: a FreeCell deal painted under the glass.'),
          say(
            'cheryl',
            'My late husband’s idea of security. He said burglars don’t have the patience. He was right about most people.',
          ),
        ],
        outro: [
          narrate(
            'You find an old postcard of the Rappahannock tucked in the box lid. A heron is sketched on the back, with two words: River Station.',
            'river-postcard',
          ),
          say(
            'cheryl',
            'A heron and two words. That isn’t provenance either. But it’s a direction.',
            'portrait-neutral',
          ),
        ],
      }),
      level('th-1', 5, {
        title: 'Under the Lamp',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1035, options: { suits: 1 }, deckId: 'fredericksburg', boardId: 'cheryls_antique_shop' },
        intro: [
          say('cheryl', 'Last one. Spider. Then we look at that card under a proper lamp. Daylight lies about paper.'),
        ],
        outro: [
          narrate(
            'You hold the card under the lamp. Its blank corners catch the light, each shaped for a suit mark — four of them, all missing.',
          ),
          say('cheryl', 'Four empty corners. Somebody wants this card finished.', 'portrait-think'),
        ],
        rewards: [credits(120), xp(150)],
      }),
    ],
    rewards: [
      board('cheryls_antique_shop'),
      stamp('th-antique-shop'),
      achievement('passport-first'),
      credits(300),
      xp(200),
    ],
    info: [
      {
        id: 'fredericksburg-1728',
        kind: 'history',
        title: 'Fredericksburg',
        text: 'Fredericksburg was established in 1728 as a port on the Rappahannock River. Its historic downtown, including Caroline Street, is known today for its antique shops. Cheryl and her shop are fictional.',
        source: 'City of Fredericksburg; Fredericksburg Area Museum',
      },
    ],
    unlockRequirements: {},
  },

  // ───────────────────────────── Chapter 2 (written) ─────────────────────────────
  {
    id: 'th-2',
    index: 2,
    title: 'The Heron’s Bend',
    locationId: 'rappahannock-river-station',
    location: 'Rappahannock River Station',
    description:
      'A heron sketch, a trail marker nobody remembers, Sophia’s river map and a letter that never reached Dante.',
    hostId: 'sophia',
    cast: ['sophia'],
    status: 'final',
    music: 'river-dawn',
    mysteryThread:
      'The first suit mark — a club — is carved on an old trail marker at the heron’s bend. Sophia’s annotated river map shows four marks near the old waterfront, and a returned envelope ties the card to Dante.',
    beats: [
      'You walk the river path to Sophia’s ranger station.',
      'Sophia recognises the heron in the postcard sketch as one she logs every morning at the same bend.',
      'She mentions a man who filmed her lobby and asked for the visitor logs: Jak.',
      'The wildlife log and an unlisted trail marker carved with a club turn up clues.',
      'Sophia lends you her annotated river map: four marks circled near the old waterfront.',
      'An envelope addressed to Dante at iSMOKESHOP came back to the station with a heron card inside. Sophia sends you to Dante.',
    ],
    artwork: {
      backdrop: 'backgrounds/rappahannock_riverside/background.webp',
      decks: ['eastern_woodlands'],
      tint: '#33452d',
      locationSprite: 'location-ranger-station/location-ranger-station',
    },
    intro: [
      narrate(
        'You follow the river path to the Rappahannock River Station. A heron stands in the shallows, unbothered.',
      ),
      say(
        'sophia',
        'Morning. If you’re here about the heron, she’s fine. She’s fished that bend longer than I’ve worked here.',
        'portrait-greet',
      ),
      narrate('You show Sophia the postcard and the card.'),
      say(
        'sophia',
        'That’s this bend. See the snag behind her? It washed in during the spring flood. Whoever drew this stood on our dock, and recently.',
        'portrait-think',
      ),
      say(
        'sophia',
        'Last week a man with a phone on a stick filmed our lobby and asked for the visitor logs. Jak something. Constitutional right, he said. It was also my lunch break.',
        'portrait-doubt',
      ),
      say(
        'sophia',
        'I have a school group at two and a log to finish. Walk the route with me, and I’ll pull the sign-in sheets when we’re back.',
        'portrait-talk',
      ),
    ],
    outro: [
      say(
        'sophia',
        'Somebody mailed Dante a heron card, and it came back to a station that never sent it. I don’t like being somebody’s return address.',
        'portrait-think',
      ),
      say(
        'sophia',
        'Go see him. If you run into the man with the phone on a stick, tell him the sign-in sheets are city records. He can ask for them properly.',
      ),
      narrate('You fold the map into your pocket and set off for Dante’s shop.'),
    ],
    levels: [
      level('th-2', 1, {
        title: 'Lunch Break',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Sophia.',
        setup: {
          options: { opponents: ['sophia'], difficulty: 'easy' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [
          say(
            'sophia',
            'Lunch break. Twenty minutes, and I’m eating. Go Fish is about all I can teach with one hand.',
            'cards-deal',
          ),
        ],
        outro: [
          narrate(
            'You read the wildlife log over Sophia’s shoulder: the same heron, at the same bend, every morning for years.',
            'field-journal-page',
          ),
          say('sophia', 'Consistent. Herons usually are. People aren’t.'),
        ],
        info: [
          {
            id: 'great-blue-heron',
            kind: 'wildlife',
            title: 'Great blue heron',
            text: 'The great blue heron is the largest heron in North America. It hunts by standing still in shallow water, then striking fast. Herons live along the Rappahannock all year.',
            source: 'Cornell Lab of Ornithology, All About Birds',
            sprite: 'river-ranger/heron-card',
          },
        ],
      }),
      level('th-2', 2, {
        title: 'Trail Markers',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 3101, options: { draw: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [
          narrate('You walk the river trail with Sophia toward the heron’s bend.'),
          say('sophia', 'Sort these while I check the markers. Half this job is noticing what moved overnight.'),
        ],
        outro: [
          narrate(
            'At the heron’s bend, an old trail marker leans toward the water. Carved into it is a small club — the exact size of one blank corner on your card.',
            'club-mark',
          ),
          say(
            'sophia',
            'That marker is older than I am, and it isn’t on our trail inventory. Somebody set it where only high water reaches.',
            'portrait-surprise',
          ),
        ],
        info: [
          {
            id: 'fall-line',
            kind: 'history',
            title: 'The fall line',
            text: 'Fredericksburg grew where the Rappahannock drops over rocky rapids at the fall line — the farthest point ocean-going ships could sail upstream. The town was established in 1728 as a river port.',
            source: 'City of Fredericksburg; Fredericksburg Area Museum',
            sprite: 'river-ranger/river-stone',
          },
        ],
      }),
      level('th-2', 3, {
        title: 'The Archive Drawer',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['sophia'], difficulty: 'normal' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [
          say(
            'sophia',
            'If that marker is old, it’s on an old map. The archive drawer sticks, and nobody’s labelled it since the nineties.',
          ),
        ],
        outro: [
          narrate(
            'Sophia spreads her own annotated map of the river trail across the desk and lets you take it. Near the old waterfront, four small marks are circled in pencil.',
            'sophia-river-map',
          ),
          say(
            'sophia',
            'Those four marks were on the survey I traced it from. They don’t match anything I know — and one of them is a club.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'american-shad',
            kind: 'wildlife',
            title: 'American shad',
            text: 'Each spring, American shad swim up the Rappahannock from the ocean to spawn. Removing the Embrey Dam at Fredericksburg in 2004 reopened miles of river to them and other migrating fish.',
            source: 'Friends of the Rappahannock; U.S. Fish and Wildlife Service',
          },
        ],
      }),
      level('th-2', 4, {
        title: 'High Water',
        game: 'spider',
        objectiveText: 'Clear one-suit Spider.',
        setup: { seed: 1002, options: { suits: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [
          say(
            'sophia',
            'River’s up, so the lower trail is closed. While it drops, the lost-and-found needs sorting. Thirty years of everything.',
          ),
        ],
        outro: [
          narrate(
            'In the lost-and-found you find an envelope addressed to Dante at iSMOKESHOP, stamped Return to Sender. Inside is a card with a heron on it.',
            'returned-envelope',
          ),
          say(
            'sophia',
            'Dante. He painted the mural for our kids’ program and signed it in letters nobody can read. On purpose, he says.',
            'portrait-greet',
          ),
        ],
        info: [
          {
            id: 'bald-eagle',
            kind: 'wildlife',
            title: 'Bald eagles',
            text: 'Bald eagles nest along the Rappahannock. The Chesapeake Bay region, which the river feeds, has one of the largest bald eagle populations on the Atlantic coast.',
            source: 'Center for Conservation Biology, William & Mary',
            sprite: 'river-ranger/binoculars',
          },
        ],
      }),
      level('th-2', 5, {
        title: 'End of Shift',
        game: 'war',
        finale: true,
        objectiveText: 'Finale: win War against Sophia.',
        setup: {
          seed: 2001,
          options: { opponent: 'sophia' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [
          say(
            'sophia',
            'End of shift. One game of War. Loser writes up the man with the phone on a stick.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'sophia',
            'People talk about this river like its history ended in 1776. Downriver, the Rappahannock Tribe got land at Fones Cliffs back in 2022.',
            'portrait-neutral',
          ),
          say(
            'sophia',
            'It’s still being written. So is this. One mark found. I’ll watch the river; you watch that card.',
          ),
        ],
        rewards: [credits(130), xp(160)],
        info: [
          {
            id: 'rappahannock-name',
            kind: 'history',
            title: 'The river’s name',
            text: 'The river shares its name with the Rappahannock people. The Rappahannock Tribe, based in Virginia’s Northern Neck, was federally recognized in 2018. In 2022 it reacquired 465 acres at Fones Cliffs, a sacred site on the river.',
            source: 'Rappahannock Tribe; U.S. Bureau of Indian Affairs; U.S. Department of the Interior',
          },
        ],
      }),
    ],
    rewards: [
      board('rappahannock_riverside'),
      deck('eastern_woodlands'),
      stamp('th-river-station'),
      credits(350),
      xp(230),
    ],
    info: [
      {
        id: 'eastern-woodlands-deck',
        kind: 'note',
        title: 'About the Eastern Woodlands deck',
        text: 'The Eastern Woodlands deck is a visual theme: the wildlife, plants and rivers of the region. The clues and mysteries in this story are fiction; they do not represent Native spirituality or traditions.',
      },
    ],
    unlockRequirements: { chapter: 'th-1' },
  },

  // ───────────────────────────── Chapter 3 (written) ─────────────────────────────
  {
    id: 'th-3',
    index: 3,
    title: 'Neon Commission',
    locationId: 'ismokeshop',
    location: 'iSMOKESHOP',
    description: 'Dante has been paid, in one-dollar bills, to paint George Washington as thirteen neon monsters.',
    hostId: 'dante',
    cast: ['dante'],
    status: 'final',
    music: 'minimal-parlor-loop',
    mysteryThread:
      'A client signing only “G. W.” paid Dante in one-dollar bills to paint George Washington as thirteen neon monsters. Under black light, the client’s reference sketch hides the second mark — a heart — and the payments trace back to the card-case maker Jak Gold uses.',
    beats: [
      'You find Dante at his art counter, surrounded by neon monster sketches.',
      'The returned heron card was his: he mailed it to the client’s P.O. box using the River Station, where he was painting a mural, as his return address.',
      'An anonymous order: thirteen card designs of George Washington as a neon monster, paid in advance in one-dollar bills, signed “G. W.”',
      'Dante gives you his first finished design, General Monsterton, holding twelve cards and one blank one.',
      'Dante sees that the lace in the reference sketch breaks its own rhythm; under black light, the gap holds a heart drawn in invisible ink — the second mark.',
      'Dante, cheerfully clueless about Freemasonry, knows the payments came through Jak Gold’s card-case maker, and sends you to Jak.',
    ],
    artwork: {
      backdrop: 'backgrounds/artists_studio/background.webp',
      decks: ['dantes_world'],
      tint: '#2a1240',
      locationSprite: 'location-neon-art-shop/location-neon-art-shop',
    },
    intro: [
      narrate(
        'You push open the door of iSMOKESHOP. Behind the glass counter, every inch of wall is covered in neon monsters with too many eyes.',
      ),
      say(
        'dante',
        'Hey. Lighters are on the left, the art’s on the walls, and I’m behind on a deadline. Which one are you here for?',
        'portrait-greet',
      ),
      narrate('You set the returned envelope on the counter. Dante goes quiet, then laughs once.'),
      say(
        'dante',
        'My heron card. I mailed that to a P.O. box that doesn’t exist, with the River Station as the return address. I was painting their mural that week.',
        'portrait-surprise',
      ),
      say(
        'dante',
        'The client paid in advance, asked for that card back, then stopped answering. I’m still on design one of thirteen. I finish what I’m paid for.',
        'portrait-talk',
      ),
      say(
        'dante',
        'Help me clear the sketch pile and I’ll show you the brief. Strangest job I’ve taken, and I once painted a lizard wizard on a food truck.',
        'cards-fan',
      ),
    ],
    outro: [
      say(
        'dante',
        'The ones came packed in a custom card case with the maker’s stamp. Same maker Jak Gold uses. He mentions it in roughly every video.',
        'portrait-think',
      ),
      say(
        'dante',
        'Jak has a back room off Caroline Street. Ring light, tripod, opinions. He’s better than his thumbnails. Don’t tell him I said that.',
        'portrait-greet',
      ),
      narrate('You tuck the glowing sketch away with the card. Two corners marked, two to go.'),
    ],
    levels: [
      level('th-3', 1, {
        title: 'Monster Sketches',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1013, options: { draw: 1 }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [
          narrate(
            'Dante drops a stack of monster sketches on the counter, sorted into suits that do not exist. You start sorting them into real ones.',
          ),
          say('dante', 'Real suits, aces up. Chaos goes on the paper, not the desk.', 'cards-shuffle'),
        ],
        outro: [
          narrate(
            'Under the last sketch you find an order form, typed and paid in advance. The client is listed only as “G. W.”',
            'commission-form',
          ),
          say(
            'dante',
            'Thirteen card designs. George Washington as a neon monster. Paid in one-dollar bills — so, technically, paid in George Washington.',
            'portrait-talk',
          ),
          say('dante', 'I thought it was a bit. Bits don’t usually pay in advance.', 'portrait-think'),
        ],
        info: [
          {
            id: 'day-glo',
            kind: 'history',
            title: 'Colours that glow',
            text: 'Daylight fluorescent paint — the colours that blaze under a black light on 1960s posters — was developed in the 1930s by brothers Bob and Joe Switzer, who went on to found the Day-Glo company.',
            source: 'American Chemical Society, National Historic Chemical Landmarks',
            sprite: 'neon-art-supplies/neon-markers',
          },
        ],
      }),
      level('th-3', 2, {
        title: 'Colour Clash',
        game: 'war',
        objectiveText: 'Win War against Dante.',
        setup: { seed: 2026, options: { opponent: 'dante' }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [
          say(
            'dante',
            'War. My deck against your deck. Both of them are my deck; I lent you one. Don’t bend the cards.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'dante',
            'Those sixties Fillmore posters? The lettering melts into the shapes. You can’t skim them. You stand there until the picture resolves.',
            'portrait-talk',
          ),
          say(
            'dante',
            'This brief is like that. It isn’t random. Your eyes just haven’t found the rhythm yet.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'concert-posters',
            kind: 'history',
            title: 'Posters you have to read slowly',
            text: 'In the mid-1960s, San Francisco concert posters — such as Wes Wilson’s for the Fillmore Auditorium — used swirling hand lettering that was hard to read on purpose, so people stopped to look.',
            source: 'Fine Arts Museums of San Francisco',
            sprite: 'neon-art-supplies/rolled-poster',
          },
        ],
      }),
      level('th-3', 3, {
        title: 'The Commission',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['dante'], difficulty: 'normal' },
          deckId: 'dantes_world',
          boardId: 'artists_studio',
        },
        intro: [
          narrate(
            'Dante pulls out the client’s reference sketch for you: a stiff, old-fashioned portrait of George Washington holding a hand of cards.',
          ),
          say(
            'dante',
            'The brief says “capture my vigor.” My vigor. Clients don’t usually write about themselves like they’re a statue.',
            'portrait-doubt',
          ),
        ],
        outro: [
          narrate(
            'Dante hands you his first finished design: General Monsterton, a three-eyed George Washington in neon blue, holding twelve cards. The thirteenth card in his hand is blank.',
            'monster-card',
          ),
          say(
            'dante',
            'Keep that one. Proof I was hired before this got strange. And proof I hit at least one deadline.',
            'portrait-greet',
          ),
        ],
      }),
      level('th-3', 4, {
        title: 'Monster Pond',
        game: 'go-fish',
        objectiveText: 'Win Go Fish against Dante.',
        setup: {
          options: { opponents: ['dante'], difficulty: 'easy' },
          deckId: 'dantes_world',
          boardId: 'artists_studio',
        },
        intro: [
          say(
            'dante',
            'Paint’s curing. Go Fish while it does. Rush fluorescent paint and it dries dull.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'dante',
            'People hear “psychedelic” and think drug joke. The poster artists were working on perception — what your eye does when a pattern won’t sit still.',
            'portrait-talk',
          ),
          say(
            'dante',
            'And it was a scene. Printers, bands, kids lining up for a poster. Art made for a room full of people. That’s the part I want.',
            'full-gesture-a',
          ),
          say(
            'dante',
            'Freemasons, though? No idea. The little red hats? No, that’s the Shriners. I think.',
            'portrait-doubt',
          ),
        ],
      }),
      level('th-3', 5, {
        title: 'The Hidden Heart',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1003, options: { suits: 1 }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [
          narrate(
            'Dante studies the reference sketch, then kills the lights and switches on a black light. You watch him tilt the paper toward it.',
          ),
          say(
            'dante',
            'The cuff lace is wrong. Lace repeats, and this breaks its rhythm. Look at the gaps, not the threads. Figure and ground.',
            'portrait-think',
          ),
        ],
        outro: [
          narrate(
            'Under the black light, a heart glows in the gaps of Washington’s lace cuff, drawn in invisible ink. It is the exact size of your card’s second blank corner.',
            'heart-mark',
          ),
          say(
            'dante',
            'There. Negative space first, fluorescent ink to prove it. Whoever drew this knew exactly how people look at lace: they don’t.',
            'portrait-surprise',
          ),
        ],
        rewards: [credits(140), xp(170)],
      }),
    ],
    rewards: [
      deck('cannabis_nugs'),
      deck('dantes_world'),
      board('artists_studio'),
      stamp('th-neon-monster'),
      credits(400),
      xp(260),
    ],
    info: [
      {
        id: 'about-dantes-counter',
        kind: 'note',
        title: 'About this chapter',
        text: 'Dante’s chapter happens at his art counter and is about his artwork. The anonymous commission, the client and the hidden heart are invented for the story.',
      },
    ],
    unlockRequirements: { chapter: 'th-2' },
  },

  // ───────────────────────────── Chapter 4 (written) ─────────────────────────────
  {
    id: 'th-4',
    index: 4,
    title: 'On the Record',
    locationId: 'jaks-backroom-parlor',
    location: 'Jak’s Backroom Card Parlor',
    description: 'Jak has filmed, filed and flourished his way to a reply nobody meant him to read.',
    hostId: 'jak_gold',
    cast: ['jak_gold'],
    status: 'final',
    music: 'high-roller',
    mysteryThread:
      'Jak’s public-records request came back almost entirely redacted, except for one name: Operation Thirteenth Hand. A receipt shows “G. W.” sent a custom card case to an unmarked office, and Jak’s slow-motion footage reveals the third mark — a diamond hidden in the card’s edge.',
    beats: [
      'You find Jak mid-video, narrating to his camera in a back room off Caroline Street.',
      'He filmed the River Station lobby while chasing a records request about “unexplained activity” in the old cellars.',
      'Among his papers: a receipt for a custom card case ordered by “G. W.”, paid in ones, shipped to an office with no name on the door.',
      'He corroborates the receipt with a second source, then switches the camera off to show you the reply: almost all black bars, one phrase surviving — OPERATION THIRTEENTH HAND.',
      'Jak films the card in a spring flourish at 240 frames a second; frame by frame, a diamond appears inside its edge — the third mark.',
      'Jak sends you to the unmarked office: he is banned from the stairwell, and you are not.',
    ],
    artwork: {
      backdrop: 'backgrounds/backroom_card_table/background.webp',
      decks: ['jak_gold'],
      tint: '#2c2a3a',
      locationSprite: 'location-jaks-cardistry-parlor/location-jaks-cardistry-parlor',
    },
    intro: [
      narrate(
        'You knock on a back-room door off Caroline Street. A ring light snaps on in your face. So does a camera.',
      ),
      say(
        'jak_gold',
        'This is my studio, so you’re on camera. Say the word and it goes off. Most people don’t say the word. They wave.',
        'portrait-greet',
      ),
      say('jak_gold', 'Dante sent you? Dante texted me eleven monster emojis. I inferred.'),
      narrate('You show Jak the card. He stops talking, which, you sense, is rare.'),
      say(
        'jak_gold',
        'That card is in my records request. I’m cutting that video tonight, and I need someone who isn’t my audience. Deal in. I think better with my hands busy.',
        'portrait-think',
      ),
    ],
    outro: [
      say(
        'jak_gold',
        'Three corners: club, heart, diamond. The spade is behind that unmarked door; I’d bet my best deck on it. The building manager banned me from the stairwell. You aren’t banned.',
        'portrait-doubt',
      ),
      say(
        'jak_gold',
        'I’m not coming with you. I’ll be here, cutting a video that’s honest and a little boring. You can tell it’s honest because it’s boring.',
      ),
      narrate('You leave Jak rewatching his footage and head for the door with no name on it.'),
    ],
    levels: [
      level('th-4', 1, {
        title: 'Rolling',
        game: 'war',
        objectiveText: 'Win War against Jak Gold.',
        setup: { seed: 2030, options: { opponent: 'jak_gold' }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [say('jak_gold', 'War. Pure chance, so nobody watching can say I cheated. Rolling.')],
        outro: [
          say(
            'jak_gold',
            'Six months ago I asked the city, in writing, about “unexplained activity” in the old cellars downtown. State FOIA. Cheap question. Weird answer.',
          ),
          say(
            'jak_gold',
            'Then I filmed lobbies, your ranger’s included, on her lunch break. Legal, probably. Useful, no. I cut that footage. She was right.',
          ),
        ],
        info: [
          {
            id: 'cardistry',
            kind: 'note',
            title: 'Cardistry',
            text: 'Cardistry is the performance art of card flourishes — cuts, spins, springs and fans done for their beauty, not to fool anyone. Unlike magic, it hides nothing. It grew into a worldwide community through online videos.',
            sprite: 'jak-black-gold/card-spring-cascade',
          },
        ],
      }),
      level('th-4', 2, {
        title: 'Three-Card Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1010, options: { draw: 3 }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [
          narrate(
            'Jak hands you three practice decks shuffled together and asks you to sort them while he rehearses a one-handed cut.',
          ),
          say('jak_gold', 'Three at a time. Same as records: you don’t get to pick which ones come up.'),
        ],
        outro: [
          narrate(
            'Among Jak’s paperwork you find a receipt for a custom card case, ordered from his own card-case maker by a customer who signed as “G. W.”',
            'cardistry-receipt',
          ),
          say(
            'jak_gold',
            'G. W. My case maker remembers him: paid in ones, every bill the same face. That’s one source. I don’t run anything on one source.',
          ),
          say(
            'jak_gold',
            'Two cases. One to Dante’s shop, full of ones, and Dante confirms it. One to an office above a shuttered storefront, no name on the door. Two sources. Now it’s a lead.',
          ),
        ],
      }),
      level('th-4', 3, {
        title: 'Public Records',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Jak Gold.',
        setup: {
          options: { opponents: ['jak_gold'], difficulty: 'easy' },
          deckId: 'jak_gold',
          boardId: 'backroom_card_table',
        },
        intro: [say('jak_gold', 'Go Fish. You ask, I disclose. Or I don’t. Like a government agency.')],
        outro: [
          narrate(
            'Jak switches the camera off before he spreads out the reply for you. Whole paragraphs are blacked out. One phrase survived: OPERATION THIRTEENTH HAND.',
            'redacted-reply',
          ),
          say(
            'jak_gold',
            'Off camera, because it isn’t content until I know what it is. They redacted everything but the name. Sloppy, or meant to be read.',
          ),
        ],
        info: [
          {
            id: 'foia-1966',
            kind: 'history',
            title: 'Freedom of Information',
            text: 'The federal Freedom of Information Act became law in 1966. It covers federal agencies, which may withhold information under nine exemptions — one reason released records arrive with black bars. A Virginia city answers under the state’s own Act, which has its own exclusions.',
            source: 'FOIA.gov (U.S. Department of Justice); Virginia FOIA Council',
            sprite: 'cold-war-spycraft/redacted-document',
          },
        ],
      }),
      level('th-4', 4, {
        title: 'Redacted',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['jak_gold'], difficulty: 'normal' },
          deckId: 'jak_gold',
          boardId: 'backroom_card_table',
        },
        intro: [
          say(
            'jak_gold',
            'Every black bar has a width. Measure the gaps and you can guess at the words. Guess, not know. That goes in the video too.',
          ),
          narrate('You read the reply line by line while Jak measures black bars with a steel ruler.'),
        ],
        outro: [
          say(
            'jak_gold',
            'What made it through: “four marks,” “waterfront,” and “thirteenth hand — not concluded.” Whatever it was, nobody closed the file.',
          ),
        ],
      }),
      level('th-4', 5, {
        title: 'Slow Motion',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 3415, options: { suits: 1 }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [
          say(
            'jak_gold',
            'Let me borrow the card. One flourish: spring, cascade, catch. My phone shoots two hundred and forty frames a second.',
            'cards-fan',
          ),
          narrate(
            'You hand Jak the card. It flies between his hands with fifty-two others and lands back on top of the deck.',
          ),
        ],
        outro: [
          narrate(
            'Jak plays the footage back for you frame by frame. As the card bends mid-spring, a diamond shows inside its edge — printed so it appears only when the card flexes.',
            'diamond-mark',
          ),
          say(
            'jak_gold',
            'Edge work. Old cheats marked card edges to read them from the side. This one marks itself for whoever bends it right.',
          ),
          say('jak_gold', 'Best footage I’ve ever shot. It stays off the channel until we know what it means.'),
        ],
        rewards: [credits(150), xp(180)],
      }),
    ],
    rewards: [
      deck('yummyhole_standard'),
      deck('jak_gold'),
      board('jak_golds_casino'),
      stamp('th-cards-camera'),
      achievement('halfway-home'),
      credits(450),
      xp(280),
    ],
    unlockRequirements: { chapter: 'th-3' },
  },

  // ───────────────────────────── Chapter 5 (written) ─────────────────────────────
  {
    id: 'th-5',
    index: 5,
    title: 'Operation Thirteenth Hand',
    locationId: 'mrs-gray-safehouse',
    location: 'Mrs. Gray’s Intelligence Safehouse',
    description: 'A woman with no first name, a dossier with no happy ending, and a legend somebody borrowed.',
    hostId: 'mrs_gray',
    cast: ['mrs_gray'],
    status: 'final',
    music: 'safehouse-pulse',
    mysteryThread:
      'In the story, Operation Thirteenth Hand was a fictional 1962 investigation of a phantom card game in the cellars, using a local legend — a game George Washington never finished — as its cover. It was compartmentalized: surveyors photographed the marks, a Freemason from Lodge No. 4 read the history, and nobody saw the whole file. Mrs. Gray inherited it, treats it as a record of what people feared rather than proof, and lets you break the seal no one in her office was cleared to break: the ace of spades holding the fourth mark.',
    beats: [
      'You climb to the unmarked office; Mrs. Gray already knows where your first three marks came from.',
      'She explains dead drops: the four marks on Sophia’s map were used as one.',
      'Her predecessor opened Operation Thirteenth Hand (fiction) in 1962 after reports of a card game in the cellars played by someone who left no footprints.',
      'The dossier: survey photos pin each mark to a spot near the old waterfront. Each office held one piece; the legend of the unfinished game was the cover story.',
      'The operation’s consultant was a Freemason from Lodge No. 4; Steve Gonzales keeps that research now.',
      'The sealed ace of spades carries the fourth mark, the spade.',
    ],
    artwork: {
      backdrop: 'backgrounds/mrs_gray_safehouse/background.webp',
      decks: ['spycraft'],
      tint: '#1d2328',
      locationSprite: 'location-intelligence-safehouse/location-intelligence-safehouse',
    },
    intro: [
      narrate('You climb the stairs above the shuttered storefront. The door with no name opens before you can knock.'),
      say('mrs_gray', 'You’re late. Not by the clock. By the file.', 'portrait-neutral'),
      say(
        'mrs_gray',
        'Three days ago a card case arrived here, signed “G. W.” I don’t receive packages. I receive explanations. Who is G. W.?',
        'portrait-doubt',
      ),
      narrate('You show her the card with its three marked corners. She studies it without touching it.'),
      say(
        'mrs_gray',
        'A club from the river. A heart from a painter’s commission. A diamond from somebody’s footage. You’ve been busy, and you’ve been noticed.',
        'portrait-think',
      ),
      say(
        'mrs_gray',
        'Sit. The Hardigan boys had that chair once. Their questions improved after the first hour. Most people’s do.',
        'portrait-doubt',
      ),
    ],
    outro: [
      say(
        'mrs_gray',
        'Go to the lodge. Steve Gonzales can tell you what the marks mean. I can only tell you where they were found. Those are different jobs.',
        'portrait-talk',
      ),
      say(
        'mrs_gray',
        'If anyone asks where you heard of Operation Thirteenth Hand, say it was a ghost story. That has the advantage of being accurate.',
        'portrait-neutral',
      ),
      say('mrs_gray', 'This conversation didn’t happen. I’ll know if you say it did.', 'portrait-doubt'),
      narrate('You walk down the stairs with four marked corners and no idea which one goes first.'),
    ],
    levels: [
      level('th-5', 1, {
        title: 'Dead Drop',
        game: 'freecell',
        objectiveText: 'FreeCell puzzle: finish the last four ranks. Use the free cells to plan ahead.',
        setup: { seed: 1017, options: { freecellPuzzle: true }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [
          say(
            'mrs_gray',
            'A dead drop is a place two people use so they never have to meet. This deal is one. Solve it, and we’ll discuss who has been using yours.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'mrs_gray',
            'The four marks on your ranger’s map weren’t decoration. They were dead drops. A club at the river, a heart downtown. Somebody left things. Somebody collected.',
            'portrait-talk',
          ),
          say(
            'mrs_gray',
            'I don’t know who. I know what the file says, which is a different thing. A file is mostly a list of what someone was worried about.',
            'portrait-doubt',
          ),
        ],
        info: [
          {
            id: 'hollow-nickel',
            kind: 'history',
            title: 'The hollow nickel',
            text: 'In 1953 a Brooklyn newspaper boy dropped a nickel that split open to reveal a tiny photograph of coded numbers. The “hollow nickel” case eventually led the FBI to the Soviet spy Rudolf Abel in 1957.',
            source: 'FBI, “Hollow Nickel/Rudolph Abel” (fbi.gov)',
            sprite: 'cold-war-spycraft/film-reel',
          },
        ],
      }),
      level('th-5', 2, {
        title: 'Interview',
        game: 'war',
        objectiveText: 'Win War against Mrs. Gray.',
        setup: { seed: 2010, options: { opponent: 'mrs_gray' }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [
          say(
            'mrs_gray',
            'War. I’ll ask the questions. You turn the cards. Neither of us will enjoy it as much as we pretend.',
            'portrait-neutral',
          ),
        ],
        outro: [
          say(
            'mrs_gray',
            'Operation Thirteenth Hand. My predecessor opened it in 1962: reports of a card game in the cellars under the old town, played by someone who left no footprints.',
            'portrait-think',
          ),
          say(
            'mrs_gray',
            'Two witnesses. One had been drinking; the other was a deacon. The file gives them equal weight, which tells you something about the file.',
            'portrait-doubt',
          ),
          say(
            'mrs_gray',
            'They closed it as “unexplained.” I inherited it with the desk. I’ve never liked that word. It means someone stopped asking.',
            'portrait-neutral',
          ),
        ],
      }),
      level('th-5', 3, {
        title: 'Cipher Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3205, options: { draw: 3 }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [
          narrate(
            'Mrs. Gray hands you a deck from the operation’s files. A few cards have pinholes in them. She watches to see if you notice.',
          ),
          say('mrs_gray', 'Sort it. Tell me what doesn’t belong. Or don’t, and I’ll learn something about you anyway.'),
        ],
        outro: [
          narrate(
            'Mrs. Gray slides a gray folder across the desk to you, stamped THIRTEENTH HAND. Inside are survey photos of four suit marks, each pinned to a spot near the old waterfront.',
            'thirteenth-hand-dossier',
          ),
          say(
            'mrs_gray',
            'Each office got one piece. Surveyors photographed the marks. The consultant read the history. Nobody saw the whole file. That was the point, and the problem.',
            'portrait-talk',
          ),
          say(
            'mrs_gray',
            'The cover story was a local legend: a card game George Washington never finished. Twelve hands played. The thirteenth never dealt.',
            'portrait-talk',
          ),
          say('mrs_gray', 'A legend, of course. Mostly.', 'portrait-doubt'),
        ],
        info: [
          {
            id: 'map-decks',
            kind: 'history',
            title: 'Escape-map playing cards',
            text: 'During World War II, the United States Playing Card Company helped make special decks for Allied prisoners of war. Soaked in water, the cards peeled apart to reveal pieces of an escape map.',
            source: 'The National WWII Museum',
            sprite: 'cold-war-spycraft/classified-folder',
          },
        ],
      }),
      level('th-5', 4, {
        title: 'Debrief',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Mrs. Gray.',
        setup: {
          options: { opponents: ['mrs_gray'], difficulty: 'easy' },
          deckId: 'spycraft',
          boardId: 'mrs_gray_safehouse',
        },
        intro: [
          say(
            'mrs_gray',
            'Debrief. You ask me for cards. I decide what you’re cleared to know. It will be less than you hoped and more than I should.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'mrs_gray',
            'The operation had a consultant: a Freemason from Lodge No. 4. He knew the town’s history cold, and refused to believe a word of the legend.',
            'portrait-think',
          ),
          say(
            'mrs_gray',
            'The lodge kept his notes. Steve Gonzales reads them now. Media work in Washington, a Norwich man, very careful with dates.',
            'portrait-talk',
          ),
          say(
            'mrs_gray',
            'You’ll like him. I’m still deciding. I have been deciding for some years.',
            'portrait-doubt',
          ),
        ],
      }),
      level('th-5', 5, {
        title: 'The Ace of Spades',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1009, options: { suits: 1 }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [
          narrate('You reach the last folder in the dossier. It is sealed, and the seal is a playing card.'),
          say(
            'mrs_gray',
            'Finish this, and you may break the seal. Nobody in this office has. None of us was ever cleared to. I’d like to watch your face.',
            'portrait-neutral',
          ),
        ],
        outro: [
          narrate(
            'You break the seal. It is an ace of spades with an engraved centre — and in its corner, the fourth mark, cut to fit your card.',
            'spade-mark',
          ),
          say(
            'mrs_gray',
            'Club at the river. Heart in the commission. Diamond in the footage. Spade in my files. Four marks, four corners.',
            'portrait-surprise',
          ),
          say(
            'mrs_gray',
            'And still no order to set them in. That isn’t intelligence. That’s interpretation. It’s what the lodge is for.',
            'portrait-talk',
          ),
        ],
        info: [
          {
            id: 'ace-of-spades-duty',
            kind: 'history',
            title: 'Why the ace of spades is fancy',
            text: 'For well over a century, British card makers had to use an ace of spades printed by the government to show that the tax on playing cards had been paid. That is one reason the ace of spades is still the most decorated card in the deck.',
            source: 'The British Museum; Worshipful Company of Makers of Playing Cards',
            sprite: 'cold-war-spycraft/spycraft-ace-of-spades',
          },
        ],
        rewards: [credits(160), xp(190)],
      }),
    ],
    rewards: [
      deck('spycraft'),
      board('mrs_gray_safehouse'),
      board('safehouse'),
      stamp('th-dossier'),
      achievement('story-ch5'),
      credits(500),
      xp(300),
    ],
    unlockRequirements: { chapter: 'th-4' },
  },

  // ───────────────────────────── Chapter 6 (written) ─────────────────────────────
  {
    id: 'th-6',
    index: 6,
    title: 'Square and Compasses',
    locationId: 'masonic-lodge-no4',
    location: 'Fredericksburg Masonic Lodge No. 4',
    description: 'Steve Gonzales separates what happened at the lodge in 1752 from what someone invented later.',
    hostId: 'steve_gonzales',
    cast: ['steve_gonzales', 'sophia'],
    status: 'final',
    music: 'sanctum-pulse',
    mysteryThread:
      'Steve separates documented history (Washington’s initiation here in 1752, the Capitol cornerstone, the Culper Ring) from the story’s legend. Masons explain the square, compasses, level and plumb as lessons in conduct; suit lore belongs to tarot and other traditions, and the card’s cipher is not Masonic. With compasses, Sophia’s map and the dossier’s survey, he reads the order the card was made to be set in — spade, diamond, heart, club, downstream — and raking light raises two words from the ledger’s blank line: KENMORE — ASK MOTHER.',
    beats: [
      'You meet Steve Gonzales on the steps of the historic lodge where George Washington was made a Mason in 1752.',
      'Steve sets the ground rules: the lodge and Washington’s Masonic history are real; the card, the legend and the cipher are not Masonic.',
      'The working tools have public meanings — the square, compasses, level and plumb as lessons in conduct and limits — and none of them is a playing card.',
      'Sophia arrives to check Steve’s sources. They hold up, to her mild annoyance; he credits the lodge and Burning Man for his habit of writing down who built what.',
      'Compasses, Sophia’s map and the dossier’s survey give the order: you followed the marks upriver; the card reads downstream — spade, diamond, heart, club.',
      'Steve’s raking light raises an impression on the ledger’s blank thirteenth line: KENMORE — ASK MOTHER.',
    ],
    artwork: {
      backdrop: 'backgrounds/masonic_lodge_no4/background.webp',
      decks: ['freemasonry'],
      tint: '#24304a',
      locationSprite: 'location-masonic-lodge/location-masonic-lodge',
    },
    intro: [
      narrate(
        'You stop outside Fredericksburg Masonic Lodge No. 4. A tall man in a dark coat is waiting on the steps with a camera bag and a very old book.',
      ),
      say(
        'steve_gonzales',
        'You must be the one with the card. Steve Gonzales. Mrs. Gray called. She doesn’t call. She lets you find out she knew.',
        'portrait-greet',
      ),
      say(
        'steve_gonzales',
        'Ground rules. This lodge is real. George Washington was made a Mason here on November 4, 1752. He was twenty.',
        'portrait-talk',
      ),
      say(
        'steve_gonzales',
        'Your card, the legend, the cipher: none of that is Masonic. Today I show you exactly where the history stops and the story starts.',
        'portrait-think',
      ),
      say('steve_gonzales', 'And then, I think, which order those suits go in. Vamos.', 'cards-reveal'),
    ],
    outro: [
      say(
        'steve_gonzales',
        'So. History: Washington was made a Mason here, laid a cornerstone, ran spies. Legend: a ghost, a card, a game he never finished. Separate pockets.',
        'portrait-talk',
      ),
      say(
        'steve_gonzales',
        'Mrs. Gray says the marks lead under the town. When you need a guide down there, call me. Bring the ranger’s map, and a better flashlight than mine.',
        'portrait-neutral',
      ),
      narrate('You leave the lodge with Steve’s diagram in your pocket and the name of a house in your head.'),
    ],
    levels: [
      level('th-6', 1, {
        title: 'Cornerstone',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1021, options: { draw: 1 }, deckId: 'freemasonry', boardId: 'masonic_lodge_no4' },
        intro: [
          say(
            'steve_gonzales',
            'A cornerstone is the first stone you build on. Washington laid the Capitol’s in 1793, in a Masonic ceremony. Documented. Now lay yours.',
            'portrait-talk',
          ),
        ],
        outro: [
          say(
            'steve_gonzales',
            'Our working tools are builders’ tools. Masons use them to talk about conduct. The square: deal fairly. The compasses: know your limits.',
            'portrait-neutral',
          ),
          say(
            'steve_gonzales',
            'Lodges explain them a little differently. That’s normal. A symbol that means only one thing is a label.',
            'portrait-doubt',
          ),
          say(
            'steve_gonzales',
            'Four suits as four elements is tarot, a different tradition. A secret Masonic card ritual is nobody’s. Your cipher is borrowed costume.',
            'portrait-doubt',
          ),
        ],
        info: [
          {
            id: 'capitol-cornerstone',
            kind: 'history',
            title: 'The Capitol cornerstone',
            text: 'On September 18, 1793, George Washington laid the cornerstone of the United States Capitol in a ceremony conducted by Freemasons.',
            source: 'Architect of the Capitol',
            sprite: 'lodge-relics/carved-stone-tablet',
          },
          {
            id: 'working-tools',
            kind: 'history',
            title: 'The working tools',
            text: 'Freemasons explain their builders’ tools as lessons in conduct. One Grand Lodge’s public summary gives the square as morality, the level as equality and the plumb as upright living. An 18th-century text says the compasses keep us “within bounds.” Readings vary between lodges.',
            source:
              'Grand Lodge of California, “Fellow Craft Working Tools” (freemason.org); Grand Lodge of British Columbia and Yukon, “The Working Tools”',
          },
        ],
      }),
      level('th-6', 2, {
        title: 'Level and Plumb',
        game: 'war',
        objectiveText: 'Win War against Steve Gonzales.',
        setup: {
          seed: 2021,
          options: { opponent: 'steve_gonzales' },
          deckId: 'freemasonry',
          boardId: 'masonic_lodge_no4',
        },
        intro: [
          say(
            'steve_gonzales',
            'The level is about meeting as equals. War is the most level game there is. Nobody gets to be clever. Including me. Especially me.',
            'cards-shuffle',
          ),
        ],
        outro: [
          say(
            'steve_gonzales',
            'The plumb is the other half: upright when nobody’s checking. In VFX, if your verticals lean, the audience feels it before they can say why.',
            'portrait-talk',
          ),
          say(
            'steve_gonzales',
            'Before media work, I studied at Norwich, the oldest private military college in the country. Intelligence history sticks to you.',
            'portrait-neutral',
          ),
          say(
            'steve_gonzales',
            'Washington ran real spies: the Culper Ring, a code book, invisible ink. If he’d wanted to hide something, four suits on a card would be beneath him.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'norwich',
            kind: 'history',
            title: 'Norwich University',
            text: 'Norwich University in Vermont, founded in 1819 by Captain Alden Partridge, is the oldest private military college in the United States and is recognized as the birthplace of ROTC.',
            source: 'Norwich University',
          },
        ],
      }),
      level('th-6', 3, {
        title: 'Sources',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Steve and Sophia.',
        setup: {
          options: { opponents: ['steve_gonzales', 'sophia'], difficulty: 'easy' },
          deckId: 'freemasonry',
          boardId: 'masonic_lodge_no4',
        },
        intro: [
          narrate('The door opens behind you and Sophia walks in, carrying a pencil and a look you recognise.'),
          say(
            'sophia',
            'Mrs. Gray says you’re consulting a Freemason. I’m here to check his footnotes.',
            'portrait-doubt',
          ),
          say('steve_gonzales', 'Ranger. Welcome. Please check everything.', 'portrait-greet'),
        ],
        outro: [
          say('sophia', 'His dates are right. His sources are real. I hate it a little.', 'portrait-think'),
          say('steve_gonzales', 'Nobody has asked for my bibliography in years. I’m moved.', 'portrait-greet'),
          say('sophia', 'Don’t be. Where did you learn to cite like that?', 'portrait-neutral'),
          say(
            'steve_gonzales',
            'The lodge, mostly. And Burning Man. You build something huge with strangers, then write down who did what, so next year’s crew can find it.',
            'portrait-talk',
          ),
          say('sophia', 'That’s a trail inventory.', 'portrait-greet'),
          say(
            'steve_gonzales',
            '“Everyone is invited to work. Everyone is invited to play.” Their words, not mine. A good lodge night isn’t so different.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'pigpen-cipher',
            kind: 'history',
            title: 'The real “Masonic cipher”',
            text: 'The pigpen cipher, which swaps letters for shapes taken from a grid, was used by some Freemasons in the 1700s and is often called the Masonic cipher. It is publicly documented — and it uses no playing cards.',
            source: 'Scottish Rite Masonic Museum & Library',
            sprite: 'lodge-relics/columned-parchment',
          },
          {
            id: 'shriners',
            kind: 'history',
            title: 'The red hats',
            text: 'The red fez Dante remembered belongs to the Shriners, a fraternity whose members are Freemasons. Since 1922 the Shriners have run a network of children’s hospitals.',
            source: 'Shriners International; Shriners Children’s',
          },
        ],
      }),
      level('th-6', 4, {
        title: 'The Cipher',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['steve_gonzales'], difficulty: 'normal' },
          deckId: 'freemasonry',
          boardId: 'masonic_lodge_no4',
        },
        info: [
          {
            id: 'burning-man-principles',
            kind: 'history',
            title: 'Participation',
            text: 'Burning Man’s Ten Principles were written by co-founder Larry Harvey in 2004. Participation says “Everyone is invited to work. Everyone is invited to play.” Communal Effort values creative cooperation and collaboration.',
            source: 'Burning Man Project, “The 10 Principles” (burningman.org)',
          },
        ],
        intro: [
          say(
            'steve_gonzales',
            'Now the good part. Sophia’s map, Mrs. Gray’s survey, my compasses. Hold that corner down.',
            'portrait-think',
          ),
          narrate('You pin Sophia’s map flat while Steve lays the dossier’s survey photos over it, one on each mark.'),
        ],
        outro: [
          narrate(
            'Steve sets his compasses on the lodge and swings them across the map for you. The marks sit on a square: spade in the north, then diamond, heart and club, downstream.',
            'lodge-sketchbook-page',
          ),
          say(
            'steve_gonzales',
            'You found them upriver: club, heart, diamond, spade. The card reads downstream, from the north. Spade, diamond, heart, club.',
            'portrait-surprise',
          ),
          say(
            'sophia',
            'That’s how the river reads, too. Everything that reaches the bend came from upstream first.',
            'portrait-think',
          ),
          say(
            'steve_gonzales',
            'Whoever made this knew the town, the river, and just enough about Masons to borrow our tools. Not our secrets. We don’t have the kind they wanted.',
            'portrait-talk',
          ),
        ],
      }),
      level('th-6', 5, {
        title: 'The Keystone',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1014, options: { suits: 1 }, deckId: 'freemasonry', boardId: 'masonic_lodge_no4' },
        intro: [
          say(
            'steve_gonzales',
            'One more thing. The ledger’s blank thirteenth line. Blank to the eye, maybe. I light film for a living.',
            'portrait-neutral',
          ),
          narrate(
            'Steve angles a light panel low across the ledger, so every dent in the paper casts a shadow toward you.',
          ),
        ],
        outro: [
          narrate(
            'In the raking light, you see letters pressed into the blank line, written once with a dry pen: KENMORE — ASK MOTHER.',
            'ledger-impression',
          ),
          say('steve_gonzales', 'Kenmore. Betty Washington Lewis’s house. And “Mother” would be…', 'portrait-surprise'),
          say(
            'steve_gonzales',
            'No. Well. Maybe. Bring good manners. And don’t call it her house. I hear she’s particular.',
            'portrait-think',
          ),
        ],
        rewards: [credits(170), xp(200)],
      }),
    ],
    rewards: [
      deck('freemasonry'),
      board('masonic_lodge_no4'),
      board('masonic_study'),
      stamp('th-square-compasses'),
      credits(550),
      xp(320),
    ],
    info: [
      {
        id: 'lodge-history-vs-story',
        kind: 'note',
        title: 'History and story',
        text: 'Washington’s initiation at the Fredericksburg lodge in 1752 is documented history. The card, its suit cipher, the legend and the lodge’s part in the mystery are invented for the story. Reading the four suits as elements comes from tarot and other esoteric traditions, not Freemasonry; no secret card ceremony is a real Masonic practice; and the card’s glow is this game’s own magic.',
      },
    ],
    unlockRequirements: { chapter: 'th-5' },
  },

  // ───────────────────────────── Chapter 7 (written) ─────────────────────────────
  {
    id: 'th-7',
    index: 7,
    title: 'A Mother’s Opinion',
    locationId: 'kenmore',
    location: 'Kenmore',
    description: 'At her daughter’s house, Mary Ball Washington’s ghost has a few things to say about her son.',
    hostId: 'mary_ball_washington',
    cast: ['mary_ball_washington'],
    status: 'final',
    music: 'kenmore-manor-theme',
    mysteryThread:
      'At Kenmore — her daughter Betty’s house, not hers — Mary Ball Washington’s ghost tells her version of the legend: twelve hands of cards with her son, scored in her own ledger, and George walking away before the thirteenth because he was losing. A widow who kept the accounts of a farm for nearly thirty years, she wants the ledger closed honestly, not won. She confirms Steve’s reading, seals a letter for George and gives you the iron key to the cellar door where he waits.',
    beats: [
      'You visit Kenmore, the home of Fielding Lewis and Betty Washington Lewis, famous for its plaster ceilings and built on the work of the people the family enslaved.',
      'Mary Ball Washington’s ghost is visiting her daughter’s house; she corrects you that her own was on Charles Street.',
      'She tells the legend: widowed young, she kept the farm’s accounts and the score in the ledger; George left before the thirteenth hand because he was losing.',
      'She seals a letter to George: “You owe me a hand.”',
      'She confirms Steve’s reading (George surveyed from the north), entrusts you with the iron key to a cellar door on the old waterfront, and warns that he never concedes gracefully.',
    ],
    artwork: {
      backdrop: 'backgrounds/kenmore_parlor/background.webp',
      decks: ['fredericksburg'],
      tint: '#4a3a52',
      locationSprite: 'location-kenmore-mansion/location-kenmore-mansion',
    },
    intro: [
      narrate(
        'You step into Kenmore’s parlor. Sculpted plaster leaves bloom across the ceiling above you. Beneath it, a woman in a lace cap is already seated at the card table.',
      ),
      say('mary_ball_washington', 'You are standing on my daughter’s floor. Wipe your feet.', 'portrait-neutral'),
      narrate('You show her the card and the ledger’s last line. She does not look surprised.'),
      say(
        'mary_ball_washington',
        '“Ask Mother.” Of course he wrote that. A grown man, a general, a president, and still sending people to ask Mother.',
        'portrait-talk',
      ),
      say(
        'mary_ball_washington',
        'Before we go on: I did not live here. This was Betty’s house — Betty and Fielding’s. Mine was on Charles Street, a short walk away. Do get it right.',
        'portrait-doubt',
      ),
      say(
        'mary_ball_washington',
        'People mix the two houses up because it makes a tidier story. I have had quite enough tidy stories about this family. Sit.',
        'cards-deal',
      ),
    ],
    outro: [
      say(
        'mary_ball_washington',
        'Take your friends: the ranger’s map, the man with the camera, the Mason, the boy with the glowing paint. George will try to frighten you. He is very bad at it.',
        'portrait-think',
      ),
      say(
        'mary_ball_washington',
        'I may look in at the end. Not to help. To see something in this family finished, for once, in front of a witness.',
        'portrait-neutral',
      ),
      narrate(
        'You leave Kenmore with an iron key, a sealed letter and the distinct feeling of having been politely scolded.',
      ),
    ],
    levels: [
      level('th-7', 1, {
        title: 'Plaster Ceilings',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3206, options: { draw: 3 }, deckId: 'fredericksburg', boardId: 'kenmore_parlor' },
        intro: [
          say(
            'mary_ball_washington',
            'Betty’s ceilings took the plasterers months. Everyone admires them. You may sort cards while you do. Quietly.',
            'portrait-talk',
          ),
        ],
        outro: [
          say(
            'mary_ball_washington',
            'Fielding spent nearly everything they had making guns for the Revolution. People remember the ceilings. I remember the bills.',
            'portrait-think',
          ),
          say(
            'mary_ball_washington',
            'Betty’s lists name the people this family enslaved here, written down as property to be divided. Billy kept that door. Put him in your account.',
            'portrait-neutral',
          ),
        ],
        info: [
          {
            id: 'fredericksburg-gunnery',
            kind: 'history',
            title: 'The Fredericksburg gunnery',
            text: 'During the Revolutionary War, Fielding Lewis helped run the Fredericksburg Gun Manufactory to arm Virginia’s troops, spending much of his own fortune on it.',
            source: 'George Washington Foundation (Kenmore)',
            sprite: 'kenmore-heirlooms/carved-plaster-fragment',
          },
          {
            id: 'kenmore-household',
            kind: 'history',
            title: 'The people on Betty’s list',
            text: 'Historic Kenmore’s researchers trace the community the Lewises enslaved through four surviving documents, including a 1782 list in Betty Lewis’s hand. One man there, Billy, was 38 that year, and was probably the head of the household staff.',
            source: 'George Washington Foundation, “Billy at the Door” (kenmore.org)',
          },
        ],
      }),
      level('th-7', 2, {
        title: 'Family History',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Mary Ball Washington.',
        setup: {
          options: { opponents: ['mary_ball_washington'], difficulty: 'easy' },
          deckId: 'fredericksburg',
          boardId: 'kenmore_parlor',
        },
        intro: [
          say(
            'mary_ball_washington',
            'Go Fish. A child’s game. George played it badly as a child, too. He asked for everything and kept nothing.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'mary_ball_washington',
            'Very well, the legend. George and I played cards at this table. Twelve hands. I kept the score in that ledger. Somebody in this family had to keep accounts.',
            'portrait-talk',
          ),
          say(
            'mary_ball_washington',
            'I was widowed at Ferry Farm with the children still young, and kept that farm’s books for nearly thirty years. I know an unpaid debt when I see one.',
            'portrait-think',
          ),
          say(
            'mary_ball_washington',
            'He was losing. Before the thirteenth hand, he remembered urgent business in Williamsburg. On a Sunday.',
            'portrait-doubt',
          ),
        ],
        info: [
          {
            id: 'washington-cards',
            kind: 'history',
            title: 'Washington at cards',
            text: 'George Washington enjoyed cards. His account books record small sums he won and lost at games such as loo and whist.',
            source: 'George Washington’s Mount Vernon',
            sprite: 'mystery-parlor/leather-journal',
          },
        ],
      }),
      level('th-7', 3, {
        title: 'A Mother’s War',
        game: 'war',
        objectiveText: 'Win War against Mary Ball Washington.',
        setup: {
          seed: 3506,
          options: { opponent: 'mary_ball_washington' },
          deckId: 'fredericksburg',
          boardId: 'kenmore_parlor',
        },
        intro: [
          say(
            'mary_ball_washington',
            'War. My son made a career of it. People write that I never praised him. People were not at my table.',
            'portrait-neutral',
          ),
        ],
        outro: [
          say(
            'mary_ball_washington',
            'You play as if you mean it. Good. He never could abide anyone who meant it more than he did.',
            'portrait-think',
          ),
          say(
            'mary_ball_washington',
            'He is down there, under the town, waiting for someone to bring that card and finish what he ran from. He would rather haunt a cellar than lose to his mother.',
            'portrait-talk',
          ),
          say(
            'mary_ball_washington',
            'Or he would rather lose to a stranger than to me. That would be very like him. I find I do not mind, provided it ends.',
            'portrait-doubt',
          ),
        ],
      }),
      level('th-7', 4, {
        title: 'Letters',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['mary_ball_washington'], difficulty: 'normal' },
          deckId: 'fredericksburg',
          boardId: 'kenmore_parlor',
        },
        intro: [
          narrate(
            'Mary’s ghost sets a bundle of ribbon-tied letters beside you. Each is addressed in the same firm hand: To George.',
          ),
          say('mary_ball_washington', 'Sort my cards, and I shall sort my thoughts.', 'portrait-think'),
        ],
        outro: [
          narrate(
            'She chooses one letter, seals it with wax and hands it to you. On the front: George. On the back: You owe me a hand.',
            'mary-letter',
          ),
          say('mary_ball_washington', 'Give him that when he begins to sulk. He will begin to sulk.', 'portrait-doubt'),
          say(
            'mary_ball_washington',
            'I am not owed the win. I am owed the ending. There is a difference, and he knows it.',
            'portrait-neutral',
          ),
        ],
        info: [
          {
            id: 'meditation-rock',
            kind: 'history',
            title: 'Meditation Rock',
            text: 'Mary Ball Washington died in 1789 and is buried in Fredericksburg near Meditation Rock, a spot where, by tradition, she went to read and pray. A monument to her was dedicated there in 1894.',
            source: 'Washington Heritage Museums',
          },
        ],
      }),
      level('th-7', 5, {
        title: 'The Iron Key',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 3405, options: { suits: 1 }, deckId: 'fredericksburg', boardId: 'kenmore_parlor' },
        intro: [
          say(
            'mary_ball_washington',
            'One more. Then I shall decide whether you are fit to carry the key.',
            'portrait-neutral',
          ),
          say(
            'mary_ball_washington',
            'Your Mason has it right, by the way. George learned surveying as a boy. He starts every map at the north and works down.',
            'portrait-talk',
          ),
        ],
        outro: [
          narrate(
            'Mary’s ghost places an iron key in your palm. It is cold, and heavier than it looks.',
            'kenmore-iron-key',
          ),
          say(
            'mary_ball_washington',
            'The cellar door on the old waterfront. He chose it because it is damp and dramatic. Both are his favourite qualities.',
            'portrait-talk',
          ),
          say(
            'mary_ball_washington',
            'And if he cheats — he will try — remind him who taught him to count.',
            'portrait-greet',
          ),
        ],
        rewards: [credits(180), xp(210)],
      }),
    ],
    rewards: [deck('fredericksburg'), board('kenmore_parlor'), stamp('th-kenmore'), credits(600), xp(340)],
    unlockRequirements: { chapter: 'th-6' },
  },

  // ───────────────────────────── Chapter 8 (written) ─────────────────────────────
  {
    id: 'th-8',
    index: 8,
    title: 'Four Suits Below',
    locationId: 'underground-tunnels',
    location: 'The Underground Tunnels',
    description: 'Jak, Steve and Dante, one sealed door, and four suits that have to go in the right order.',
    hostId: 'steve_gonzales',
    cast: ['steve_gonzales', 'jak_gold', 'dante'],
    status: 'final',
    music: 'fxbg-after-dark',
    mysteryThread:
      'Under the old town, the iron key opens the way to a door with four suit-shaped sockets. Everyone brought a piece: Sophia’s map and Steve’s diagram, Dante’s eye for the hidden door and his map of the way back, Jak’s wrong theory that rules one answer out. You set the marks spade, diamond, heart, club, thirteen tumblers fall from king to ace, and the door opens on a candlelit card room.',
    beats: [
      'The iron key opens a cellar door on the old waterfront; Jak, Steve and Dante are waiting at the bottom of the steps.',
      'A junction splits four ways, one arch per suit; Steve’s diagram picks the spade arch, and Dante marks the way back in neon.',
      'Behind a curtain of roots, Dante spots a door with four sockets shaped like suits.',
      'Jak insists on new deck order (spades, diamonds, clubs, hearts); Steve disagrees.',
      'Dante draws a glowing map of the way down.',
      'You set the four marks in the order you have worked out; thirteen tumblers fall from king to ace, and the door opens.',
    ],
    artwork: {
      backdrop: 'backgrounds/menu/night.webp',
      decks: ['spycraft', 'dantes_world'],
      tint: '#2b2420',
      locationSprite: 'location-sealed-door-cellar/location-sealed-door-cellar',
    },
    intro: [
      narrate(
        'At the old waterfront, the iron key turns in a cellar door that sticks, then gives. Three flashlights are waiting for you at the bottom of the steps.',
      ),
      say(
        'jak_gold',
        'We’re rolling. For the record: privately owned cellar, permission granted by a ghost, via you. Anyone says stop, I stop.',
      ),
      say('dante', 'I brought neon markers! If we get lost, we’ll be lost beautifully.', 'portrait-surprise'),
      say(
        'steve_gonzales',
        'Brick barrel vaults. Old work. Stay together, touch nothing, and nobody say the word “treasure.”',
        'portrait-neutral',
      ),
      say('jak_gold', 'Treasure.'),
      say('steve_gonzales', 'Every time.', 'portrait-doubt'),
    ],
    outro: [
      say(
        'steve_gonzales',
        'This is as far as we go. Mrs. Gray’s file says the game was between two players, and the card is in your hand.',
        'portrait-think',
      ),
      say(
        'jak_gold',
        'Camera’s off. Some things don’t go on the internet. I’ll be right out here, respectfully not filming a door.',
      ),
      say('dante', 'Tell him I finished his commission! He’ll want to know! Probably!', 'portrait-greet'),
      narrate('You step through the door alone, the card warm in your hand.'),
    ],
    levels: [
      level('th-8', 1, {
        title: 'Down the Steps',
        game: 'freecell',
        objectiveText: 'FreeCell puzzle: finish the last four ranks. Use the free cells to plan ahead.',
        setup: { seed: 3300, options: { freecellPuzzle: true }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [
          narrate(
            'You reach a junction where the tunnel splits four ways. A suit is carved into the keystone of each arch.',
          ),
          say(
            'steve_gonzales',
            'Four ways, four suits. A free cell is where you park what you can’t use yet. Same with doubts.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'ropewalks',
            kind: 'history',
            title: 'Rope by hand',
            text: 'Before steam power, rope was made by hand at ropewalks, and Fredericksburg had them during the Revolution. A 1798 list of people enslaved by the Lewis family names three men, Bob, George and Randolph, as ropemakers.',
            source: 'George Washington Foundation, “Abraham and the Ropewalkers” (kenmore.org)',
          },
        ],
        outro: [
          narrate(
            'You take the spade arch first, as Steve’s diagram says. Dante tags the corner with a glowing arrow so you can find your way back.',
          ),
          say('dante', 'That’s a monster arrow. It has a face. It believes in you.', 'portrait-greet'),
          say(
            'steve_gonzales',
            'Look at this brickwork. Every one laid by hand, and the hands are never the name on the plaque.',
            'portrait-talk',
          ),
        ],
      }),
      level('th-8', 2, {
        title: 'Three Guides',
        game: 'go-fish',
        objective: { kind: 'books', min: 2 },
        objectiveText: 'Lay down 2 books against Jak, Steve and Dante.',
        setup: {
          options: { opponents: ['jak_gold', 'steve_gonzales', 'dante'], difficulty: 'easy' },
          deckId: 'inspire',
          boardId: 'underground_tunnels',
        },
        intro: [
          narrate(
            'You stop to rest by lantern light. Jak deals four hands onto an upturned crate without looking at the cards.',
          ),
          say('jak_gold', 'Four players, one deck, nobody cheats. I’m filming the cards, not the faces.'),
        ],
        outro: [
          say('steve_gonzales', 'Jak reads cards. I read history. Dante reads… what, exactly?', 'portrait-talk'),
          say(
            'dante',
            'Figure and ground. Stare at bricks long enough and one patch stops being wall. That patch is a door.',
            'portrait-think',
          ),
          narrate(
            'You look where Dante is pointing. Behind a curtain of roots is a door with four empty sockets, each shaped like a suit.',
          ),
        ],
      }),
      level('th-8', 3, {
        title: 'Echoes',
        game: 'war',
        objectiveText: 'Win War against Jak Gold.',
        setup: { seed: 2024, options: { opponent: 'jak_gold' }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [
          say('jak_gold', 'While Steve measures the door: War. Best way I know to stop thinking about the ceiling.'),
        ],
        outro: [
          say(
            'jak_gold',
            'My theory: the door wants new deck order. Spades, diamonds, clubs, hearts. Every fresh deck comes out of the box that way.',
          ),
          say(
            'steve_gonzales',
            'Your theory has a factory in it. That door is older than the factory.',
            'portrait-doubt',
          ),
          say('jak_gold', 'Noted. Disagreed. Filed.'),
        ],
        info: [
          {
            id: 'new-deck-order',
            kind: 'history',
            title: 'New deck order',
            text: 'Bicycle decks from the United States Playing Card Company come sealed in “new deck order”: ace to king of spades, ace to king of diamonds, then king to ace of clubs and king to ace of hearts. Magicians and cardists rely on it.',
            source: 'United States Playing Card Company (Bicycle)',
            sprite: 'jak-black-gold/red-card-fan',
          },
        ],
      }),
      level('th-8', 4, {
        title: 'The Lantern Path',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1018, options: { draw: 3 }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [
          say(
            'dante',
            'My markers are fading. Quick — follow the arrows before they stop believing in us.',
            'portrait-talk',
          ),
        ],
        outro: [
          narrate(
            'Dante hands you the sketch he has been drawing all the way down: a glowing map of every turn, with a small monster waving at each one.',
            'neon-tunnel-map',
          ),
          say(
            'dante',
            'So we can find our way out. Or so the next people can find us. Both good outcomes.',
            'portrait-greet',
          ),
        ],
      }),
      level('th-8', 5, {
        title: 'The Four-Suit Door',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: set the four marks, then clear one-suit Spider.',
        setup: { seed: 1001, options: { suits: 1 }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [
          say(
            'steve_gonzales',
            'This is the door. Four sockets, four marks, and your card carries all of them. You set the order.',
            'portrait-neutral',
          ),
          narrate(
            'You hold the Thirteenth Hand card up to the door. Its four marked corners line up with the sockets.',
          ),
          say(
            'jak_gold',
            'Club from the river, heart from Dante’s brief, diamond from my footage, spade from Mrs. Gray’s file. Everybody brought one.',
          ),
        ],
        puzzle: {
          prompt: 'You hold the card to the door. In which order do you set the four marks?',
          answer: ['spades', 'diamonds', 'hearts', 'clubs'],
          // Earned clues the picker offers to look at again (none is required).
          clues: ['lodge-sketchbook-page', 'sophia-river-map', 'thirteenth-hand-dossier'],
          hints: [
            say(
              'jak_gold',
              'Didn’t budge. New deck order, maybe? Spades, diamonds, clubs, hearts. Works on every deck I’ve ever opened.',
            ),
            say(
              'dante',
              'What about the order you found them in? Club, heart, diamond, spade? Or is that backwards… oh.',
              'portrait-think',
            ),
            say(
              'steve_gonzales',
              'Read the diagram. You came upriver. The card reads downstream, starting in the north.',
              'portrait-think',
            ),
            say(
              'steve_gonzales',
              'Spade, diamond, heart, club. Downstream from the north. Trust the river.',
              'portrait-talk',
            ),
          ],
          solved: [
            narrate(
              'You set the marks one after another: spade, diamond, heart, club. Behind the door, something heavy begins to turn.',
            ),
            say(
              'steve_gonzales',
              'That’s the order. Now the tumblers — thirteen of them, king down to ace, in one long run.',
              'portrait-surprise',
            ),
          ],
        },
        outro: [
          narrate(
            'You hear thirteen tumblers fall, king to ace. The door swings open on a candlelit card room.',
            'four-suit-puzzle',
          ),
          say('jak_gold', 'I didn’t film any of that. I was too busy having feelings.'),
          say('steve_gonzales', 'Madre mía.', 'portrait-surprise'),
          say('dante', 'There’s a guy in there. A see-through guy. In a tricorn hat.', 'portrait-surprise'),
        ],
        rewards: [credits(190), xp(220)],
      }),
    ],
    rewards: [board('underground_tunnels'), stamp('th-lantern-cellar'), credits(650), xp(360)],
    unlockRequirements: { chapter: 'th-7' },
  },

  // ───────────────────────────── Chapter 9 (written) ─────────────────────────────
  {
    id: 'th-9',
    index: 9,
    title: 'The Thirteenth Hand',
    locationId: 'washington-spectral-parlor',
    location: 'Washington’s Spectral Card Parlor',
    description:
      'George Washington’s ghost has waited a very long time to finish this game. He does not plan to lose it.',
    hostId: 'george_washington',
    cast: ['george_washington', 'mary_ball_washington'],
    status: 'final',
    music: 'esoteric-order-loop',
    mysteryThread:
      'The legend resolves: George Washington’s ghost — who planted the card, sketched the heron and commissioned Dante, all to lure a challenger — has waited to play the thirteenth hand he walked away from. Every portrait flatters him; one ledger, in his mother’s hand, says he left. You win it, his mother’s letter turns the loss into a debt paid, and the card awakens with all four corners filled.',
    beats: [
      'You enter a card room lit by candles that never burn down; George Washington’s ghost greets you with ceremony and pride.',
      'He admits (as the story’s legend) that he walked away from his mother’s card table before the thirteenth hand, and has waited ever since.',
      'He planted the card in Lot 13, sketched the heron and paid Dante in his own face — all to bring a challenger to his table.',
      'Five escalating games; the twelfth hand from the ledger returns; his mother arrives for the last.',
      'You win the thirteenth hand. He demands a recount until you give him Mary’s letter: “You owe me a hand.” He stays to the end, and lets the record say so.',
      'The card awakens. The game is finished, and a rematch is promised.',
    ],
    artwork: {
      backdrop: 'backgrounds/washington_final_table/background.webp',
      decks: ['washington_ghost'],
      tint: '#1c2a3a',
      locationSprite: 'location-generals-spectral-parlor/location-generals-spectral-parlor',
    },
    intro: [
      narrate(
        'You step into a card room that should not fit under the town. The candles burn without shrinking. At the head of the table, a tall ghost in a blue coat rises to meet you.',
      ),
      say(
        'george_washington',
        'At last! A challenger! Do you know how long I have waited? Two hundred and — never mind how long.',
        'portrait-greet',
      ),
      narrate('You show him General Monsterton, Dante’s three-eyed neon portrait of him.'),
      say(
        'george_washington',
        'Three eyes. Magnificent. Precisely the vigor I asked for. I look as though I could win at anything.',
        'portrait-surprise',
      ),
      say(
        'george_washington',
        'Yes, it was I. The card in Lot 13, the heron, the commission. A general recruits. Twelve hands were played in my mother’s parlor. I was called away before the thirteenth.',
        'portrait-think',
      ),
      say(
        'george_washington',
        'They have written a great deal about me. Most of it flattering. One ledger is not, and it is in my mother’s hand.',
        'cards-signature',
      ),
      say(
        'george_washington',
        'Tonight we finish it. Five games. I intend to win all five, and to be remembered winning them.',
        'cards-signature',
      ),
    ],
    outro: [
      say(
        'george_washington',
        'Keep the card. It is finished now, as the game is. And take my deck. I shan’t need it until the rematch.',
        'portrait-greet',
      ),
      say('george_washington', 'There will be a rematch.', 'cards-signature'),
      say('mary_ball_washington', 'There will be a nap, George.', 'portrait-doubt'),
      narrate(
        'The candles go out together. When your eyes adjust, you are standing in an empty cellar, holding a card that glows faintly at the corners.',
      ),
    ],
    levels: [
      level('th-9', 1, {
        title: 'The General’s Welcome',
        game: 'war',
        objectiveText: 'Win War against George Washington’s ghost.',
        setup: {
          seed: 2035,
          options: { opponent: 'george_washington' },
          deckId: 'washington_ghost',
          boardId: 'washington_final_table',
        },
        intro: [
          say(
            'george_washington',
            'We begin with War. I have some experience. Most of it was losing, until it wasn’t.',
            'cards-deal',
          ),
        ],
        outro: [
          say(
            'george_washington',
            'A warm-up. I allowed you that. It was strategy. I was famous for strategy. Look it up. Not the losses. The strategy.',
            'portrait-doubt',
          ),
        ],
        info: [
          {
            id: 'crossing-the-delaware',
            kind: 'history',
            title: 'The Delaware crossing',
            text: 'On the night of December 25–26, 1776, Washington led his army across the icy Delaware River and surprised the Hessian garrison at Trenton the next morning.',
            source: 'George Washington’s Mount Vernon',
          },
        ],
      }),
      level('th-9', 2, {
        title: 'Spectral Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3200, options: { draw: 3 }, deckId: 'washington_ghost', boardId: 'washington_final_table' },
        intro: [
          narrate('The cards deal themselves in front of you, three at a time, drifting into place like snow.'),
          say(
            'george_washington',
            'Patience. A soldier’s game. The winter at Valley Forge was mostly patience. And soup.',
            'portrait-talk',
          ),
        ],
        outro: [
          say(
            'george_washington',
            'Hm. You are steadier than my generals. Do not tell them I said so. They are also ghosts, and they gossip.',
            'portrait-think',
          ),
        ],
        info: [
          {
            id: 'valley-forge',
            kind: 'history',
            title: 'Valley Forge',
            text: 'The Continental Army camped at Valley Forge, Pennsylvania, through the winter of 1777–78. Baron von Steuben drilled the troops there, and the army marched out in June 1778 better trained.',
            source: 'National Park Service, Valley Forge National Historical Park',
          },
        ],
      }),
      level('th-9', 3, {
        title: 'The Twelfth Hand',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Collect 3 books: choose your asks and remember the replies.',
        setup: {
          options: { opponents: ['george_washington'], difficulty: 'normal' },
          deckId: 'washington_ghost',
          boardId: 'washington_final_table',
        },
        intro: [
          narrate(
            'You recognise the deal in front of you: the twelfth hand from the ledger, laid out exactly as it was written.',
          ),
          say(
            'george_washington',
            'Mother kept that ledger. Mother keeps everything. Including accounts I would prefer were closed.',
            'portrait-doubt',
          ),
        ],
        outro: [
          say(
            'george_washington',
            'You solved the twelfth hand. I lost that one, originally. I maintain the candle was in my eyes.',
            'portrait-surprise',
          ),
          say(
            'george_washington',
            'Every portrait of me has a fine coat and a certain look. Not one shows me leaving a card table early. She was the only one who wrote that down.',
            'portrait-think',
          ),
        ],
      }),
      level('th-9', 4, {
        title: 'No Retreat',
        game: 'spider',
        objectiveText: 'Clear one-suit Spider.',
        setup: { seed: 3400, options: { suits: 1 }, deckId: 'washington_ghost', boardId: 'washington_final_table' },
        intro: [
          say(
            'george_washington',
            'Spider. A long game, and no retreat. I am, historically, a great believer in a well-timed retreat. Not tonight.',
            'portrait-neutral',
          ),
        ],
        outro: [
          say('george_washington', 'Four games to you. This is becoming —', 'portrait-doubt'),
          narrate('A cold draft crosses the room. Every candle leans toward the door behind you.'),
          say('george_washington', 'Mother?', 'portrait-surprise'),
        ],
        info: [
          {
            id: 'long-island-retreat',
            kind: 'history',
            title: 'A famous retreat',
            text: 'After losing the Battle of Long Island in August 1776, Washington moved his whole army across the East River to Manhattan in a single night, hidden by darkness and fog.',
            source: 'George Washington’s Mount Vernon',
          },
        ],
      }),
      level('th-9', 5, {
        title: 'The Thirteenth Hand',
        game: 'go-fish',
        finale: true,
        objectiveText: 'Finale: win the thirteenth hand against George Washington’s ghost.',
        setup: {
          options: { opponents: ['george_washington'], difficulty: 'easy' },
          deckId: 'washington_ghost',
          boardId: 'washington_final_table',
        },
        intro: [
          say(
            'mary_ball_washington',
            'Don’t stop on my account, George. I’m only here to watch you finish something.',
            'portrait-neutral',
          ),
          say('george_washington', 'Mother. You look… well. Considering.', 'portrait-doubt'),
          narrate(
            'You lay the Thirteenth Hand card face up in the middle of the table. All four of its corners are marked.',
          ),
          say(
            'george_washington',
            'Thirteen ranks, thirteen books. Whoever lays down more wins the thirteenth hand — and the card.',
            'cards-signature',
          ),
          say('george_washington', 'And this time the ledger records how it ended. Not how I left.', 'portrait-think'),
        ],
        outro: [
          narrate(
            'You lay down your last book. The Thirteenth Hand card begins to glow at all four corners: spade, diamond, heart and club.',
            'awakened-card',
          ),
          say('george_washington', 'I demand a recount. And a rematch. And —', 'portrait-surprise'),
          narrate('You hand George the letter from his mother. He reads the back, and goes quiet.'),
          say(
            'george_washington',
            '“You owe me a hand.” …I suppose I did. Longer than I have owed anyone anything.',
            'portrait-doubt',
          ),
          say('mary_ball_washington', 'Well played. Both of you. Mostly the one who is alive.', 'portrait-greet'),
          say(
            'mary_ball_washington',
            'Write it down, George. Lost the thirteenth hand, and stayed to the end. It reads better than you think.',
            'portrait-talk',
          ),
          say(
            'george_washington',
            'Lost, and stayed. Very well. Two centuries of sulking, concluded. I feel… lighter. Which, for a ghost, is saying something.',
            'portrait-think',
          ),
        ],
        rewards: [credits(220), xp(260)],
      }),
    ],
    rewards: [
      deck('washington_ghost'),
      board('washington_final_table'),
      stamp('th-spectral-tricorn'),
      achievement('chronicles-complete'),
      credits(800),
      xp(400),
    ],
    info: [
      {
        id: 'about-the-legend',
        kind: 'note',
        title: 'About the legend',
        text: 'Washington really did play cards and record his winnings and losses. The unfinished game, the ghosts, the card and the spectral parlor are a legend invented for this story.',
      },
    ],
    unlockRequirements: { chapter: 'th-8' },
  },
];

/**
 * The campaign's last scene, played once the thirteenth hand is won (and
 * replayable from the journal). It opens the ghost rematches.
 */
export const EPILOGUE: readonly DialogueLine[] = [
  narrate(
    'A week later, you bring the card back to Cheryl’s shop, where it all began. It sits under the lamp in a frame nobody can afford.',
  ),
  say(
    'cheryl',
    'Provenance: one ghost, four witnesses and a receipt for everything. Best file I’ve ever written. The sign says NOT FOR SALE. DON’T ASK.',
    'portrait-doubt',
  ),
  say(
    'sophia',
    'The heron’s still at the bend. I logged her this morning. Some things are allowed to stay a mystery. The sign-in sheets are not among them.',
    'portrait-greet',
  ),
  say(
    'dante',
    'All thirteen monster cards are done! The client paid the final invoice. In ones. Obviously.',
    'portrait-surprise',
  ),
  say(
    'jak_gold',
    'My video’s up: “I Have No Footage of a Ghost (Proof).” The camera was off for the good part. The comments are about my flourish anyway.',
  ),
  say(
    'mrs_gray',
    'File closed. Reason: concluded. I’ve wanted to type that word for a very long time. Under sources, I put your name. Don’t frame it.',
    'portrait-neutral',
  ),
  say(
    'steve_gonzales',
    'I’ve added a page to the lodge’s research: history in one column, legend in the other. Sophia approved it. Twice.',
    'portrait-talk',
  ),
  narrate(
    'On your way out, you find an envelope on the counter, sealed in blue wax. Inside are a single dollar bill and a note in a very confident hand.',
  ),
  say('george_washington', 'Best of thirteen? — G. W.', 'cards-signature'),
  narrate('Under his signature, in a smaller and much firmer hand, someone has added a line for you.'),
  say('mary_ball_washington', 'He will lose again. Do keep score. — M. W.', 'portrait-talk'),
  narrate('You smile. Somewhere under the town, a candle lights itself. Ghost rematches are open.'),
];

export const EPILOGUE_TITLE = 'Epilogue: Not for Sale';

/** Passport stamps, one per chapter, with their artwork. */
const STAMP_SPRITES: Record<string, string> = {
  'th-antique-shop': 'passport-stamps/antique-clock-key',
  'th-river-station': 'passport-stamps/heron-river',
  'th-neon-monster': 'passport-stamps/neon-monster',
  'th-cards-camera': 'passport-stamps/cards-and-camera',
  'th-dossier': 'passport-stamps/sealed-dossier',
  'th-square-compasses': 'passport-stamps/square-and-compasses',
  'th-kenmore': 'passport-stamps/kenmore-mansion',
  'th-lantern-cellar': 'passport-stamps/lantern-cellar',
  'th-spectral-tricorn': 'passport-stamps/spectral-tricorn',
};

export const STAMPS: readonly PassportStamp[] = STORY_CHAPTERS.flatMap((c) =>
  c.rewards.flatMap((r) =>
    r.kind === 'stamp' ? [{ id: r.id, chapter: c.id, label: c.location, sprite: STAMP_SPRITES[r.id] ?? '' }] : [],
  ),
);
export const ALL_LEVELS: readonly StoryLevel[] = STORY_CHAPTERS.flatMap((c) => c.levels);
export const getChapter = (id: string) => STORY_CHAPTERS.find((c) => c.id === id);
export const getLevel = (id: string) => ALL_LEVELS.find((l) => l.id === id);
export const chapterOfLevel = (levelId: string) => STORY_CHAPTERS.find((c) => c.levels.some((l) => l.id === levelId));
export const isCampaignLevelId = (id: string) => ALL_LEVELS.some((l) => l.id === id);
