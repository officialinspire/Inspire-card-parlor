import type { AppState } from './states';

export type GameId = 'klondike' | 'spider' | 'freecell' | 'war' | 'go-fish';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  leftHanded: boolean;
  showHints: boolean;
  autoComplete: boolean;
  cardAnimationSpeed: 'slow' | 'normal' | 'fast';
  analyticsEnabled: boolean;
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
  coins: number;
  unlockedDecks: string[];
  unlockedBoards: string[];
  unlockedAchievements: string[];
  storyChapter: number;
  stats: Record<GameId, GameStats>;
  createdAt: number;
}

export interface Selection {
  gameId: GameId | null;
  deckId: string;
  boardId: string;
  /** Set when gameplay was launched from Story Mode. */
  storyChapterId: string | null;
}

export interface ModalState {
  id: string;
  title: string;
  body: string;
}

export interface RootState {
  screen: AppState;
  history: AppState[];
  boot: { progress: number; label: string; ready: boolean };
  selection: Selection;
  settings: Settings;
  profile: Profile;
  modal: ModalState | null;
  orientation: 'portrait' | 'landscape';
  online: boolean;
}
