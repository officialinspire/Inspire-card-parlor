import type { GameId, GameStats, Profile, Settings } from './types';

export const GAME_IDS: readonly GameId[] = ['klondike', 'spider', 'freecell', 'war', 'go-fish'];

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
  reducedMotion: false,
  leftHanded: false,
  showHints: true,
  autoComplete: true,
  cardAnimationSpeed: 'normal',
  analyticsEnabled: true,
};

export function emptyStats(): GameStats {
  return { played: 0, won: 0, bestTimeMs: null, bestScore: null, currentStreak: 0, longestStreak: 0 };
}

export function createDefaultProfile(): Profile {
  return {
    playerName: 'Guest',
    level: 1,
    xp: 0,
    coins: 0,
    unlockedDecks: ['inspire-classic'],
    unlockedBoards: ['velvet-green'],
    unlockedAchievements: [],
    storyChapter: 0,
    stats: Object.fromEntries(GAME_IDS.map((id) => [id, emptyStats()])) as Record<GameId, GameStats>,
    createdAt: Date.now(),
  };
}
