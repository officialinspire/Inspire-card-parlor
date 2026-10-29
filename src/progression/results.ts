import type { Store } from '@/core/store';
import type { GameId, GameStats, Profile } from '@/core/types';
import { ACHIEVEMENTS } from '@/achievements/registry';
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
  details?: { warsLost?: number; books?: number; suits?: number; usedCell?: boolean };
  at?: Date;
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

/** Pure: achievements newly earned by this result. */
export function earnedAchievements(profile: Profile, stats: Record<GameId, GameStats>, r: GameResult): string[] {
  const has = new Set(profile.unlockedAchievements);
  const out: string[] = [];
  const earn = (id: string, cond: boolean) =>
    cond && !has.has(id) && ACHIEVEMENTS.some((a) => a.id === id) && out.push(id);
  const won = r.outcome === 'win';
  const totalWins = Object.values(stats).reduce((n, s) => n + s.won, 0);
  earn('first-win', won && totalWins >= 1);
  earn(
    'win-streak-5',
    Object.values(stats).some((s) => s.currentStreak >= 5),
  );
  earn('klondike-10', stats.klondike.won >= 10);
  earn('war-flawless', won && r.gameId === 'war' && (r.details?.warsLost ?? 0) === 0);
  earn('gofish-sweep', r.gameId === 'go-fish' && (r.details?.books ?? 0) >= 7);
  earn('spider-4suit', won && r.gameId === 'spider' && r.details?.suits === 4);
  earn('freecell-nocell', won && r.gameId === 'freecell' && r.details?.usedCell === false);
  const hour = (r.at ?? new Date()).getHours();
  earn('night-owl', hour < 4);
  return out;
}

/** Records a finished game: statistics, XP, credits and achievements. */
export function recordGameResult(store: Store, r: GameResult): ResultSummary {
  const profile = store.state.profile;
  const stats = { ...profile.stats, [r.gameId]: applyResult(profile.stats[r.gameId], r) };
  const achievements = earnedAchievements(profile, stats, r);
  const bonusXp = achievements.reduce((n, id) => n + (ACHIEVEMENTS.find((a) => a.id === id)?.xp ?? 0), 0);
  const base = REWARDS[r.outcome];
  const xp = base.xp + bonusXp + (r.gameId === 'go-fish' ? (r.score ?? 0) * 2 : 0);
  const levelled = grantXp(profile, xp);
  store.dispatch({
    type: 'UPDATE_PROFILE',
    patch: {
      stats,
      ...levelled,
      credits: profile.credits + base.credits,
      unlockedAchievements: [...profile.unlockedAchievements, ...achievements],
    },
  });
  const summary: ResultSummary = {
    xp,
    credits: base.credits,
    achievements,
    levelUp: levelled.level > profile.level,
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
  return summary;
}
