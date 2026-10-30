import { describe, expect, it } from 'vitest';
import { Store } from '@/core/store';
import { emptyStats } from '@/core/defaults';
import { applyResult, recordGameResult } from '@/progression/results';

const noon = new Date('2026-05-05T12:00:00');

describe('game results', () => {
  it('updates played, wins, streaks, best time and best score', () => {
    let s = emptyStats();
    s = applyResult(s, { gameId: 'go-fish', outcome: 'win', durationMs: 90_000, score: 5 });
    s = applyResult(s, { gameId: 'go-fish', outcome: 'win', durationMs: 60_000, score: 4 });
    expect(s).toMatchObject({
      played: 2,
      won: 2,
      currentStreak: 2,
      longestStreak: 2,
      bestTimeMs: 60_000,
      bestScore: 5,
    });
    s = applyResult(s, { gameId: 'go-fish', outcome: 'loss', durationMs: 10_000, score: 9 });
    expect(s).toMatchObject({
      played: 3,
      won: 2,
      currentStreak: 0,
      longestStreak: 2,
      bestTimeMs: 60_000,
      bestScore: 9,
    });
    s = applyResult(s, { gameId: 'go-fish', outcome: 'draw', durationMs: 10_000 });
    expect(s.won).toBe(2);
  });

  it('grants XP, credits and achievements to the profile', () => {
    const store = new Store();
    const credits = store.state.profile.credits;
    const r = recordGameResult(store, {
      gameId: 'war',
      outcome: 'win',
      durationMs: 1000,
      details: { warsLost: 0 },
      at: noon,
    });
    expect(r.achievements).toEqual(expect.arrayContaining(['first-win', 'war-1', 'war-flawless']));
    expect(store.state.profile.achievementDates['war-flawless']).toBeTypeOf('number');
    expect(store.state.profile.stats.war).toMatchObject({ played: 1, won: 1 });
    expect(store.state.profile.credits).toBe(credits + 30);
    expect(store.state.profile.unlockedAchievements).toContain('first-win');
    expect(r.xp).toBeGreaterThan(50);

    // Not awarded twice.
    const again = recordGameResult(store, {
      gameId: 'war',
      outcome: 'win',
      durationMs: 1000,
      details: { warsLost: 0 },
      at: noon,
    });
    expect(again.achievements).toEqual([]);
  });

  it('awards the Go Fish sweep for seven books', () => {
    const store = new Store();
    const r = recordGameResult(store, {
      gameId: 'go-fish',
      outcome: 'win',
      score: 7,
      durationMs: 1,
      details: { books: 7 },
      at: noon,
    });
    expect(r.achievements).toContain('gofish-sweep');
    expect(store.state.profile.stats['go-fish'].bestScore).toBe(7);
  });
});
