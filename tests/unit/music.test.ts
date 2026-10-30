import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_CATEGORIES, RECORDED_TRACKS, TRACKS, getTrack, tracksIn } from '@/audio/tracks';
import { nextInPlaylist, nextRepeat, playlist, previousInPlaylist } from '@/audio/playlist';
import { store } from '@/core/store';
import { AppState } from '@/core/states';
import { announce, attachAnnouncer, pendingAnnouncements, setPlayInProgress } from '@/progression/announcer';

describe('music library', () => {
  it('has the six playlist categories, each with music', () => {
    expect(MUSIC_CATEGORIES.map((c) => c.title)).toEqual([
      'Downtown Jazz',
      'Rappahannock Morning',
      'Woodland Ambience',
      'Casino Lounge',
      'Lo-Fi Card Table',
      'Midnight Solitaire',
    ]);
    for (const c of MUSIC_CATEGORIES) expect(tracksIn(c.id).length, c.id).toBeGreaterThan(0);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });

  it('keeps the original track ids (saved settings) and lists no recorded file that was not uploaded', () => {
    for (const id of ['lamplight', 'window-rain', 'corner-cafe', 'midnight-tea']) expect(getTrack(id).id).toBe(id);
    expect(RECORDED_TRACKS).toEqual([]);
    expect(getTrack('no-such-track').id).toBe(TRACKS[0]!.id);
  });
});

describe('playlist rules', () => {
  const jazz = { category: 'downtown-jazz' as const, shuffle: false, repeat: 'all' as const };

  it('Next moves through the playlist and wraps', () => {
    const list = playlist('downtown-jazz');
    expect(nextInPlaylist(list[0]!, jazz, { manual: true })).toBe(list[1]);
    expect(nextInPlaylist(list[list.length - 1]!, jazz, { manual: true })).toBe(list[0]);
  });

  it('repeat-one replays the track when it ends, but Next still moves on', () => {
    const one = { ...jazz, repeat: 'one' as const };
    expect(nextInPlaylist('lamplight', one, { manual: false })).toBe('lamplight');
    expect(nextInPlaylist('lamplight', one, { manual: true })).not.toBe('lamplight');
  });

  it('repeat-off stops after the last track', () => {
    const off = { ...jazz, repeat: 'off' as const };
    const list = playlist('downtown-jazz');
    expect(nextInPlaylist(list[list.length - 1]!, off, { manual: false })).toBeNull();
    expect(nextInPlaylist(list[0]!, off, { manual: false })).toBe(list[1]);
  });

  it('shuffle never repeats the current or recent tracks when it can avoid it', () => {
    const all = { category: 'all' as const, shuffle: true, repeat: 'all' as const };
    for (let i = 0; i < 50; i++) {
      const next = nextInPlaylist('lamplight', all, { manual: true, recent: ['corner-cafe'], random: Math.random })!;
      expect(['lamplight', 'corner-cafe']).not.toContain(next);
    }
  });

  it('Previous returns to the last track played, else the one before', () => {
    expect(previousInPlaylist('corner-cafe', jazz, ['lamplight', 'corner-cafe'])).toBe('lamplight');
    const list = playlist('downtown-jazz');
    expect(previousInPlaylist(list[0]!, jazz, [])).toBe(list[list.length - 1]);
  });

  it('cycles repeat modes', () => {
    expect([nextRepeat('all'), nextRepeat('one'), nextRepeat('off')]).toEqual(['one', 'off', 'all']);
  });
});

describe('announcements', () => {
  afterEach(() => vi.useRealTimers());

  it('wait while a hand is in progress, and show once it ends', async () => {
    attachAnnouncer(store);
    store.dispatch({ type: 'BOOT_READY' });
    store.dispatch({ type: 'NAVIGATE', to: AppState.INITIALIZATION });
    store.dispatch({ type: 'NAVIGATE', to: AppState.MAIN_MENU });
    setPlayInProgress(true);
    announce({ kind: 'achievement', id: 'first-win' });
    await Promise.resolve();
    expect(pendingAnnouncements()).toHaveLength(1);
    setPlayInProgress(false);
    expect(pendingAnnouncements()).toHaveLength(0);
  });
});
