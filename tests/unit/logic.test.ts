import { describe, expect, it, vi } from 'vitest';
import { computeGrid } from '@/components/Paginator';
import { grantXp, isDeckUnlocked, isBoardUnlocked, xpForLevel } from '@/progression/levels';
import { createDefaultProfile } from '@/core/defaults';
import { resolveTheme } from '@/themes/theme';
import { getTrack, nextTrackId, TRACKS } from '@/audio/tracks';
import { migrateProfile, attachPersistence } from '@/storage/persistence';
import { Store } from '@/core/store';
import { GAMES } from '@/games/registry';

describe('computeGrid', () => {
  const tile = { minTileWidth: 150, minTileHeight: 200, gap: 10 };

  it('fits as many tiles as the space allows', () => {
    expect(computeGrid(800, 420, 20, tile)).toEqual({ cols: 5, rows: 2, perPage: 10, pages: 2 });
  });

  it('never leaves empty columns when items are few', () => {
    expect(computeGrid(1400, 300, 3, tile).cols).toBe(3);
  });

  it('always shows at least one tile, even in tiny spaces', () => {
    expect(computeGrid(50, 50, 5, tile)).toMatchObject({ cols: 1, rows: 1, pages: 5 });
  });

  it('respects column and row limits', () => {
    expect(computeGrid(2000, 2000, 10, { ...tile, maxColumns: 2, maxRows: 1 })).toEqual({
      cols: 2,
      rows: 1,
      perPage: 2,
      pages: 5,
    });
  });

  it('shows one Quick Play card per page on a portrait phone', () => {
    const g = computeGrid(358, 680, GAMES.length, {
      minTileWidth: 280,
      minTileHeight: 240,
      gap: 16,
      maxColumns: 3,
      maxRows: 1,
    });
    expect(g).toMatchObject({ cols: 1, perPage: 1, pages: 5 });
  });
});

describe('progression', () => {
  it('rolls XP over into new levels', () => {
    const p = createDefaultProfile();
    const result = grantXp(p, xpForLevel(1) + xpForLevel(2) + 5);
    expect(result).toEqual({ level: 3, xp: 5 });
  });

  it('unlocks decks and boards by level', () => {
    const p = createDefaultProfile();
    expect(isDeckUnlocked('classic', p)).toBe(true);
    expect(isDeckUnlocked('fredericksburg', p)).toBe(false);
    expect(isDeckUnlocked('fredericksburg', { ...p, level: 3 })).toBe(true);
    expect(isBoardUnlocked('oxblood-lounge', { ...p, level: 2 })).toBe(true);
  });

  it('unlocks story rewards by chapter', () => {
    const p = createDefaultProfile();
    expect(isDeckUnlocked('eastern_woodlands', { ...p, storyChapter: 2 })).toBe(true);
    expect(isBoardUnlocked('walnut-study', { ...p, storyChapter: 2 })).toBe(false);
  });
});

describe('theme', () => {
  it('follows the local clock in auto mode', () => {
    expect(resolveTheme('auto', 9)).toBe('day');
    expect(resolveTheme('auto', 18)).toBe('day');
    expect(resolveTheme('auto', 19)).toBe('night');
    expect(resolveTheme('auto', 3)).toBe('night');
  });

  it('honours an explicit choice', () => {
    expect(resolveTheme('night', 12)).toBe('night');
    expect(resolveTheme('day', 23)).toBe('day');
  });
});

describe('music tracks', () => {
  it('cycles through every track and wraps around', () => {
    const seen = new Set<string>();
    let id = TRACKS[0]!.id;
    for (let i = 0; i < TRACKS.length; i++) {
      seen.add(id);
      id = nextTrackId(id);
    }
    expect(seen.size).toBe(TRACKS.length);
    expect(id).toBe(TRACKS[0]!.id);
    expect(nextTrackId(TRACKS[0]!.id, -1)).toBe(TRACKS.at(-1)!.id);
  });

  it('falls back to the first track for unknown ids', () => {
    expect(getTrack('nope').id).toBe(TRACKS[0]!.id);
  });
});

describe('persistence', () => {
  it('migrates legacy coins to credits', () => {
    expect(migrateProfile({ coins: 40 })).toEqual({ credits: 40 });
    expect(migrateProfile({ coins: 40, credits: 7 })).toEqual({ credits: 7 });
  });

  it('restores and saves the last selections', () => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem(
      'icp:selection',
      JSON.stringify({
        gameId: 'freecell',
        deckId: 'fredericksburg',
        boardId: 'midnight-blue',
        byGame: { war: { deckId: 'a', boardId: 'b' } },
      }),
    );
    const s = new Store();
    attachPersistence(s);
    expect(s.state.selection).toMatchObject({ gameId: 'freecell', deckId: 'fredericksburg', boardId: 'midnight-blue' });
    expect(s.state.selection.byGame.war).toEqual({ deckId: 'a', boardId: 'b' });

    s.dispatch({ type: 'SELECT_BOARD', boardId: 'velvet-green' });
    vi.advanceTimersByTime(300);
    expect(JSON.parse(localStorage.getItem('icp:selection')!).boardId).toBe('velvet-green');
    vi.useRealTimers();
  });
});
