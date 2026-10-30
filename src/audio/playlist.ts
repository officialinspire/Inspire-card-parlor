import { TRACKS, tracksIn, type MusicCategoryId } from './tracks';

/**
 * Pure playlist rules for the music player: which track comes next or
 * before, with shuffle and repeat. The audio engine only plays what this
 * decides, so the rules are easy to test.
 */
export type RepeatMode = 'all' | 'one' | 'off';

export interface PlaylistState {
  category: MusicCategoryId | 'all';
  shuffle: boolean;
  repeat: RepeatMode;
}

export function playlist(category: PlaylistState['category']): string[] {
  const ids = tracksIn(category).map((t) => t.id);
  return ids.length ? ids : TRACKS.map((t) => t.id);
}

/**
 * The track after `current`.
 * - `manual` (the Next button) always moves on, even on repeat-one.
 * - When a track ends: repeat-one replays it; repeat-off stops (null) after the last track.
 * - Shuffle picks a random track other than the current one and the recently played ones.
 */
export function nextInPlaylist(
  current: string,
  state: PlaylistState,
  opts: { manual: boolean; recent?: string[]; random?: () => number },
): string | null {
  const list = playlist(state.category);
  if (!opts.manual && state.repeat === 'one') return current;
  if (state.shuffle && list.length > 1) {
    const recent = new Set([current, ...(opts.recent ?? []).slice(-Math.floor(list.length / 2))]);
    const pool = list.filter((id) => !recent.has(id));
    const from = pool.length ? pool : list.filter((id) => id !== current);
    return from[Math.floor((opts.random ?? Math.random)() * from.length)]!;
  }
  const i = list.indexOf(current);
  if (i === -1) return list[0]!;
  if (i === list.length - 1 && !opts.manual && state.repeat === 'off') return null;
  return list[(i + 1) % list.length]!;
}

/** The track before `current`: the last one played if known, else the previous in order. */
export function previousInPlaylist(current: string, state: PlaylistState, history: string[] = []): string {
  const list = playlist(state.category);
  for (let i = history.length - 1; i >= 0; i--) {
    const id = history[i]!;
    if (id !== current && list.includes(id)) return id;
  }
  const i = list.indexOf(current);
  return list[(Math.max(0, i) - 1 + list.length) % list.length]!;
}

export const REPEAT_ORDER: RepeatMode[] = ['all', 'one', 'off'];
export const nextRepeat = (m: RepeatMode): RepeatMode => REPEAT_ORDER[(REPEAT_ORDER.indexOf(m) + 1) % 3]!;
