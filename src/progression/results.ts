import type { Store } from '@/core/store';
import type { GameId, GameStats } from '@/core/types';
import { getAchievement } from '@/achievements/registry';
import { evaluateAchievements } from '@/achievements/engine';
import { gamesToday, journalForGame, localDay, type GameRecord } from '@/achievements/journal';
import { tableInfo } from '@/games/session';
import { setPlayInProgress } from './announcer';
import { grantXp } from './levels';
import { applyStoryResult, type StoryOutcome } from '@/story/progress';
import { activeStoryLevel, setLastStoryOutcome } from '@/story/session';

export interface GameResult {
  gameId: GameId;
  outcome: 'win' | 'loss' | 'draw';
  /** Game-specific score (Go Fish: books). Higher is better. */
  score?: number;
  durationMs: number;
  /** Extra facts for achievements. */
  details?: GameRecord['details'];
  at?: Date;
  /** Deck and board used (defaults to the table in play, then the player's selection). */
  deckId?: string;
  boardId?: string;
}

export interface ResultSummary {
  xp: number;
  credits: number;
  achievements: string[];
  levelUp: boolean;
  stats: GameStats;
  /** Set when the game was a story challenge. */
  story?: StoryOutcome;
}

const REWARDS = { win: { xp: 50, credits: 30 }, draw: { xp: 25, credits: 10 }, loss: { xp: 15, credits: 5 } };

/** Pure: updated stats for one finished game. */
export function applyResult(stats: GameStats, r: GameResult): GameStats {
  const won = r.outcome === 'win';
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    bestTimeMs: won && (stats.bestTimeMs == null || r.durationMs < stats.bestTimeMs) ? r.durationMs : stats.bestTimeMs,
    bestScore: r.score != null && (stats.bestScore == null || r.score > stats.bestScore) ? r.score : stats.bestScore,
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
  };
}

/** Records a finished game: statistics, XP, credits and achievements. */
export function recordGameResult(store: Store, r: GameResult): ResultSummary {
  const profile = store.state.profile;
  const at = r.at ?? new Date();
  const stats = { ...profile.stats, [r.gameId]: applyResult(profile.stats[r.gameId], r) };
  const base = REWARDS[r.outcome];
  const xp = base.xp + (r.gameId === 'go-fish' ? (r.score ?? 0) * 2 : 0);
  const levelBefore = profile.level;
  store.dispatch({
    type: 'UPDATE_PROFILE',
    patch: { stats, ...grantXp(profile, xp), credits: profile.credits + base.credits },
  });

  // The journal: everything about this game that achievements care about.
  const { settings, selection } = store.state;
  const table = tableInfo();
  store.dispatch({
    type: 'JOURNAL',
    update: journalForGame({
      gameId: r.gameId,
      outcome: r.outcome,
      durationMs: r.durationMs,
      at,
      deckId: r.deckId ?? table?.deckId ?? selection.deckId,
      boardId: r.boardId ?? table?.boardId ?? selection.boardId,
      story: !!activeStoryLevel(),
      silent: settings.muted || settings.masterVolume === 0,
      leftHanded: settings.leftHanded,
      details: r.details ?? {},
      lossStreak: profile.journal?.counters['streak.loss'] ?? 0,
      gamesToday: gamesToday(profile.journal, at),
      today: localDay(at),
    }),
  });

  const summary: ResultSummary = {
    xp,
    credits: base.credits,
    achievements: [],
    levelUp: false,
    stats: stats[r.gameId],
  };
  // A story challenge: score it against its objective and pay its rewards (once).
  const levelId = activeStoryLevel();
  if (levelId) {
    const { patch, outcome } = applyStoryResult(store.state.profile, levelId, r);
    store.dispatch({ type: 'UPDATE_PROFILE', patch });
    setLastStoryOutcome(outcome);
    summary.story = outcome;
  }
  // Achievements (each unlocks once; their XP is paid when they unlock).
  summary.achievements = evaluateAchievements(store);
  summary.xp += summary.achievements.reduce((n, id) => n + (getAchievement(id)?.xp ?? 0), 0);
  summary.levelUp = store.state.profile.level > levelBefore;
  // The hand is over: held toasts may show now.
  setPlayInProgress(false);
  return summary;
}
