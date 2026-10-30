import { audio, type Sfx } from './engine';

/**
 * Sound hooks for card games. Views announce what happened on the table;
 * this layer decides what is heard:
 *
 *  - events raised during the same action (the same task) are merged, so a
 *    move that is both a `card_move` and a `valid_move` plays one sound;
 *  - an event repeated faster than its minimum gap is dropped (a 28-card deal
 *    patters instead of buzzing), and identical events never stack.
 *
 * Every event still reaches `onGameSound` listeners (and a `icp:sound` DOM
 * event), with `played` telling whether it made a sound.
 */
export type GameSound =
  | 'card_flip'
  | 'card_deal'
  | 'card_move'
  | 'card_shuffle'
  | 'valid_move'
  | 'invalid_move'
  | 'war_battle'
  | 'go_fish_ask'
  | 'victory';

export const GAME_SOUND_SFX: Record<GameSound, Sfx> = {
  card_flip: 'flip',
  card_deal: 'deal',
  card_move: 'slide',
  card_shuffle: 'shuffle',
  valid_move: 'valid',
  invalid_move: 'error',
  war_battle: 'war',
  go_fish_ask: 'ask',
  victory: 'victory',
};

/** Vibration that accompanies an event (when haptics are on and supported). */
export const GAME_SOUND_HAPTIC: Partial<Record<GameSound, 'tap' | 'error' | 'impact' | 'celebrate'>> = {
  invalid_move: 'error',
  war_battle: 'impact',
  victory: 'celebrate',
};

/** Minimum time between two plays of the same event. */
const MIN_GAP: Record<GameSound, number> = {
  card_flip: 50,
  card_deal: 38,
  card_move: 60,
  card_shuffle: 450,
  valid_move: 70,
  invalid_move: 220,
  war_battle: 400,
  go_fish_ask: 250,
  victory: 2000,
};

/** Within one action, a stronger event makes the weaker ones redundant. */
const SUPERSEDES: Partial<Record<GameSound, GameSound[]>> = {
  victory: ['valid_move', 'card_move', 'card_flip', 'card_deal', 'war_battle'],
  war_battle: ['card_flip', 'card_move'],
  invalid_move: ['card_move', 'valid_move'],
  valid_move: ['card_move'],
  card_shuffle: ['card_deal'],
};

export interface GameSoundEvent {
  event: GameSound;
  played: boolean;
  at: number;
}

type Listener = (e: GameSoundEvent) => void;
const listeners = new Set<Listener>();
let pending: GameSound[] = [];
const lastPlayed = new Map<GameSound, number>();
let player: (sfx: Sfx) => void = (sfx) => audio.play(sfx);
let buzzer: (kind: NonNullable<(typeof GAME_SOUND_HAPTIC)[GameSound]>) => void = () => undefined;

/** Connects haptic output (kept separate so this module stays free of DOM/store imports). */
export function setGameHaptics(fn: typeof buzzer): void {
  buzzer = fn;
}
let clock: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function onGameSound(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Announce something that happened on the table. */
export function gameSound(event: GameSound): void {
  if (!pending.length) queueMicrotask(flush);
  pending.push(event);
}

/** Resolves the current batch now (tests, or code that must not wait a microtask). */
export function flush(): void {
  const batch = pending;
  pending = [];
  if (!batch.length) return;
  const present = new Set(batch);
  const now = clock();
  const handled = new Set<GameSound>();
  for (const event of batch) {
    let played = false;
    const superseded = [...present].some((other) => SUPERSEDES[other]?.includes(event));
    if (!handled.has(event) && !superseded && now - (lastPlayed.get(event) ?? -Infinity) >= MIN_GAP[event]) {
      player(GAME_SOUND_SFX[event]);
      const buzz = GAME_SOUND_HAPTIC[event];
      if (buzz) buzzer(buzz);
      lastPlayed.set(event, now);
      played = true;
    }
    handled.add(event);
    const e: GameSoundEvent = { event, played, at: now };
    for (const l of listeners) l(e);
    if (typeof dispatchEvent === 'function' && typeof CustomEvent === 'function')
      dispatchEvent(new CustomEvent('icp:sound', { detail: e }));
  }
}

/** Test seam: replace the audio output and clock; returns a restore function. */
export function __setSoundBackend(p: (sfx: Sfx) => void, c?: () => number): () => void {
  const prev = { player, clock };
  player = p;
  if (c) clock = c;
  lastPlayed.clear();
  pending = [];
  return () => {
    player = prev.player;
    clock = prev.clock;
    lastPlayed.clear();
  };
}
