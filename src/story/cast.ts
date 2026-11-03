import { NARRATOR, type Character } from './types';

/**
 * THE THIRTEENTH HAND — the cast.
 *
 * The player is an unnamed, silent observer: there is no player character
 * here, and no scene gives the player a line. Narration speaks to them in the
 * second person ("You examine the old ledger.").
 *
 * Portraits point at the character sheets cut from the uploaded story art
 * (public/assets/story/characters/<sheet>/<pose>.webp). Jak Gold has no sheet
 * yet (see docs/ART_ASSET_AUDIT.md), so his portrait falls back to his avatar.
 *
 * Two characters are fictionalized portrayals of real people (Jak Gold and
 * Steve Gonzales): they are written respectfully, and nothing in the story
 * attributes real criminal or covert conduct to them.
 */
export const CHARACTERS: readonly Character[] = [
  {
    id: NARRATOR,
    name: 'Narration',
    role: 'What you see and do',
    color: '#8b8172',
    bio: 'Second-person narration for the silent observer the player plays.',
  },
  {
    id: 'cheryl',
    name: 'Cheryl',
    role: 'Antique shop proprietor',
    color: '#c9a46a',
    bio: 'Runs an antique shop in downtown Fredericksburg and buys estate lots by the box. She knows the difference between a good story and provenance, and prices both. She bought the box that held the Thirteenth Hand card.',
    voice:
      'Dry, commercial and exact. Short sentences; prices everything; wants receipts. Her warmth shows in what she does (holding a sale, lending the card), not in what she says.',
    music: 'lamplight',
    portrait: { sheet: 'cheryl', pose: 'portrait-neutral' },
    opponentId: 'cheryl',
  },
  {
    id: 'sophia',
    name: 'Sophia',
    role: 'Park ranger, historical interpreter & wildlife specialist',
    color: '#6f9a7b',
    bio: 'A Native American ranger with the city’s Parks & Recreation department, posted at the Rappahannock River Station: wildlife logs, interpretation, school groups. She notices what moved on the river overnight, and she keeps her own schedule. (No tribal affiliation is specified.)',
    voice:
      'Dry, precise and unhurried. Plain facts; treats history as ongoing, not finished. Not a mystic and not anyone’s guide. Dislikes being filmed at work, is wary of Steve, likes Dante.',
    music: 'river-dawn',
    portrait: { sheet: 'sophia', pose: 'portrait-neutral' },
    opponentId: 'sophia',
  },
  {
    id: 'dante',
    name: 'Dante',
    role: 'Psychedelic cartoon artist & shop manager',
    color: '#b56ad8',
    bio: 'Manages the iSMOKESHOP counter and is a working psychedelic illustrator: fluorescent colour, figure and ground, patterns that won’t sit still. Goofy on top, exacting about craft and deadlines. Knows nothing about Freemasonry.',
    voice:
      'Warm and quick, with a joke ready; turns precise when he talks about how images work and how artists get paid. Psychedelia, for him, is art, perception and community.',
    music: 'tape-deck',
    portrait: { sheet: 'dante', pose: 'portrait-neutral' },
    opponentId: 'dante',
  },
  {
    id: 'jak_gold',
    name: 'Jak Gold',
    role: 'Cardistry artist & First Amendment auditor',
    color: '#e0b54a',
    bio: 'Films in public places, files public-records requests and practises card flourishes on camera. A disciplined researcher who corroborates before he publishes, and who knows his need for an audience can get in the way. Not a casino gambler.',
    voice:
      'Fast and theatrical on camera, slower and careful off it. Cites sources rather than slogans; knows which law covers what, and says “probably” when he isn’t sure.',
    music: 'high-roller',
    portrait: { sheet: null, pose: 'portrait-neutral' },
    opponentId: 'jak_gold',
    basedOnRealPerson: true,
  },
  {
    id: 'mrs_gray',
    name: 'Mrs. Gray',
    role: 'Intelligence officer',
    color: '#8a8f99',
    bio: 'A recurring intelligence figure from THE HARDIGAN BOYS. Linked to the fictional Operation Thirteenth Hand.',
    voice: 'Controlled, serious and deadpan. Answers questions with questions.',
    music: 'window-rain',
    portrait: { sheet: 'mrs-gray', pose: 'portrait-neutral' },
    opponentId: 'mrs_gray',
  },
  {
    id: 'steve_gonzales',
    name: 'Steve Gonzales',
    role: 'Media producer, VFX artist & Freemason',
    color: '#3f5d8f',
    bio: 'A friend of INSPIRE from Washington, D.C.: media production and visual effects, a Freemason who speaks Spanish, with a Norwich University background and military-intelligence connections, and a Burning Man regular. In the INSPIREVERSE, a serious, big-boned Freemason wizard drawn to historical research and the history of espionage.',
    voice:
      'Measured and serious; separates documented history from legend; slips into Spanish when something delights him.',
    music: 'silent-study-hours',
    portrait: { sheet: 'steve-gonzales', pose: 'portrait-neutral' },
    opponentId: 'steve_gonzales',
    basedOnRealPerson: true,
  },
  {
    id: 'mary_ball_washington',
    name: 'Mary Ball Washington',
    role: 'A ghost at Kenmore',
    color: '#9fb7c9',
    bio: 'George Washington’s mother, as a ghost visiting her daughter Betty’s home at Kenmore. Dignified, historically informative, slightly stern, and not impressed by her son.',
    voice: 'Formal and exact; corrects history; unimpressed by fame.',
    music: 'midnight-tea',
    portrait: { sheet: 'mary-ball-washington', pose: 'portrait-neutral' },
    opponentId: 'mary_ball_washington',
    supernatural: true,
  },
  {
    id: 'george_washington',
    name: 'George Washington’s Ghost',
    role: 'The final opponent',
    color: '#a7c4d9',
    bio: 'Proud, theatrical and competitive, and unwilling to concede a game gracefully. Comedic rather than frightening.',
    voice: 'Grand pronouncements, wounded pride, and demands for a rematch.',
    music: 'shadows-of-the-occult',
    portrait: { sheet: 'george-washington', pose: 'portrait-neutral' },
    opponentId: 'george_washington',
    supernatural: true,
  },
];

export const getCastMember = (id: string) => CHARACTERS.find((c) => c.id === id);
