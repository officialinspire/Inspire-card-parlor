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
 * whole game. Go Fish challenges are dealt fresh on each try at an Easy table,
 * and their objectives are checked to be reachable.
 *
 * Chapters 1–2 are written. Chapters 3–9 are outlines (`status: 'draft'`):
 * their plot beats and challenges are defined, but their scenes are short
 * narration marked as draft — no character is given lines that have not been
 * written and approved.
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
/** Outline narration for chapters not yet written: short, and labelled as a draft. */
const draft = (text: string, discovers?: string): DialogueLine => ({ ...narrate(text, discovers), status: 'draft' });

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

const DRAFT_LABEL = 'Story in development';

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
      'She will only talk to someone who can play: five games across the shop.',
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
      narrate('On the counter you see an estate-sale box tied with string. A single card lies on top.'),
      say('cheryl', 'Bought the whole lot for twenty dollars. Twelve old decks, a ledger, and that.', 'portrait-talk'),
      narrate(
        'You pick up the card. It has no suit and no number — only the words THE THIRTEENTH HAND, and four blank corners.',
        'thirteenth-hand-card',
      ),
      say(
        'cheryl',
        'Before you ask: no, I don’t know what it’s worth. Nobody prints a card without a suit. Somebody wanted it noticed.',
        'portrait-doubt',
      ),
      say('cheryl', 'You want to know more, you sit and play. I don’t talk shop with strangers who can’t shuffle.'),
    ],
    outro: [
      say('cheryl', 'The River Station is Sophia’s. Parks and Rec. She knows every heron on that river by name.'),
      say(
        'cheryl',
        'Take the card. Bring it back in one piece. And keep the receipt for anything you buy.',
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
        intro: [say('cheryl', 'War. No thinking required. I want to see if you flinch.')],
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
          say('cheryl', 'Aces up. If it’s missing cards, I want to know.'),
        ],
        outro: [
          narrate(
            'Under the decks you find a leather ledger. Twelve hands of cards are written out in faded ink. The thirteenth line is blank.',
            'ledger-of-twelve',
          ),
          say('cheryl', 'Somebody kept score. And somebody stopped.', 'portrait-think'),
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
        intro: [say('cheryl', 'Go Fish. Don’t laugh. It’s how I check a matched set.')],
        outro: [
          say('cheryl', 'Every deck in that box is complete. Fifty-two each. So where did the extra card come from?'),
        ],
      }),
      level('th-1', 4, {
        title: 'The Locked Case',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1001, deckId: 'fredericksburg', boardId: 'cheryls_antique_shop' },
        intro: [
          narrate('You notice that Cheryl’s display case has a puzzle lock: a FreeCell deal painted under the glass.'),
          say('cheryl', 'My late husband’s idea of security. Solve it and I’ll show you what was in the lid.'),
        ],
        outro: [
          narrate(
            'You find an old postcard of the Rappahannock tucked in the box lid. A heron is sketched on the back, with two words: River Station.',
            'river-postcard',
          ),
        ],
      }),
      level('th-1', 5, {
        title: 'Under the Lamp',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1035, options: { suits: 1 }, deckId: 'fredericksburg', boardId: 'cheryls_antique_shop' },
        intro: [say('cheryl', 'One more. Spider. Then we look at that card under a proper lamp.')],
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
    unlockRequirements: {},
  },

  // ───────────────────────────── Chapter 2 (written) ─────────────────────────────
  {
    id: 'th-2',
    index: 2,
    title: 'The Heron’s Bend',
    locationId: 'rappahannock-river-station',
    location: 'Rappahannock River Station',
    description: 'A heron sketch, a trail marker nobody remembers and a letter that never reached Dante.',
    hostId: 'sophia',
    cast: ['sophia'],
    status: 'final',
    music: 'river-dawn',
    mysteryThread:
      'The first suit mark — a club — is carved on an old trail marker at the heron’s bend. A returned envelope ties the card to Dante; an old map shows four marks near the waterfront.',
    beats: [
      'You walk the river path to Sophia’s ranger station.',
      'Sophia recognises the heron in the postcard sketch as one she logs every morning at the same bend.',
      'She mentions a man who filmed her lobby and asked for the visitor logs: Jak.',
      'The wildlife log, an unlisted trail marker carved with a club, and the lost-and-found turn up clues.',
      'An envelope addressed to Dante at iSMOKESHOP came back to the station with a heron card inside.',
      'An old map shows four marks by the waterfront. Sophia sends you to Dante.',
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
        'Morning. If you’re here about the heron, she’s fine. She just likes the attention.',
        'portrait-greet',
      ),
      narrate('You show Sophia the postcard and the card.'),
      say(
        'sophia',
        'That sketch is a great blue heron, drawn at this bend. We log her every morning. Whoever drew it has stood right here.',
        'portrait-think',
      ),
      say(
        'sophia',
        'Last week a man with a phone on a stick filmed our lobby and asked for our visitor logs. Jak something. He said it was his constitutional right. It was also my lunch break.',
        'portrait-doubt',
      ),
      say('sophia', 'I have a shift to finish. Play a few hands while I work, and I’ll pull the logs.'),
    ],
    outro: [
      say(
        'sophia',
        'Somebody sent Dante a heron card, and it came back here. That’s not a coincidence.',
        'portrait-think',
      ),
      say(
        'sophia',
        'Go see him. And if you run into the man with the phone on a stick, you didn’t hear about the logs from me.',
      ),
      narrate('You fold the map into your pocket and set off for Dante’s shop.'),
    ],
    levels: [
      level('th-2', 1, {
        title: 'Field Notes',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 3101, options: { draw: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [say('sophia', 'Sort these while I check the wildlife log. Patience is most of this job.')],
        outro: [
          narrate(
            'You read the wildlife log over Sophia’s shoulder: the same heron, at the same bend, every morning for years.',
            'field-journal-page',
          ),
          say('sophia', 'Consistent. Herons usually are. People aren’t.'),
        ],
      }),
      level('th-2', 2, {
        title: 'Trail Markers',
        game: 'war',
        objectiveText: 'Win War against Sophia.',
        setup: {
          seed: 2001,
          options: { opponent: 'sophia' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [say('sophia', 'Quick game. Then we walk to the bend.')],
        outro: [
          narrate(
            'At the heron’s bend, an old trail marker leans toward the water. Carved into it is a small club — the exact size of one blank corner on your card.',
            'club-mark',
          ),
          say('sophia', 'That marker is older than I am. It isn’t on our trail inventory.', 'portrait-surprise'),
        ],
      }),
      level('th-2', 3, {
        title: 'Lost and Found',
        game: 'go-fish',
        objective: { kind: 'books', min: 3 },
        objectiveText: 'Lay down 3 books against Sophia.',
        setup: {
          options: { opponents: ['sophia'], difficulty: 'easy' },
          deckId: 'eastern_woodlands',
          boardId: 'rappahannock_riverside',
        },
        intro: [say('sophia', 'Our lost-and-found has thirty years of everything. Help me sort while we play.')],
        outro: [
          narrate(
            'In the lost-and-found you find an envelope addressed to Dante at iSMOKESHOP, stamped Return to Sender. Inside is a card with a heron on it.',
            'returned-envelope',
          ),
          say(
            'sophia',
            'Dante? He painted the mural for our kids’ program. Good kid. Terrible handwriting.',
            'portrait-greet',
          ),
        ],
      }),
      level('th-2', 4, {
        title: 'The Archive Drawer',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1016, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [say('sophia', 'There’s an old map in the archive drawer. Let’s see if it’s the one I’m thinking of.')],
        outro: [
          narrate(
            'You unfold a map of the river and the old town. Four small marks sit near the waterfront.',
            'old-river-map',
          ),
          say(
            'sophia',
            'Those marks don’t match any survey I know. I’d call them decoration — if one of them weren’t a club.',
            'portrait-think',
          ),
        ],
      }),
      level('th-2', 5, {
        title: 'High Water',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1002, options: { suits: 1 }, deckId: 'eastern_woodlands', boardId: 'rappahannock_riverside' },
        intro: [say('sophia', 'The river’s rising, and so is my paperwork. One last game.')],
        outro: [say('sophia', 'One suit found, three to go. I’ll watch the river. You watch that card.')],
        rewards: [credits(130), xp(160)],
      }),
    ],
    rewards: [
      board('rappahannock_riverside'),
      deck('eastern_woodlands'),
      stamp('th-river-station'),
      credits(350),
      xp(230),
    ],
    unlockRequirements: { chapter: 'th-1' },
  },

  // ───────────────────────────── Chapters 3–9 (outlines) ─────────────────────────────
  {
    id: 'th-3',
    index: 3,
    title: 'Neon Commission',
    locationId: 'ismokeshop',
    location: 'iSMOKESHOP',
    description: 'Dante has been paid to paint thirteen monsters for a client he has never met.',
    hostId: 'dante',
    cast: ['dante', 'sophia'],
    status: 'draft',
    music: 'tape-deck',
    mysteryThread:
      'An anonymous client commissioned neon monster versions of the card; the reference sketch hides the second suit mark, a heart.',
    beats: [
      'You find Dante at his art counter, surrounded by neon monster sketches.',
      'He shows an anonymous commission: thirteen monster card designs, paid in advance, with a reference sketch to copy.',
      'The returned heron card was his — the client asked for it back. Dante does not know why.',
      'The reference sketch hides a heart that matches the card’s second corner.',
      'Dante, cheerfully clueless about Freemasonry, recognises the client’s handwriting from a filming permit Jak once showed him.',
    ],
    artwork: {
      backdrop: 'backgrounds/artists_studio/background.webp',
      decks: ['dantes_world'],
      tint: '#2a1240',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-neon-art-shop/location-neon-art-shop',
    },
    intro: [draft('You arrive at Dante’s shop. Neon monster sketches cover every wall.')],
    outro: [draft('With the heart mark found, you follow the trail to Jak’s backroom parlor.')],
    levels: [
      level('th-3', 1, {
        title: 'Monster Sketches',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1013, options: { draw: 1 }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [draft('You help Dante sort a stack of monster sketches.')],
      }),
      level('th-3', 2, {
        title: 'Colour Clash',
        game: 'war',
        objectiveText: 'Win War against Dante.',
        setup: { seed: 2026, options: { opponent: 'dante' }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [draft('Dante challenges you to War with his neon deck.')],
      }),
      level('th-3', 3, {
        title: 'The Commission',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1018, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [draft('You examine the anonymous commission form.')],
        outro: [draft('You read the commission: thirteen designs, signed with initials only.', 'commission-form')],
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
        intro: [draft('You play Go Fish while Dante’s paint dries.')],
      }),
      level('th-3', 5, {
        title: 'The Hidden Heart',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1003, options: { suits: 1 }, deckId: 'dantes_world', boardId: 'artists_studio' },
        intro: [draft('You study the reference sketch under Dante’s black light.')],
        outro: [draft('You spot a heart hidden in the sketch. It matches your card’s second corner.', 'heart-mark')],
        rewards: [credits(140), xp(170)],
      }),
    ],
    rewards: [deck('dantes_world'), board('artists_studio'), stamp('th-neon-monster'), credits(400), xp(260)],
    unlockRequirements: { chapter: 'th-2' },
  },
  {
    id: 'th-4',
    index: 4,
    title: 'On the Record',
    locationId: 'jaks-backroom-parlor',
    location: 'Jak’s Backroom Card Parlor',
    description: 'Jak has filmed, filed and flourished his way to a file nobody wanted him to read.',
    hostId: 'jak_gold',
    cast: ['jak_gold', 'dante'],
    status: 'draft',
    music: 'high-roller',
    mysteryThread:
      'Jak’s records request came back with a redacted page naming Operation Thirteenth Hand; slow-motion footage of a flourish reveals the third mark, a diamond.',
    beats: [
      'You find Jak mid-video, narrating a cardistry routine to his camera.',
      'He explains he filmed the River Station lobby while chasing a public-records request.',
      'The reply came back heavily redacted, with one name left visible: Operation Thirteenth Hand.',
      'Jak’s slow-motion footage of the card shows a diamond printed inside its edge — the third mark.',
      'A receipt for a custom card case leads to an address with no name on the door.',
    ],
    artwork: {
      backdrop: 'backgrounds/backroom_card_table/background.webp',
      decks: ['jak_gold'],
      tint: '#2c2a3a',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-jaks-cardistry-parlor/location-jaks-cardistry-parlor',
    },
    intro: [draft('You step into Jak’s backroom parlor. A ring light is on, and so is his camera.')],
    outro: [draft('You follow a receipt in Jak’s files to an unmarked office above a shuttered storefront.')],
    levels: [
      level('th-4', 1, {
        title: 'Rolling',
        game: 'war',
        objectiveText: 'Win War against Jak Gold.',
        setup: { seed: 2030, options: { opponent: 'jak_gold' }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [draft('You play War while Jak films for his channel.')],
      }),
      level('th-4', 2, {
        title: 'Three-Card Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1010, options: { draw: 3 }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [draft('You sort Jak’s practice decks, three cards at a time.')],
        outro: [draft('Among Jak’s papers you find a receipt for a custom card case.', 'cardistry-receipt')],
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
        intro: [draft('Jak lays out his records requests while you play.')],
      }),
      level('th-4', 4, {
        title: 'Redacted',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 3310, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [draft('You read the redacted reply, line by blacked-out line.')],
      }),
      level('th-4', 5, {
        title: 'Slow Motion',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 3415, options: { suits: 1 }, deckId: 'jak_gold', boardId: 'backroom_card_table' },
        intro: [draft('You watch Jak replay his footage of the card frame by frame.')],
        outro: [draft('You see it in the frozen frame: a diamond printed inside the card’s edge.', 'diamond-mark')],
        rewards: [credits(150), xp(180)],
      }),
    ],
    rewards: [
      deck('jak_gold'),
      board('jak_golds_casino'),
      stamp('th-cards-camera'),
      achievement('halfway-home'),
      credits(450),
      xp(280),
    ],
    unlockRequirements: { chapter: 'th-3' },
  },
  {
    id: 'th-5',
    index: 5,
    title: 'Operation Thirteenth Hand',
    locationId: 'mrs-gray-safehouse',
    location: 'Mrs. Gray’s Intelligence Safehouse',
    description: 'A woman with no first name, a dossier with no date, and a legend somebody borrowed.',
    hostId: 'mrs_gray',
    cast: ['mrs_gray', 'jak_gold'],
    status: 'draft',
    music: 'window-rain',
    mysteryThread:
      'Mrs. Gray reveals that the fictional Operation Thirteenth Hand borrowed an old local legend — a card game George Washington never finished — as its cover; the dossier holds the fourth mark, a spade.',
    beats: [
      'You climb to an unmarked office. Mrs. Gray is expecting you.',
      'She has watched the card’s trail since Lot 13 went to auction.',
      'The dossier: Operation Thirteenth Hand (fiction) used a local legend as cover — twelve hands played, the thirteenth never dealt.',
      'She tests you at five tables before she hands over anything.',
      'The dossier’s ace of spades carries the fourth mark. She warns you the legend may not be only a legend.',
    ],
    artwork: {
      backdrop: 'backgrounds/mrs_gray_safehouse/background.webp',
      decks: ['spycraft'],
      tint: '#1d2328',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-intelligence-safehouse/location-intelligence-safehouse',
    },
    intro: [draft('You climb the stairs to an office with no name on the door. Mrs. Gray is already seated.')],
    outro: [
      draft('All four suit marks are found. Mrs. Gray points you to the Masonic lodge to learn which story is true.'),
    ],
    levels: [
      level('th-5', 1, {
        title: 'Dead Drop',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1017, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [draft('Mrs. Gray sets a FreeCell deal in front of you and waits.')],
      }),
      level('th-5', 2, {
        title: 'Interview',
        game: 'war',
        objectiveText: 'Win War against Mrs. Gray.',
        setup: { seed: 2010, options: { opponent: 'mrs_gray' }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [draft('You play War with Mrs. Gray in silence.')],
      }),
      level('th-5', 3, {
        title: 'Cipher Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3205, options: { draw: 3 }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [draft('You sort a deck of coded cards from the operation’s files.')],
        outro: [draft('Mrs. Gray slides the dossier across the desk to you.', 'thirteenth-hand-dossier')],
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
        intro: [draft('You wait for answers. Few come.')],
      }),
      level('th-5', 5, {
        title: 'The Ace of Spades',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1009, options: { suits: 1 }, deckId: 'spycraft', boardId: 'mrs_gray_safehouse' },
        intro: [draft('You reach the last folder in the dossier. It is sealed with a card.')],
        outro: [draft('You find the fourth mark on the dossier’s ace of spades.', 'spade-mark')],
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
  {
    id: 'th-6',
    index: 6,
    title: 'Square and Compasses',
    locationId: 'masonic-lodge-no4',
    location: 'Fredericksburg Masonic Lodge No. 4',
    description: 'Steve Gonzales separates what happened at the lodge in 1752 from what someone invented later.',
    hostId: 'steve_gonzales',
    cast: ['steve_gonzales', 'sophia', 'jak_gold'],
    status: 'draft',
    music: 'silent-study-hours',
    mysteryThread:
      'Steve shows that the card’s “Masonic” cipher is not a real Masonic symbol but a later invention, and reads the order in which the four marks must be set.',
    beats: [
      'You meet Steve Gonzales at the historic lodge where George Washington was initiated in 1752.',
      'Steve separates documented history (Washington’s initiation, his use of spies such as the Culper Ring) from the legend.',
      'The cipher on the card is not a Masonic symbol: it was invented by whoever borrowed the legend.',
      'Sophia, wary of Steve, checks his sources; they hold up.',
      'Steve reads the order of the four suits. The ledger’s blank thirteenth line names a house: Kenmore.',
    ],
    artwork: {
      backdrop: 'backgrounds/masonic_lodge_no4/background.webp',
      decks: ['freemasonry'],
      tint: '#24304a',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-masonic-lodge/location-masonic-lodge',
    },
    intro: [draft('You arrive at the historic lodge. Steve Gonzales is waiting with a stack of research notes.')],
    outro: [draft('Steve reads you the order of the four suits. The next clue points to Kenmore.')],
    levels: [
      level('th-6', 1, {
        title: 'Cornerstone',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 1.',
        setup: { seed: 1021, options: { draw: 1 }, deckId: 'freemasonry', boardId: 'masonic_lodge_no4' },
        intro: [draft('Steve shows you what is documented about the lodge’s history.')],
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
        intro: [draft('Steve deals you a game of War while he talks.')],
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
        intro: [draft('Sophia joins you to check Steve’s sources.')],
      }),
      level('th-6', 4, {
        title: 'The Cipher',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1009, deckId: 'freemasonry', boardId: 'masonic_lodge_no4' },
        intro: [draft('You compare the card’s cipher with Steve’s research.')],
        outro: [draft('You read Steve’s notes: the cipher was invented long after 1752.', 'lodge-sketchbook-page')],
      }),
      level('th-6', 5, {
        title: 'The Keystone',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1014, options: { suits: 1 }, deckId: 'freemasonry', boardId: 'masonic_lodge_no4' },
        intro: [draft('You watch the order of the four suits fall into place.')],
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
    unlockRequirements: { chapter: 'th-5' },
  },
  {
    id: 'th-7',
    index: 7,
    title: 'A Mother’s Opinion',
    locationId: 'kenmore',
    location: 'Kenmore',
    description: 'At her daughter’s house, Mary Ball Washington’s ghost has a few things to say about her son.',
    hostId: 'mary_ball_washington',
    cast: ['mary_ball_washington'],
    status: 'draft',
    music: 'midnight-tea',
    mysteryThread:
      'Mary Ball Washington’s ghost confirms (as fiction) the legend of her son’s unfinished game and his refusal to lose; she gives you the iron key to the tunnels.',
    beats: [
      'You visit Kenmore, the home of Fielding Lewis and Betty Washington Lewis.',
      'Mary Ball Washington’s ghost appears in the parlor; she is visiting her daughter’s house, not her own.',
      'She corrects your history: her own house was on Charles Street.',
      'She is unimpressed by her son’s fame and tells of the game he would not finish because he was losing.',
      'She entrusts you with an iron key and warns that George never concedes gracefully.',
    ],
    artwork: {
      backdrop: 'backgrounds/kenmore_parlor/background.webp',
      decks: ['fredericksburg'],
      tint: '#4a3a52',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-kenmore-mansion/location-kenmore-mansion',
    },
    intro: [draft('You enter Kenmore’s parlor. Beneath the plaster ceiling, a figure in a lace cap is waiting.')],
    outro: [draft('Mary Ball Washington’s ghost hands you an iron key and points toward the old town’s cellars.')],
    levels: [
      level('th-7', 1, {
        title: 'Plaster Ceilings',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3206, options: { draw: 3 }, deckId: 'fredericksburg', boardId: 'kenmore_parlor' },
        intro: [draft('You wait in the parlor, studying the plasterwork.')],
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
        intro: [draft('Mary Ball Washington’s ghost asks you to sit for a hand of cards.')],
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
        intro: [draft('She plays War against you the way she corrects history: firmly.')],
      }),
      level('th-7', 4, {
        title: 'Letters',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 1019, deckId: 'fredericksburg', boardId: 'kenmore_parlor' },
        intro: [draft('You sort a bundle of ribbon-tied letters.')],
      }),
      level('th-7', 5, {
        title: 'The Iron Key',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 3405, options: { suits: 1 }, deckId: 'fredericksburg', boardId: 'kenmore_parlor' },
        intro: [draft('One more game before she decides whether to trust you.')],
        outro: [draft('She places an iron key in your hand.', 'kenmore-iron-key')],
        rewards: [credits(180), xp(210)],
      }),
    ],
    rewards: [deck('fredericksburg'), board('kenmore_parlor'), stamp('th-kenmore'), credits(600), xp(340)],
    unlockRequirements: { chapter: 'th-6' },
  },
  {
    id: 'th-8',
    index: 8,
    title: 'Four Suits Below',
    locationId: 'underground-tunnels',
    location: 'The Underground Tunnels',
    description: 'Jak, Steve and Dante, one sealed door, and four suits that have to go in the right order.',
    hostId: 'steve_gonzales',
    cast: ['jak_gold', 'steve_gonzales', 'dante'],
    status: 'draft',
    music: 'fxbg-after-dark',
    mysteryThread:
      'Jak, Steve and Dante combine their skills to set the four suit marks in Steve’s order and open the sealed door.',
    beats: [
      'The iron key opens a cellar door into fictional tunnels under the old town.',
      'Jak films, Steve navigates by his notes, and Dante lights the way with neon markers.',
      'A sealed door carries a four-suit lock.',
      'Each of the three contributes a skill: Jak’s sleight of hand, Steve’s order, Dante’s eye for hidden shapes.',
      'With the four marks set, the door opens onto a candlelit card room.',
    ],
    artwork: {
      backdrop: 'backgrounds/menu/night.webp',
      decks: ['spycraft', 'dantes_world'],
      tint: '#2b2420',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-sealed-door-cellar/location-sealed-door-cellar',
    },
    intro: [
      draft('You turn the iron key. Stone steps lead down into the dark, where Jak, Steve and Dante are waiting.'),
    ],
    outro: [draft('You hear the four-suit lock click open. Candlelight spills out from the room beyond.')],
    levels: [
      level('th-8', 1, {
        title: 'Down the Steps',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 3300, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [draft('You reach a place where the tunnel splits four ways. Steve checks his notes.')],
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
        intro: [draft('You rest by lantern light and deal a four-handed game.')],
      }),
      level('th-8', 3, {
        title: 'Echoes',
        game: 'war',
        objectiveText: 'Win War against Jak Gold.',
        setup: { seed: 2024, options: { opponent: 'jak_gold' }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [draft('Jak challenges you to War to fill the silence.')],
      }),
      level('th-8', 4, {
        title: 'The Lantern Path',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 1018, options: { draw: 3 }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [draft('You follow Dante’s neon markers, one turn at a time.')],
      }),
      level('th-8', 5, {
        title: 'The Four-Suit Door',
        game: 'spider',
        finale: true,
        objectiveText: 'Finale: clear one-suit Spider.',
        setup: { seed: 1001, options: { suits: 1 }, deckId: 'inspire', boardId: 'underground_tunnels' },
        intro: [draft('You set the four marks in the door, in Steve’s order.')],
        outro: [draft('You turn the lock. The door to the last room opens.', 'four-suit-puzzle')],
        rewards: [credits(190), xp(220)],
      }),
    ],
    rewards: [board('underground_tunnels'), stamp('th-lantern-cellar'), credits(650), xp(360)],
    unlockRequirements: { chapter: 'th-7' },
  },
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
    status: 'draft',
    music: 'shadows-of-the-occult',
    mysteryThread:
      'The legend resolves: George Washington’s ghost has waited to play the thirteenth hand he walked away from. You play it, win, and he refuses to concede gracefully.',
    beats: [
      'You enter a card room lit by candles that do not burn down.',
      'George Washington’s ghost greets you with great ceremony and greater pride.',
      'He explains (as story legend) that he walked away from a game twelve hands in, and has waited to finish it.',
      'Five games; the last is the thirteenth hand itself.',
      'You win. He demands a recount, a rematch and an apology — until Mary Ball Washington’s ghost tells him to stop sulking.',
      'The card’s four corners are filled. The legend is finished, and the card is yours.',
    ],
    artwork: {
      backdrop: 'backgrounds/washington_final_table/background.webp',
      decks: ['washington_ghost'],
      tint: '#1c2a3a',
      placeholder: DRAFT_LABEL,
      locationSprite: 'location-generals-spectral-parlor/location-generals-spectral-parlor',
    },
    intro: [
      draft('You step into a candlelit card room. At the far end of the table, a tall ghost rises to greet you.'),
    ],
    outro: [draft('The thirteenth hand is played. The card in your pocket is complete.')],
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
        intro: [draft('The ghost challenges you to a game of War.')],
      }),
      level('th-9', 2, {
        title: 'Spectral Draw',
        game: 'klondike',
        objectiveText: 'Complete Klondike, Draw 3.',
        setup: { seed: 3200, options: { draw: 3 }, deckId: 'washington_ghost', boardId: 'washington_final_table' },
        intro: [draft('You watch the cards deal themselves, three at a time.')],
      }),
      level('th-9', 3, {
        title: 'The Twelfth Hand',
        game: 'freecell',
        objectiveText: 'Solve this FreeCell deal.',
        setup: { seed: 3302, deckId: 'washington_ghost', boardId: 'washington_final_table' },
        intro: [draft('You recognise the twelfth hand from the ledger, laid out exactly as recorded.')],
      }),
      level('th-9', 4, {
        title: 'No Retreat',
        game: 'spider',
        objectiveText: 'Clear one-suit Spider.',
        setup: { seed: 3400, options: { suits: 1 }, deckId: 'washington_ghost', boardId: 'washington_final_table' },
        intro: [draft('The ghost refuses to let you end the game early.')],
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
        intro: [draft('The thirteenth hand is dealt to you at last.')],
        outro: [draft('All four corners of your card glow. The hand is finished.', 'awakened-card')],
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
    unlockRequirements: { chapter: 'th-8' },
  },
];

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
