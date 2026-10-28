import type { GameId, GameStats, Profile, Selection, Settings } from './types';

export const GAME_IDS: readonly GameId[] = ['klondike', 'spider', 'freecell', 'war', 'go-fish'];

export const DEFAULT_DECK = 'classic';
export const DEFAULT_BOARD = 'velvet-green';
export const DEFAULT_TRACK = 'lamplight';

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
  musicTrack: DEFAULT_TRACK,
  theme: 'auto',
  reducedMotion: false,
  leftHanded: false,
  showHints: true,
  autoComplete: true,
  cardAnimationSpeed: 'normal',
  analyticsEnabled: true,
  matureContent: false,
  placeholderArt: false,
  warOpponent: 'jak_gold',
  warSpeed: 'normal',
  goFishOpponents: 1,
  cpuDifficulty: 'normal',
  klondikeDraw: 1,
  spiderSuits: 1,
};

export function emptyStats(): GameStats {
  return { played: 0, won: 0, bestTimeMs: null, bestScore: null, currentStreak: 0, longestStreak: 0 };
}

export function createDefaultProfile(): Profile {
  return {
    playerName: 'Guest',
    level: 1,
    xp: 0,
    credits: 250,
    unlockedDecks: [DEFAULT_DECK, 'inspire'],
    unlockedBoards: [DEFAULT_BOARD],
    unlockedAchievements: [],
    storyChapter: 0,
    stats: Object.fromEntries(GAME_IDS.map((id) => [id, emptyStats()])) as Record<GameId, GameStats>,
    createdAt: Date.now(),
  };
}

export function createDefaultSelection(): Selection {
  return {
    gameId: null,
    deckId: DEFAULT_DECK,
    boardId: DEFAULT_BOARD,
    storyChapterId: null,
    byGame: {},
    artVariants: {},
  };
}
