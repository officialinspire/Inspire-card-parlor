import type { Store } from '@/core/store';
import { AppState } from '@/core/states';
import { resolveTheme } from '@/themes/theme';
import { audio } from './engine';

/**
 * Riverfront ambience behind the title and the main menu: the Rappahannock
 * by day, the waterfront at night. It is its own system, beside the music:
 * it has its own bus (src/audio/engine.ts, under the master gain so Mute all
 * and Master volume apply, and below the music), its own setting and volume,
 * and it never starts or stops music.
 *
 * Sources (docs/AMBIENCE.md):
 *  · Beds and most one-shots are original procedural sound made here from
 *    filtered noise — water, breeze, leaves, a far-off town, lapping water.
 *  · Wildlife (birdsong by day, insects at night) has replaceable recording
 *    slots (`RECORDING_SLOTS`). Original, quiet synthesized bird phrases and
 *    cricket chirps play when no licensed field recordings are configured.
 *
 * Behaviour: silent until the first allowed gesture and until Touch to
 * Start; full on the main menu, ducked on other menu screens, faded out (and
 * stopped) in Story Mode and at the card table; day and night crossfade; one
 * scene at a time, never duplicated; nothing scheduled while the tab is
 * hidden.
 */

export type AmbienceScene = 'day' | 'night';

/** Where the ambience should be: which scene (null = silent) at what share of its volume. */
export interface AmbienceTarget {
  scene: AmbienceScene | null;
  level: number;
}

/** Menu screens other than the hub hear the river quietly; stories and games not at all. */
export const DUCKED_LEVEL = 0.35;

export function ambienceTarget(input: {
  screen: AppState;
  enabled: boolean;
  unlocked: boolean;
  theme: AmbienceScene;
}): AmbienceTarget {
  const silent = { scene: null, level: 0 };
  if (!input.enabled || !input.unlocked) return silent;
  switch (input.screen) {
    case AppState.BOOT:
    case AppState.INITIALIZATION: // nothing before Touch to Start
    case AppState.GAMEPLAY: // the table has its own sounds and music
    case AppState.STORY_MODE: // dialogue and the story's soundtrack
      return silent;
    case AppState.MAIN_MENU:
      return { scene: input.theme, level: 1 };
    default:
      return { scene: input.theme, level: DUCKED_LEVEL };
  }
}

/** What actually makes the sound; the controller only decides. */
export interface AmbiencePlayer {
  /** Starts (or crossfades to) a scene, fading in over `fade` seconds. */
  play(scene: AmbienceScene, fade: number): void;
  /** Fades out and releases every source. */
  stop(fade: number): void;
  /** Sets the scene's share of the ambience volume. */
  level(value: number, fade: number): void;
  readonly scene: AmbienceScene | null;
}

export const FADE_IN = 2.4;
export const CROSSFADE = 3;
export const FADE_OUT = 1.2;
export const LEVEL_FADE = 0.8;

export class AmbienceController {
  #current: AmbienceTarget = { scene: null, level: 0 };
  constructor(private player: AmbiencePlayer) {}

  update(target: AmbienceTarget): void {
    const was = this.#current;
    this.#current = target;
    if (!target.scene) {
      if (was.scene) this.player.stop(FADE_OUT);
      return;
    }
    if (target.scene !== was.scene) this.player.play(target.scene, was.scene ? CROSSFADE : FADE_IN);
    if (target.level !== was.level || target.scene !== was.scene) this.player.level(target.level, LEVEL_FADE);
  }

  get target(): AmbienceTarget {
    return this.#current;
  }
}

// ----------------------------------------------------------------------------
// Web Audio

/**
 * Recordings that replace the procedural fallbacks, as paths under
 * public/assets/ambience/. All empty today: no ambience recordings have been
 * supplied, and nothing is fetched while a list is empty. Add only properly
 * licensed or owned files, and record them in docs/AMBIENCE.md.
 */
export const RECORDING_SLOTS: Record<'day-birds' | 'night-insects', string[]> = {
  'day-birds': [],
  'night-insects': [],
};

/** A looped bed: filtered noise with a slow swell. */
interface BedSpec {
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  gain: number;
  /** Slow swell of the level (Hz, depth as a share of gain). */
  swell?: [number, number];
  /** Slow sweep of the filter (Hz, depth in Hz): gusts of wind. */
  sweep?: [number, number];
}

/** An occasional sound, every `every` seconds (random within the range). */
interface OneShotSpec {
  id: string;
  every: [number, number];
  play: (p: WebAmbience, at: number, out: AudioNode) => void;
  /** A recording slot that replaces this sound when it lists files. */
  slot?: keyof typeof RECORDING_SLOTS;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Every fade starts from the value the parameter has right now (not from
 * where an earlier, interrupted fade was heading), so a crossfade that is
 * itself interrupted never jumps — and a jump in gain is what clicks.
 */
export function rampParam(
  param: Pick<AudioParam, 'value' | 'cancelScheduledValues' | 'setValueAtTime' | 'linearRampToValueAtTime'>,
  to: number,
  fade: number,
  now: number,
): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + Math.max(0.02, fade));
}

const SCENES: Record<AmbienceScene, { beds: BedSpec[]; oneShots: OneShotSpec[] }> = {
  day: {
    beds: [
      // The river: a broad, low wash that rises and falls slowly…
      { filter: 'lowpass', freq: 700, gain: 0.5, swell: [0.05, 0.18] },
      // …with a lighter babble over the rocks.
      { filter: 'bandpass', freq: 1600, q: 0.7, gain: 0.1, swell: [0.11, 0.3] },
      // A soft breeze in the trees, gusting.
      { filter: 'bandpass', freq: 420, q: 0.9, gain: 0.14, sweep: [0.05, 180], swell: [0.03, 0.4] },
      // Downtown across the water: barely a hum.
      { filter: 'lowpass', freq: 140, gain: 0.08 },
    ],
    oneShots: [
      { id: 'leaves', every: [9, 22], play: (p, at, out) => p.leaves(at, out, 0.11) },
      { id: 'distant-car', every: [45, 95], play: (p, at, out) => p.swell(at, out, 380, 3.6, 0.045) },
      // Birdsong only from a recording (none yet): no oscillator imitation.
      { id: 'birds', every: [12, 28], slot: 'day-birds', play: (p, at, out) => p.birds(at, out) },
    ],
  },
  night: {
    beds: [
      { filter: 'lowpass', freq: 520, gain: 0.34, swell: [0.04, 0.2] },
      { filter: 'bandpass', freq: 360, q: 0.9, gain: 0.08, sweep: [0.04, 120], swell: [0.025, 0.45] },
      { filter: 'lowpass', freq: 120, gain: 0.05 },
    ],
    oneShots: [
      // Water lapping at the waterfront.
      { id: 'lap', every: [6, 14], play: (p, at, out) => p.swell(at, out, 520, 0.7, 0.07) },
      { id: 'leaves', every: [20, 40], play: (p, at, out) => p.leaves(at, out, 0.06) },
      // Crickets: a recording when one is listed; until then a soft, sparse placeholder chirp.
      { id: 'insects', every: [10, 26], slot: 'night-insects', play: (p, at, out) => p.chirps(at, out) },
    ],
  },
};

/** One playing scene: its gain (for fades), its sources and its timers. */
interface Instance {
  scene: AmbienceScene;
  gain: GainNode;
  nodes: AudioNode[];
  timers: Set<ReturnType<typeof setTimeout>>;
  releasing: ReturnType<typeof setTimeout> | null;
}

export class WebAmbience implements AmbiencePlayer {
  #live: Instance | null = null;
  #fading = new Set<Instance>();
  #level: GainNode | null = null;
  #recordings = new Map<string, AudioBuffer | 'failed' | 'loading'>();

  get scene(): AmbienceScene | null {
    return this.#live?.scene ?? null;
  }

  /** For tests and debugging: what is running. */
  get state() {
    const all = [...(this.#live ? [this.#live] : []), ...this.#fading];
    return {
      scene: this.scene,
      instances: all.length,
      fading: this.#fading.size,
      level: this.#level?.gain.value ?? 0,
      /** The ambience bus: the setting's volume (0 when off; Mute all acts on the master after it). */
      bus: audio.ambienceOut?.gain.value ?? 0,
      sources: all.reduce((n, i) => n + i.nodes.filter((x) => x instanceof AudioBufferSourceNode).length, 0),
      timers: all.reduce((n, i) => n + i.timers.size, 0),
    };
  }

  #out(): AudioNode | null {
    const ctx = audio.context;
    const bus = audio.ambienceOut;
    if (!ctx || !bus) return null;
    if (!this.#level) {
      this.#level = ctx.createGain();
      this.#level.gain.value = 0;
      this.#level.connect(bus);
    }
    return this.#level;
  }

  #ramp(param: AudioParam, to: number, fade: number): void {
    rampParam(param, to, fade, audio.context!.currentTime);
  }

  level(value: number, fade: number): void {
    if (!this.#out()) return;
    this.#ramp(this.#level!.gain, value, fade);
  }

  play(scene: AmbienceScene, fade: number): void {
    const out = this.#out();
    if (!out) return;
    if (this.#live?.scene === scene) return;
    // The same scene still fading out (back to the menu quickly): bring it back rather than start another.
    const revived = [...this.#fading].find((i) => i.scene === scene);
    if (this.#live) this.#release(this.#live, fade);
    if (revived) {
      this.#fading.delete(revived);
      if (revived.releasing) clearTimeout(revived.releasing);
      revived.releasing = null;
      this.#ramp(revived.gain.gain, 1, fade);
      this.#live = revived;
      this.#scheduleAll(revived);
      return;
    }
    this.#live = this.#start(scene, out, fade);
  }

  stop(fade: number): void {
    if (this.#live) this.#release(this.#live, fade);
    this.#live = null;
  }

  #start(scene: AmbienceScene, out: AudioNode, fade: number): Instance {
    const ctx = audio.context!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    const inst: Instance = { scene, gain, nodes: [], timers: new Set(), releasing: null };
    const noise = audio.ambienceNoise()!;
    for (const bed of SCENES[scene].beds) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = bed.filter;
      filter.frequency.value = bed.freq;
      if (bed.q) filter.Q.value = bed.q;
      const g = ctx.createGain();
      g.gain.value = bed.gain;
      src.connect(filter).connect(g).connect(gain);
      // Each bed starts at a different point in the noise, so no two layers line up.
      src.start(ctx.currentTime, Math.random() * noise.duration);
      inst.nodes.push(src, filter, g);
      if (bed.swell) inst.nodes.push(...this.#lfo(g.gain, bed.swell[0], bed.gain * bed.swell[1]));
      if (bed.sweep) inst.nodes.push(...this.#lfo(filter.frequency, bed.sweep[0], bed.sweep[1]));
    }
    this.#ramp(gain.gain, 1, fade);
    this.#scheduleAll(inst);
    return inst;
  }

  #lfo(param: AudioParam, hz: number, depth: number): AudioNode[] {
    const ctx = audio.context!;
    const osc = ctx.createOscillator();
    osc.frequency.value = hz * rand(0.8, 1.2);
    const d = ctx.createGain();
    d.gain.value = depth;
    osc.connect(d).connect(param);
    osc.start(ctx.currentTime + Math.random() * 2);
    return [osc, d];
  }

  #scheduleAll(inst: Instance): void {
    for (const spec of SCENES[inst.scene].oneShots) this.#schedule(inst, spec, true);
  }

  #schedule(inst: Instance, spec: OneShotSpec, first = false): void {
    const [lo, hi] = spec.every;
    // The first of each starts part-way through its interval, so a scene doesn't open with everything at once.
    const wait = (first ? rand(lo * 0.3, hi) : rand(lo, hi)) * 1000;
    const timer = setTimeout(() => {
      inst.timers.delete(timer);
      if (this.#live !== inst) return;
      const ctx = audio.context;
      // Nothing piles up while the tab is hidden or the context is suspended.
      if (ctx && !document.hidden && ctx.state === 'running') this.#oneShot(inst, spec, ctx.currentTime + 0.05);
      this.#schedule(inst, spec);
    }, wait);
    inst.timers.add(timer);
  }

  #oneShot(inst: Instance, spec: OneShotSpec, at: number): void {
    const ctx = audio.context!;
    // A little left or right, so the scene has width.
    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = rand(-0.6, 0.6);
    const out: AudioNode = pan ?? inst.gain;
    if (pan) pan.connect(inst.gain);
    const files = spec.slot ? RECORDING_SLOTS[spec.slot] : [];
    if (files.length) this.#recording(files[Math.floor(Math.random() * files.length)]!, at, out);
    else spec.play(this, at, out);
    if (pan) setTimeout(() => pan.disconnect(), 8000);
  }

  /** A recording from a slot, loaded once (and skipped for good if it can't load, e.g. offline). */
  #recording(path: string, at: number, out: AudioNode): void {
    const ctx = audio.context!;
    const cached = this.#recordings.get(path);
    if (cached === 'failed' || cached === 'loading') return;
    if (!cached) {
      this.#recordings.set(path, 'loading');
      fetch(`${import.meta.env.BASE_URL}${path}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => this.#recordings.set(path, buf))
        .catch(() => this.#recordings.set(path, 'failed'));
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = cached;
    const g = ctx.createGain();
    g.gain.value = rand(0.35, 0.6);
    src.connect(g).connect(out);
    src.start(at);
  }

  // ----- Original procedural one-shots -----

  /** Original stylized bird whistles, softly phrased with silence between calls. */
  birds(at: number, out: AudioNode): void {
    const ctx = audio.context!;
    const pitch = rand(1800, 2800);
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const t = at + i * 0.24;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch * (i % 2 ? 1.15 : 1), t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.45, t + 0.055);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.92, t + 0.17);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.018);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);
      osc.connect(gain).connect(out);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      osc.stop(t + 0.19);
    }
  }

  /** A shiver of leaves: a few soft, bright grains of noise over about a second. */
  leaves(at: number, out: AudioNode, peak: number): void {
    const grains = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < grains; i++) this.#grain(at + rand(0, 1.1), 0.08 + Math.random() * 0.12, 3500, peak, out);
  }

  /** A slow rise and fall of low noise: a car far across the river, water lapping. */
  swell(at: number, out: AudioNode, freq: number, dur: number, peak: number): void {
    const ctx = audio.context!;
    const src = ctx.createBufferSource();
    src.buffer = audio.ambienceNoise()!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(lp).connect(g).connect(out);
    src.start(at, Math.random() * 6);
    src.stop(at + dur + 0.05);
  }

  /**
   * Placeholder for crickets until a recording is listed: a short run of
   * very soft triple chirps, then silence. Deliberately sparse and quiet.
   */
  chirps(at: number, out: AudioNode): void {
    const ctx = audio.context!;
    const pitch = rand(4300, 4900);
    const groups = 4 + Math.floor(Math.random() * 6);
    for (let gi = 0; gi < groups; gi++) {
      const start = at + gi * rand(0.85, 1.25);
      for (let p = 0; p < 3; p++) {
        const t = start + p * 0.045;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = pitch;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.016, t + 0.006);
        g.gain.linearRampToValueAtTime(0, t + 0.028);
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + 0.04);
      }
    }
  }

  #grain(at: number, dur: number, freq: number, peak: number, out: AudioNode): void {
    const ctx = audio.context!;
    const src = ctx.createBufferSource();
    src.buffer = audio.ambienceNoise()!;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = freq * rand(0.8, 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak * rand(0.5, 1), at + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(hp).connect(g).connect(out);
    src.start(at, Math.random() * 6);
    src.stop(at + dur + 0.02);
  }

  #release(inst: Instance, fade: number): void {
    for (const t of inst.timers) clearTimeout(t);
    inst.timers.clear();
    this.#ramp(inst.gain.gain, 0, fade);
    this.#fading.add(inst);
    inst.releasing = setTimeout(
      () => {
        for (const n of inst.nodes) {
          try {
            (n as AudioScheduledSourceNode).stop?.();
          } catch {
            /* already stopped */
          }
          n.disconnect();
        }
        inst.nodes = [];
        inst.gain.disconnect();
        this.#fading.delete(inst);
      },
      (fade + 0.25) * 1000,
    );
  }
}

let debug: () => unknown = () => null;
/** What the ambience is doing (for tests). */
export const ambienceState = () => debug();

/** Follows the screen, the theme (day/night), the setting and the audio unlock. */
export function attachAmbience(store: Store): void {
  const player = new WebAmbience();
  const controller = new AmbienceController(player);
  const sync = () => {
    const s = store.state;
    controller.update(
      ambienceTarget({
        screen: s.screen,
        enabled: s.settings.ambience && s.boot.ready,
        unlocked: audio.context !== null,
        theme: resolveTheme(s.settings.theme),
      }),
    );
  };
  store.select((s) => s.screen, sync);
  store.select((s) => `${s.settings.ambience}|${s.settings.theme}`, sync);
  // "Auto" lighting follows the clock: check now and then for dusk and dawn.
  setInterval(sync, 60_000);
  // Sound is allowed only after a gesture; pick up as soon as it is.
  const onGesture = () => {
    if (audio.context) return;
    void audio.unlock().then(sync);
  };
  addEventListener('pointerdown', onGesture);
  addEventListener('keydown', onGesture);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });
  debug = () => ({ ...player.state, target: controller.target });
}
