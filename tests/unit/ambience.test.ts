import { describe, expect, it } from 'vitest';
import {
  AmbienceController,
  CROSSFADE,
  DUCKED_LEVEL,
  FADE_IN,
  FADE_OUT,
  RECORDING_SLOTS,
  ambienceTarget,
  rampParam,
  type AmbiencePlayer,
  type AmbienceScene,
} from '@/audio/ambience';
import { AppState } from '@/core/states';
import { DEFAULT_SETTINGS } from '@/core/defaults';

const on = { enabled: true, unlocked: true, theme: 'day' as AmbienceScene };

describe('where the ambience plays', () => {
  it('fills the main menu, sits under the other menu screens', () => {
    expect(ambienceTarget({ ...on, screen: AppState.MAIN_MENU })).toEqual({ scene: 'day', level: 1 });
    for (const screen of [AppState.SETTINGS, AppState.COLLECTION, AppState.PASSPORT, AppState.GAME_SELECTION])
      expect(ambienceTarget({ ...on, screen })).toEqual({ scene: 'day', level: DUCKED_LEVEL });
    expect(DUCKED_LEVEL).toBeLessThan(0.5);
  });

  it('is silent before Touch to Start, in Story Mode and at the table', () => {
    for (const screen of [AppState.BOOT, AppState.INITIALIZATION, AppState.STORY_MODE, AppState.GAMEPLAY])
      expect(ambienceTarget({ ...on, screen }).scene, screen).toBeNull();
  });

  it('is silent until sound is allowed, and when switched off', () => {
    expect(ambienceTarget({ ...on, unlocked: false, screen: AppState.MAIN_MENU }).scene).toBeNull();
    expect(ambienceTarget({ ...on, enabled: false, screen: AppState.MAIN_MENU }).scene).toBeNull();
  });

  it('follows day and night', () => {
    expect(ambienceTarget({ ...on, theme: 'night', screen: AppState.MAIN_MENU }).scene).toBe('night');
  });

  it('is on by default at half volume, separately from the music', () => {
    expect(DEFAULT_SETTINGS.ambience).toBe(true);
    expect(DEFAULT_SETTINGS.ambienceVolume).toBe(0.5);
  });

  it('fetches nothing: no recording is listed until a licensed one is supplied', () => {
    for (const files of Object.values(RECORDING_SLOTS)) expect(files).toEqual([]);
  });
});

/** A player that records what it was asked to do, and holds one scene like the real one. */
class FakePlayer implements AmbiencePlayer {
  calls: string[] = [];
  scene: AmbienceScene | null = null;
  play(scene: AmbienceScene, fade: number) {
    this.calls.push(`play ${scene} ${fade}`);
    this.scene = scene;
  }
  stop(fade: number) {
    this.calls.push(`stop ${fade}`);
    this.scene = null;
  }
  level(value: number, fade: number) {
    this.calls.push(`level ${value} ${fade}`);
  }
}

describe('the ambience controller', () => {
  const at = (screen: AppState, theme: AmbienceScene = 'day') => ambienceTarget({ ...on, theme, screen });

  it('fades in with the menu, ducks on other screens, fades out for a game, and comes back', () => {
    const p = new FakePlayer();
    const c = new AmbienceController(p);
    c.update(at(AppState.INITIALIZATION));
    expect(p.calls).toEqual([]);
    c.update(at(AppState.MAIN_MENU));
    expect(p.calls).toEqual([`play day ${FADE_IN}`, expect.stringMatching(/^level 1 /)]);
    p.calls = [];
    c.update(at(AppState.SETTINGS));
    expect(p.calls).toEqual([expect.stringMatching(new RegExp(`^level ${DUCKED_LEVEL} `))]);
    p.calls = [];
    c.update(at(AppState.GAMEPLAY));
    expect(p.calls).toEqual([`stop ${FADE_OUT}`]);
    p.calls = [];
    c.update(at(AppState.MAIN_MENU));
    expect(p.calls[0]).toBe(`play day ${FADE_IN}`);
  });

  it('crossfades day to night once, and never starts a scene that is already playing', () => {
    const p = new FakePlayer();
    const c = new AmbienceController(p);
    c.update(at(AppState.MAIN_MENU));
    c.update(at(AppState.MAIN_MENU, 'night'));
    expect(p.calls.filter((x) => x.startsWith('play'))).toEqual([`play day ${FADE_IN}`, `play night ${CROSSFADE}`]);
    // Rapid navigation between menu screens: levels change, nothing new starts.
    p.calls = [];
    for (let i = 0; i < 20; i++) {
      c.update(at(AppState.SETTINGS, 'night'));
      c.update(at(AppState.MAIN_MENU, 'night'));
    }
    expect(p.calls.some((x) => x.startsWith('play') || x.startsWith('stop'))).toBe(false);
  });
});

describe('click-free fades', () => {
  it('every ramp starts from the value the gain has now', () => {
    const log: string[] = [];
    const param = {
      value: 0.37,
      cancelScheduledValues: (t: number) => void log.push(`cancel ${t}`),
      setValueAtTime: (v: number, t: number) => void log.push(`set ${v} ${t}`),
      linearRampToValueAtTime: (v: number, t: number) => void log.push(`ramp ${v} ${t}`),
    } as unknown as AudioParam;
    rampParam(param, 1, 3, 10);
    expect(log).toEqual(['cancel 10', 'set 0.37 10', 'ramp 1 13']);
    // A zero-length fade still ramps (an instant jump would click).
    log.length = 0;
    rampParam(param, 0, 0, 5);
    expect(log.at(-1)).toBe('ramp 0 5.02');
  });
});
