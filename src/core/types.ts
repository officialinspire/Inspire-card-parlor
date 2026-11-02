import type { AppState } from './states';
import type { Journal } from '@/achievements/journal';

export type GameId = 'klondike' | 'spider' | 'freecell' | 'war' | 'go-fish';

export type ThemeMode = 'auto' | 'day' | 'night';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  /** Riverfront ambience (water, breeze, the town at night) behind the title and menu. */
  ambience: boolean;
  ambienceVolume: number;
  muted: boolean;
  /** Music off (sound effects stay on); the table toolbar's Music button. */
  musicMuted: boolean;
  musicTrack: string;
  /** The player's pause button (music stays paused across screens until resumed). */
  musicPaused: boolean;
  musicShuffle: boolean;
  musicRepeat: 'all' | 'one' | 'off';
  /** Playlist: one category or the whole library. */
  musicCategory: string;
  /** Vibration feedback on devices that support it. */
  haptics: boolean;
  theme: ThemeMode;
  reducedMotion: boolean;
  /** Fewer decorative effects: no story particles, glows or ambient loops (for slower devices). */
  lowEffects: boolean;
  /**
   * The opening sequence on launch. `auto`: the full intro on the first launch, then the brief one
   * (title and Touch to Start); `full`: every launch; `brief`: always the brief one.
   */
  startupIntro: 'auto' | 'full' | 'brief';
  /** Story Mode picks music for each place and scene (the player's own pick always wins). */
  storySoundtrack: boolean;
  leftHanded: boolean;
  showHints: boolean;
  autoComplete: boolean;
  cardAnimationSpeed: 'slow' | 'normal' | 'fast';
  analyticsEnabled: boolean;
  /** Adult-themed decks and artwork. Off by default; enabling requires confirmation. */
  matureContent: boolean;
  /** Render pending decks with the shared placeholder template instead of procedural cards. */
  placeholderArt: boolean;
  /** War: opponent personality and pacing. */
  warOpponent: string;
  warSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  /** Go Fish: number of CPU opponents. */
  goFishOpponents: 1 | 2 | 3;
  cpuDifficulty: 'easy' | 'normal' | 'hard';
  /** Klondike: cards turned per stock tap. */
  klondikeDraw: 1 | 3;
  /** Spider: number of suits. */
  spiderSuits: 1 | 2 | 4;
  /** Gentle background animation on gameboards. */
  ambientAnimations: boolean;
  /** Darker scrim behind cards on busy boards. */
  highContrastTable: boolean;
  /** Set once the age gate has been passed (no birth date is stored). */
  ageVerified: boolean;
}

export interface GameStats {
  played: number;
  won: number;
  bestTimeMs: number | null;
  bestScore: number | null;
  currentStreak: number;
  longestStreak: number;
}

export interface Profile {
  playerName: string;
  level: number;
  xp: number;
  credits: number;
  unlockedDecks: string[];
  unlockedBoards: string[];
  unlockedAchievements: string[];
  /** When each achievement was earned (ms since epoch). Older saves may lack a date. */
  achievementDates: Record<string, number>;
  /** Lifetime counters and "seen" sets that achievements read. */
  journal: Journal;
  /** Save format version, for safe migrations. */
  schemaVersion: number;
  /** Chapters of the current campaign completed in order (never lowered). */
  storyChapter: number;
  /** The Thirteenth Hand: completed challenges, rewards paid out, passport stamps, evidence. */
  story: StoryProgress;
  /** Progress in the first campaign (The Card Parlor Chronicles), archived when the campaign was replaced. */
  legacyStory?: LegacyStoryArchive;
  /** Starred decks (shown first and under the Favorites filter). */
  favoriteDecks: string[];
  /** Collected alternate artwork, as "deckId@variantId". */
  ownedVariants: string[];
  stats: Record<GameId, GameStats>;
  createdAt: number;
}

export interface StoryProgress {
  /** Campaign the ids below belong to ("thirteenth-hand"). Saves without it hold first-campaign ids. */
  campaign?: string;
  /** Campaign data version the progress was recorded against. */
  version?: number;
  /** Completed challenge ids ("th-1-3"). */
  completed: string[];
  /** Reward grants already paid ("level:th-1-3", "chapter:th-1"), so nothing pays twice. */
  rewarded: string[];
  /** Passport stamps earned. */
  stamps: string[];
  /** Chapters whose introduction has been shown. */
  introsSeen: string[];
  /** Tries per challenge. */
  attempts: Record<string, number>;
  /** Evidence collected (src/story/evidence.ts). */
  evidence?: string[];
}

/**
 * The first campaign's progress, kept as it was when The Thirteenth Hand
 * replaced it. Its ids ("chapter-2-4") never count as new-campaign wins.
 */
export interface LegacyStoryArchive {
  campaign: 'card-parlor-chronicles';
  /** Chapters completed in order (the old `storyChapter`). */
  chaptersCompleted: number;
  completed: string[];
  rewarded: string[];
  stamps: string[];
  introsSeen: string[];
  attempts: Record<string, number>;
  /** When the archive was made (ms since epoch). */
  archivedAt: number;
}

export interface TableChoice {
  deckId: string;
  boardId: string;
}

export interface Selection extends TableChoice {
  gameId: GameId | null;
  /** Set when gameplay was launched from Story Mode. */
  storyChapterId: string | null;
  /** The story challenge being played (not saved between sessions). */
  storyLevelId: string | null;
  /** Last deck/board used for each game, restored when that game is picked again. */
  byGame: Partial<Record<GameId, TableChoice>>;
  /** Chosen alternate artwork per deck (deck id → variant id). Purely cosmetic. */
  artVariants: Record<string, string>;
  /** Card back, independent of the deck: a deck id or "deckId@variantId"; null = the deck's own back. */
  cardBack: string | null;
}

/** `celebrate` is the gold toast for achievements and collection unlocks. */
export type NotificationKind = 'info' | 'success' | 'warning' | 'error' | 'celebrate';

export interface Notification {
  id: number;
  message: string;
  kind: NotificationKind;
  icon?: string;
  /** Small caps line above the message (celebrations: "Achievement unlocked"). */
  title?: string;
  /** Achievement id: the toast shows that achievement's medal instead of an icon. */
  badge?: string;
  /** ms before auto-dismiss; 0 keeps it until dismissed. */
  duration: number;
}

/** Open dialogs are owned by the UI layer; the store tracks them so input (Escape/back) can defer to them. */
export interface ModalRef {
  id: string;
  title: string;
}

export interface RootState {
  screen: AppState;
  history: AppState[];
  boot: { progress: number; label: string; ready: boolean };
  selection: Selection;
  settings: Settings;
  profile: Profile;
  modals: ModalRef[];
  notifications: Notification[];
  /** What the music engine is playing, and whether the story or the player chose it. */
  nowPlaying: { track: string; source: 'story' | 'player' } | null;
  orientation: 'portrait' | 'landscape';
  fullscreen: boolean;
  online: boolean;
}
