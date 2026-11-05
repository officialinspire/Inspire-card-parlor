import { describe, expect, it, vi } from 'vitest';
import { Store, createInitialState } from '@/core/store';
import { parseBackup, importBackup, type ParlorBackup } from '@/storage/backup';
import { idb } from '@/storage/idb';
import { ALL_LEVELS } from '@/story/campaign';
import { verifySolitaire } from '@/story/verify';
import { createStorySolitaire } from '@/story/solitaire';
import { migrateProfile } from '@/storage/persistence';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import { GoFishGame } from '@/games/goFish/GoFishGame';
import { WarGame } from '@/games/war/WarGame';
import { hintsRemaining, useHint } from '@/games/solitaire/hints';

function backup(): ParlorBackup {
  const { profile, settings, selection } = createInitialState();
  const games = [
    FreeCellGame.createPuzzle({ seed: 1 }),
    KlondikeGame.create(),
    SpiderGame.create(),
    WarGame.create(),
    GoFishGame.create({
      players: [
        { id: 'you', name: 'You' },
        { id: 'jak_gold', name: 'Jak', cpu: 'jak_gold' },
      ],
    }),
  ];
  return {
    format: 'inspire-card-parlor',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    selection,
    saves: Object.fromEntries(games.map((g) => [`${g.table.gameId}/current`, g.table.snapshot()])),
  };
}

describe('mobile playtest balance', () => {
  it('reserves exactly three short FreeCell puzzles and keeps full Quick Play deals', () => {
    const puzzles = ALL_LEVELS.filter((l) => l.game === 'freecell');
    expect(puzzles.map((l) => l.id)).toEqual(['th-1-4', 'th-5-1', 'th-8-1']);
    for (const level of puzzles) {
      const game = createStorySolitaire(level);
      expect(game.table.cardCount).toBe(52);
      expect(game.tableau.reduce((n, p) => n + p.size, 0)).toBe(16);
      const proof = verifySolitaire(level);
      expect(proof.solved && proof.replayed).toBe(true);
      // The solver proves solvability; this direct legal sequence proves a short finish.
      for (let i = 0; i < 4; i++) {
        const a = `tableau:${i * 2}`,
          b = `tableau:${i * 2 + 1}`,
          f = `foundation:${i}`;
        expect(game.move({ from: a, index: 1, to: 'cell:0' })).toBe(true);
        expect(game.move({ from: b, index: 1, to: 'cell:1' })).toBe(true);
        expect(game.move({ from: a, index: 0, to: f })).toBe(true);
        expect(game.move({ from: b, index: 0, to: f })).toBe(true);
        expect(game.move({ from: 'cell:0', index: 0, to: f })).toBe(true);
        expect(game.move({ from: 'cell:1', index: 0, to: f })).toBe(true);
      }
      expect(game.data.won).toBe(true);
      expect(game.data.moves).toBe(24);
    }
    expect(FreeCellGame.create().tableau.reduce((n, p) => n + p.size, 0)).toBe(52);
  });
  it('keeps existing clears, rewards, and attempts through the pacing update', () => {
    const b = backup();
    b.profile.story = {
      ...b.profile.story,
      version: 2,
      completed: ['th-2-3'],
      rewarded: ['level:th-2-3'],
      attempts: { 'th-2-3': 2 },
    };
    const result = migrateProfile(b.profile);
    expect(result.story).toMatchObject({
      version: 3,
      completed: ['th-2-3'],
      rewarded: ['level:th-2-3'],
      attempts: { 'th-2-3': 2 },
    });
  });
  it('allows three hints, preserves spent hints in snapshots, and resets on a new deal', () => {
    const g = FreeCellGame.create();
    expect([useHint(g.data), useHint(g.data), useHint(g.data), useHint(g.data)]).toEqual([true, true, true, false]);
    const saved = g.table.snapshot();
    expect(hintsRemaining(saved.data)).toBe(0);
    expect(hintsRemaining(FreeCellGame.create().data)).toBe(3);
  });
});

describe('portable save files', () => {
  it('round-trips every engine, progress, medals, and hint usage', () => {
    const b = backup();
    b.profile.unlockedAchievements = ['first-win'];
    b.profile.achievementDates = { 'first-win': 12345 };
    b.saves['freecell/current']!.data.hints = 2;
    expect(parseBackup(JSON.stringify(b))).toEqual(b);
  });
  it.each([
    (b: ParlorBackup) => {
      b.version = 99 as 1;
    },
    (b: ParlorBackup) => {
      b.profile.journal.seen.bad = 42 as never;
    },
    (b: ParlorBackup) => {
      b.profile.story.completed = 'bad' as never;
    },
    (b: ParlorBackup) => {
      b.saves['freecell/current']!.piles = [];
    },
    (b: ParlorBackup) => {
      b.saves['freecell/current']!.data = {};
    },
    (b: ParlorBackup) => {
      b.saves['unknown/current'] = b.saves['freecell/current']!;
    },
  ])('rejects malformed or unsupported files before storage is touched', (mutate) => {
    const b = backup();
    mutate(b);
    expect(() => parseBackup(JSON.stringify(b))).toThrow();
  });
  it('rejects prototype keys and oversized files', () => {
    expect(() => parseBackup('{"__proto__":{}}')).toThrow();
    expect(() => parseBackup(' '.repeat(5 * 1024 * 1024 + 1))).toThrow(/large/);
  });
  it('does not replace the profile if the saves transaction fails', async () => {
    const store = new Store();
    const before = store.state.profile;
    const b = backup();
    b.profile.credits = 999;
    const write = vi.spyOn(idb, 'replaceSaves').mockRejectedValueOnce(new Error('Storage full'));
    await expect(importBackup(store, b)).rejects.toThrow('Storage full');
    expect(store.state.profile).toBe(before);
    write.mockRestore();
  });
  it('replaces rather than merges profile collections on import', async () => {
    const store = new Store();
    store.dispatch({ type: 'UPDATE_PROFILE', patch: { unlockedAchievements: ['old-badge'] } });
    const b = backup();
    b.profile.unlockedAchievements = ['new-badge'];
    const write = vi.spyOn(idb, 'replaceSaves').mockResolvedValueOnce();
    await importBackup(store, b);
    expect(store.state.profile.unlockedAchievements).toEqual(['new-badge']);
    write.mockRestore();
  });
});
