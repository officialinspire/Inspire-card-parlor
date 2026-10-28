import type { AppState } from './states';

export type GameId = 'klondike' | 'spider' | 'freecell' | 'war' | 'go-fish';

export type ThemeMode = 'auto' | 'day' | 'night';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  musicTrack: string;
  theme: ThemeMode;
  reducedMotion: boolean;
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
  storyChapter: number;
  stats: Record<GameId, GameStats>;
  createdAt: number;
}

export interface TableChoice {
  deckId: string;
  boardId: string;
}

export interface Selection extends TableChoice {
  gameId: GameId | null;
  /** Set when gameplay was launched from Story Mode. */
  storyChapterId: string | null;
  /** Last deck/board used for each game, restored when that game is picked again. */
  byGame: Partial<Record<GameId, TableChoice>>;
  /** Chosen alternate artwork per deck (deck id → variant id). Purely cosmetic. */
  artVariants: Record<string, string>;
}

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: number;
  message: string;
  kind: NotificationKind;
  icon?: string;
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
  orientation: 'portrait' | 'landscape';
  fullscreen: boolean;
  online: boolean;
}
