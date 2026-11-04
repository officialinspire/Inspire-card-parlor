import type { GameId } from '@/core/types';
import type { Difficulty } from '@/games/goFish/GoFishGame';

/**
 * The shapes of the story campaign, as data. Everything a scene, a challenge
 * or a chapter needs is described here and filled in by ./campaign.ts,
 * ./cast.ts, ./locations.ts and ./evidence.ts; the engines and screens only
 * read it.
 */

/**
 * Whether text is approved for the game or still an outline. Draft text is
 * kept short, never put in a character's mouth, and is labelled in the UI.
 */
export type ContentStatus = 'final' | 'draft';

export type StoryRewardKind = 'credits' | 'xp' | 'deck' | 'board' | 'variant' | 'stamp' | 'achievement' | 'evidence';

export type StoryReward =
  | { kind: 'credits'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'deck'; id: string }
  | { kind: 'board'; id: string }
  /** Alternate card art, as "deckId@variantId". */
  | { kind: 'variant'; id: string }
  | { kind: 'stamp'; id: string }
  | { kind: 'achievement'; id: string }
  /** A collectible piece of evidence (./evidence.ts). */
  | { kind: 'evidence'; id: string };

export type StoryObjective =
  | { kind: 'win' }
  /** Go Fish: lay down at least `min` books (winning is not required). */
  | { kind: 'books'; min: number };

export interface LevelSetup {
  /** Fixed deal. Required for solitaire and War (verified winnable); Go Fish deals fresh. */
  seed?: number;
  options?: {
    /** Short authored FreeCell endgame; Quick Play keeps the full deal. */
    freecellPuzzle?: boolean;
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

/**
 * One beat of a scene. The player is a silent observer: they never speak, so
 * beats are either a character's line or second-person narration
 * ("You examine the old ledger."). `who` is a character id (./cast.ts) or
 * `NARRATOR` for narration.
 */
export interface DialogueLine {
  who: string;
  text: string;
  /** Narration ("You enter…") rather than speech. Always set with who = NARRATOR. */
  narration?: boolean;
  /** Evidence found at this beat (./evidence.ts). */
  discovers?: string;
  /** Pose for the speaker's portrait (a pose name in their sprite sheet). */
  pose?: string;
  status?: ContentStatus;
}

export const NARRATOR = 'narrator';

/** A short, optional card of real-world information (wildlife, local history) or a note about the fiction. */
export interface InfoCard {
  id: string;
  kind: 'wildlife' | 'history' | 'note';
  title: string;
  text: string;
  /** Where wildlife and history facts can be checked. */
  source?: string;
  /** Story sprite id for a picture. */
  sprite?: string;
}

/** The four suits, as the story's clues name them. */
export type StorySuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

/**
 * A short puzzle the player solves with the clues they carry, before a
 * challenge is played (the Chapter 8 door). It uses the scene dialog only:
 * the player sets the four suit marks in an order. Wrong tries earn a hint
 * from the cast, and the hints end by spelling out the answer, so the puzzle
 * can never block the story.
 */
export interface SuitPuzzle {
  /** What the player is looking at, in second-person narration. */
  prompt: string;
  /** The order that opens it. */
  answer: StorySuit[];
  /** Said after each wrong try, in order; the last one repeats. The last hint gives the answer. */
  hints: DialogueLine[];
  /** Said when the right order is set. */
  solved: DialogueLine[];
  /** Clues that help (offered in the puzzle once found; never required). */
  clues?: string[];
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
  /** Before the game. */
  intro: DialogueLine[];
  /** After the objective is met. */
  outro: DialogueLine[];
  rewards: StoryReward[];
  finale?: boolean;
  /** Optional field notes shown with the challenge. */
  info?: InfoCard[];
  /** Solved before the first play of this challenge (replays skip it). */
  puzzle?: SuitPuzzle;
}

export interface ChapterArtwork {
  /** Painting behind the chapter card (public asset path), if any. */
  backdrop?: string;
  /** Decks whose real preview art is shown on the card. */
  decks: string[];
  /** Base colour for the card. */
  tint: string;
  /** Shown on the card while the chapter is unfinished or its artwork is missing. */
  placeholder?: string;
  /** Map tile for the location (story sprite id). */
  locationSprite?: string;
}

export interface UnlockRequirements {
  /** Chapter that must be complete first. */
  chapter?: string;
  /** Player level required. */
  level?: number;
}

export interface StoryChapter {
  id: string;
  index: number;
  title: string;
  /** Location id (./locations.ts). */
  locationId: string;
  /** Location name, for screens that show it directly. */
  location: string;
  description: string;
  /** The chapter's main character (./cast.ts). */
  hostId: string;
  /** Characters who appear in the chapter. */
  cast: string[];
  /** Whether the chapter's scenes are written ('final') or outlined ('draft'). */
  status: ContentStatus;
  /** Plot beats, in order: the outline the scenes are written from. */
  beats: string[];
  /** What this chapter adds to the central mystery. */
  mysteryThread: string;
  /** Background music (track id). */
  music: string;
  artwork: ChapterArtwork;
  intro: DialogueLine[];
  outro: DialogueLine[];
  levels: StoryLevel[];
  rewards: StoryReward[];
  unlockRequirements: UnlockRequirements;
  /** Optional field notes for the chapter as a whole. */
  info?: InfoCard[];
}

export interface Portrait {
  /** Sheet id in the story artwork (public/assets/story/manifest.json), or null when none exists yet. */
  sheet: string | null;
  /** Default pose for scenes. */
  pose: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  color: string;
  /** Short description for writers and the cast list. */
  bio?: string;
  /** How the character talks. */
  voice?: string;
  /** Character theme (track id). */
  music?: string;
  portrait?: Portrait;
  /** CPU personality used when they sit at a War or Go Fish table. */
  opponentId?: string;
  /** A fictionalized portrayal of a real person: keep it respectful and invent no real-world conduct. */
  basedOnRealPerson?: boolean;
  /** A ghost or other supernatural figure: always fiction. */
  supernatural?: boolean;
}

/** Documented history, or a note that something is invented for the story. */
export interface HistoryNote {
  kind: 'history' | 'fiction';
  title: string;
  text: string;
  /** Where documented history can be checked (history notes only). */
  source?: string;
}

export interface StoryLocation {
  id: string;
  name: string;
  /** A real place, an invented place in a real town, or a supernatural one. */
  kind: 'real' | 'fictional' | 'supernatural';
  description: string;
  /** Gameboard used for the chapter's tables. */
  boardId: string;
  /** Map tile (story sprite id). */
  sprite?: string;
  notes: HistoryNote[];
}

export interface Evidence {
  id: string;
  name: string;
  /** Chapter where it is found. */
  chapter: string;
  kind: 'card' | 'document' | 'object' | 'recording';
  description: string;
  /** Story sprite id for its picture, when one exists. */
  sprite?: string;
  /** Key clues drive the mystery; optional ones add colour. */
  importance: 'key' | 'optional';
  status: ContentStatus;
  /** What it suggests, in a sentence (the description is what you see). */
  interpretation?: string;
  /** The question it leaves open, until the clue in `answeredBy` is found. */
  question?: string;
  answeredBy?: string;
  /** Other clues it connects to. Only those already found are ever shown. */
  related?: string[];
}

export interface PassportStamp {
  id: string;
  chapter: string;
  label: string;
  /** Story sprite id. */
  sprite: string;
}
