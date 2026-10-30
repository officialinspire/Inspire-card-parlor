import type { Settings } from '@/core/types';
import { ALL_TRACKS, type MusicTrack, type SynthTrack, type Texture } from './tracks';

export type Sfx =
  | 'tap'
  | 'back'
  | 'flip'
  | 'shuffle'
  | 'chime'
  | 'error'
  | 'deal'
  | 'slide'
  | 'place'
  | 'valid'
  | 'war'
  | 'ask'
  | 'victory'
  | 'achievement'
  | 'unlock'
  | 'levelup';

type VolumeSettings = Pick<Settings, 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'muted' | 'musicMuted'>;

/** One playing track: its own gain (for crossfades) and whatever keeps it going. */
interface Voice {
  track: MusicTrack;
  gain: GainNode;
  timer: ReturnType<typeof setTimeout> | null;
  element?: HTMLAudioElement;
  nodes: AudioNode[];
  step: number;
  alive: boolean;
}

const FADE_IN = 1.6;
const FADE_OUT = 1.2;
const PAUSE_FADE = 0.6;
/** Music sits well under effects: effects run at full bus level, music at a third. */
const MUSIC_BUS = 0.35;

/**
 * Web Audio engine. Music is generative (or recorded, once files exist);
 * effects are synthesized. Everything passes through a gentle limiter so
 * stacked sounds never clip. The context is created lazily and unlocked on
 * the first user gesture, as browsers require.
 */
class AudioEngine {
  #ctx: AudioContext | null = null;
  #master!: GainNode;
  #limiter!: DynamicsCompressorNode;
  #music!: GainNode;
  #sfx!: GainNode;
  #settings: VolumeSettings = { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.7, muted: false, musicMuted: false };
  #noise: AudioBuffer | null = null;
  #track: MusicTrack = ALL_TRACKS[0]!;
  #voice: Voice | null = null;
  /** Seconds of the current track already played (before the current run). */
  #elapsedBefore = 0;
  #startedAt = 0;
  #endTimer: ReturnType<typeof setTimeout> | null = null;
  #onEnded: (() => void) | null = null;
  #onFailed: ((track: MusicTrack) => void) | null = null;
  #unlockListener: (() => void) | null = null;

  get unlocked(): boolean {
    return this.#ctx?.state === 'running';
  }

  /** Must be called from a user gesture (tap/click/key). */
  async unlock(): Promise<void> {
    if (!this.#ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = (this.#ctx = new Ctor());
      this.#master = ctx.createGain();
      this.#limiter = ctx.createDynamicsCompressor();
      this.#limiter.threshold.value = -10;
      this.#limiter.knee.value = 6;
      this.#limiter.ratio.value = 12;
      this.#limiter.attack.value = 0.003;
      this.#limiter.release.value = 0.2;
      this.#music = ctx.createGain();
      this.#sfx = ctx.createGain();
      this.#music.connect(this.#master);
      this.#sfx.connect(this.#master);
      this.#master.connect(this.#limiter).connect(ctx.destination);
      this.#applyVolumes();
    }
    if (this.#ctx.state === 'suspended') await this.#ctx.resume().catch(() => undefined);
    if (this.unlocked && this.#unlockListener) {
      const fn = this.#unlockListener;
      this.#unlockListener = null;
      fn();
    }
  }

  /** Called once, the first time sound is allowed to play. */
  onUnlock(fn: () => void): void {
    if (this.unlocked) fn();
    else this.#unlockListener = fn;
  }

  configure(settings: VolumeSettings): void {
    this.#settings = settings;
    this.#applyVolumes();
  }

  #applyVolumes(): void {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    const s = this.#settings;
    this.#master.gain.setTargetAtTime(s.muted ? 0 : s.masterVolume, t, 0.05);
    this.#music.gain.setTargetAtTime(s.musicMuted ? 0 : s.musicVolume * MUSIC_BUS, t, 0.1);
    this.#sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
  }

  #noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.#noise) return this.#noise;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return (this.#noise = buf);
  }

  #tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number, out: AudioNode, glide?: number) {
    const ctx = this.#ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, start + dur * 0.8);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  #swish(start: number, dur: number, freq: number, peak: number, out: AudioNode = this.#sfx): void {
    const ctx = this.#ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.#noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(start, Math.random());
    src.stop(start + dur + 0.02);
  }

  /** A soft low thump (war drum, card knock). */
  #thump(start: number, freq: number, dur: number, peak: number): void {
    this.#tone(freq * 1.6, start, dur, 'sine', peak, this.#sfx, freq * 0.6);
  }

  play(name: Sfx): void {
    if (!this.unlocked) return;
    const t = this.#ctx!.currentTime;
    const sfx = this.#sfx;
    switch (name) {
      case 'tap':
        // A small wooden click: short triangle blip with a touch of noise.
        this.#tone(880, t, 0.07, 'triangle', 0.16, sfx);
        this.#swish(t, 0.02, 4200, 0.06);
        break;
      case 'back':
        this.#tone(560, t, 0.09, 'triangle', 0.14, sfx, 420);
        break;
      case 'flip':
        this.#swish(t, 0.09, 3200, 0.35);
        this.#tone(1400, t + 0.02, 0.04, 'triangle', 0.05, sfx);
        break;
      case 'shuffle':
        for (let i = 0; i < 12; i++) this.#swish(t + i * 0.038, 0.05, 2000 + Math.random() * 2200, 0.22);
        this.#thump(t + 0.48, 120, 0.12, 0.18);
        break;
      case 'chime':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.#tone(f, t + i * 0.08, 0.6, 'sine', 0.14, sfx));
        break;
      case 'error':
        // A muted "nope": two low soft notes, never harsh.
        this.#tone(233, t, 0.12, 'triangle', 0.14, sfx);
        this.#tone(196, t + 0.09, 0.16, 'triangle', 0.12, sfx);
        break;
      case 'deal':
        // A light card snap: short, high and soft so a full deal patters.
        this.#swish(t, 0.045, 2800, 0.2);
        break;
      case 'slide':
        this.#swish(t, 0.11, 1700, 0.16);
        break;
      case 'place':
        // Card set down: a soft low knock under a tiny swish.
        this.#tone(170, t, 0.07, 'triangle', 0.2, sfx);
        this.#swish(t, 0.04, 2400, 0.16);
        break;
      case 'valid':
        // Placement plus a bright little "yes".
        this.#tone(170, t, 0.07, 'triangle', 0.2, sfx);
        this.#swish(t, 0.04, 2400, 0.16);
        this.#tone(1318.5, t + 0.03, 0.18, 'sine', 0.07, sfx);
        break;
      case 'war':
        // Drum roll and a hit.
        for (let i = 0; i < 4; i++) this.#thump(t + i * 0.07, 90, 0.12, 0.16 + i * 0.03);
        this.#thump(t + 0.3, 70, 0.35, 0.34);
        this.#swish(t + 0.3, 0.25, 900, 0.18);
        break;
      case 'ask':
        // A bubbly "plip" rising like a fishing float.
        this.#tone(520, t, 0.14, 'sine', 0.16, sfx, 980);
        this.#tone(780, t + 0.1, 0.12, 'sine', 0.1, sfx, 1250);
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.#tone(f, t + i * 0.09, 0.9, 'sine', 0.13, sfx));
        for (let i = 0; i < 6; i++) this.#swish(t + 0.45 + i * 0.05, 0.05, 3000 + i * 300, 0.1);
        break;
      case 'achievement':
        // Sparkle: a quick arpeggio over a warm bell.
        this.#tone(392, t, 1.2, 'sine', 0.1, sfx);
        [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => this.#tone(f, t + i * 0.06, 0.5, 'sine', 0.09, sfx));
        for (let i = 0; i < 5; i++) this.#swish(t + 0.2 + i * 0.04, 0.04, 6000 + i * 500, 0.05);
        break;
      case 'unlock':
        // A latch opening and a rising fifth.
        this.#tone(300, t, 0.05, 'square', 0.05, sfx);
        this.#swish(t, 0.05, 3600, 0.14);
        this.#tone(659.25, t + 0.08, 0.5, 'sine', 0.12, sfx);
        this.#tone(987.77, t + 0.18, 0.7, 'sine', 0.12, sfx);
        break;
      case 'levelup':
        [392, 523.25, 659.25, 783.99].forEach((f, i) => this.#tone(f, t + i * 0.1, 0.45, 'triangle', 0.11, sfx));
        this.#tone(1046.5, t + 0.42, 1.0, 'sine', 0.12, sfx);
        break;
    }
  }

  // ----- Music -----

  /** Called when the current track has played its length (or a recorded file ends). */
  onTrackEnd(fn: (() => void) | null): void {
    this.#onEnded = fn;
  }

  /** Called when a recorded track can't be played. */
  onTrackFailed(fn: ((track: MusicTrack) => void) | null): void {
    this.#onFailed = fn;
  }

  get track(): MusicTrack {
    return this.#track;
  }

  get playing(): boolean {
    return this.#voice !== null;
  }

  /** Seconds played of the current track. */
  get position(): number {
    if (!this.#voice || !this.#ctx) return this.#elapsedBefore;
    if (this.#voice.element) return this.#voice.element.currentTime;
    return this.#elapsedBefore + (this.#ctx.currentTime - this.#startedAt);
  }

  /** Plays `track`, crossfading from whatever is playing. Same track: keeps playing (or resumes). */
  startMusic(track: MusicTrack = this.#track): void {
    const switching = track.id !== this.#track.id;
    if (switching) this.#elapsedBefore = 0;
    this.#track = track;
    if (!this.unlocked) return;
    if (this.#voice && !switching) return;
    if (this.#voice) this.#release(this.#voice, FADE_OUT);
    this.#voice = this.#begin(track);
  }

  /** Fades out and stops; `startMusic` resumes the same track. */
  stopMusic(fade = PAUSE_FADE): void {
    if (this.#voice) {
      this.#elapsedBefore = this.position;
      this.#release(this.#voice, fade);
    }
    this.#voice = null;
    this.#clearEndTimer();
  }

  /** Restart the current track from the top (repeat-one). */
  restartTrack(): void {
    this.#elapsedBefore = 0;
    if (!this.#voice) return;
    this.#release(this.#voice, FADE_OUT);
    this.#voice = this.#begin(this.#track);
  }

  #clearEndTimer(): void {
    if (this.#endTimer) clearTimeout(this.#endTimer);
    this.#endTimer = null;
  }

  #begin(track: MusicTrack): Voice {
    const ctx = this.#ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
    gain.connect(this.#music);
    const voice: Voice = { track, gain, timer: null, nodes: [], step: 0, alive: true };
    this.#startedAt = ctx.currentTime;
    this.#clearEndTimer();
    if (track.kind === 'file') {
      const el = new Audio(`${import.meta.env.BASE_URL}${track.src}`);
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.currentTime = this.#elapsedBefore;
      const src = ctx.createMediaElementSource(el);
      src.connect(gain);
      voice.element = el;
      voice.nodes.push(src);
      el.addEventListener('ended', () => this.#voice === voice && this.#onEnded?.());
      // Missing file or a format this browser can't decode: hand over to the controller.
      el.addEventListener('error', () => this.#voice === voice && this.#onFailed?.(track));
      void el.play().catch((e: unknown) => {
        // Autoplay refusals are retried on the next gesture; real decode errors fire 'error'.
        if (e instanceof DOMException && e.name === 'NotSupportedError' && this.#voice === voice)
          this.#onFailed?.(track);
      });
    } else {
      this.#texture(voice, track.texture ?? 'none');
      this.#schedule(voice, track);
      const remaining = Math.max(1, track.duration - this.#elapsedBefore);
      this.#endTimer = setTimeout(() => this.#voice === voice && this.#onEnded?.(), remaining * 1000);
    }
    return voice;
  }

  #release(voice: Voice, fade: number): void {
    const ctx = this.#ctx!;
    const t = ctx.currentTime;
    voice.alive = false;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + fade);
    if (voice.timer) clearTimeout(voice.timer);
    voice.timer = null;
    setTimeout(
      () => {
        voice.element?.pause();
        for (const n of voice.nodes) {
          try {
            (n as AudioScheduledSourceNode).stop?.();
          } catch {
            /* already stopped */
          }
          n.disconnect();
        }
        voice.gain.disconnect();
      },
      (fade + 0.2) * 1000,
    );
  }

  /** Chords, bells, bass and birds, one bar at a time. */
  #schedule(voice: Voice, track: SynthTrack): void {
    const loop = () => {
      const ctx = this.#ctx!;
      const t = ctx.currentTime + 0.05;
      const { chords, bar, bells, bellOctave } = track;
      const chord = chords[voice.step % chords.length]!;
      chord.forEach((f) => this.#pad(voice, track, f, t, bar + 1));
      for (const at of bells) {
        const bell = chord[Math.floor(Math.random() * chord.length)]! * bellOctave;
        this.#tone(bell, t + bar * at, 1.8, 'sine', 0.05, voice.gain);
      }
      for (const at of track.bass ?? []) {
        const note = at === 0 ? chord[0]! : chord[Math.floor(Math.random() * 2)]!;
        this.#tone(note / 2, t + bar * at, Math.min(1.2, bar / 2), 'triangle', 0.12, voice.gain);
      }
      if (track.birds && Math.random() < 0.45) {
        const at = t + Math.random() * bar;
        const base = 2200 + Math.random() * 1400;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++)
          this.#tone(base, at + i * 0.13, 0.09, 'sine', 0.025, voice.gain, base * 1.35);
      }
      voice.step++;
      voice.timer = setTimeout(loop, bar * 1000);
    };
    loop();
  }

  #pad(voice: Voice, track: SynthTrack, freq: number, start: number, dur: number): void {
    const ctx = this.#ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = track.warmth;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.07, start + 1.2);
    g.gain.linearRampToValueAtTime(0, start + dur);
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = track.pad;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(start);
      osc.stop(start + dur + 0.1);
    }
    lp.connect(g).connect(voice.gain);
  }

  /** A looping filtered-noise bed (rain, river, wind, tape hiss, room tone). */
  #texture(voice: Voice, texture: Texture): void {
    if (texture === 'none') return;
    const ctx = this.#ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.#noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const shape: Record<Exclude<Texture, 'none'>, [BiquadFilterType, number, number]> = {
      rain: ['highpass', 2500, 0.05],
      water: ['lowpass', 600, 0.08],
      wind: ['bandpass', 450, 0.07],
      vinyl: ['highpass', 4000, 0.025],
      room: ['lowpass', 300, 0.04],
    };
    const [type, freq, level] = shape[texture];
    filter.type = type;
    filter.frequency.value = freq;
    g.gain.value = level;
    src.connect(filter).connect(g).connect(voice.gain);
    src.start();
    voice.nodes.push(src, filter, g);
    if (texture === 'wind') {
      // Gusts: slowly sweep the band.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.08;
      depth.gain.value = 250;
      lfo.connect(depth).connect(filter.frequency);
      lfo.start();
      voice.nodes.push(lfo, depth);
    }
    if (texture === 'vinyl') {
      // Occasional crackle.
      const crackle = () => {
        if (!voice.alive) return;
        this.#swish(ctx.currentTime, 0.01, 5000, 0.08, voice.gain);
        setTimeout(crackle, 150 + Math.random() * 900);
      };
      crackle();
    }
  }

  /** Pause everything while the tab is hidden. */
  setSuspended(suspended: boolean): void {
    if (!this.#ctx) return;
    if (suspended) void this.#ctx.suspend();
    else void this.#ctx.resume();
  }
}

export const audio = new AudioEngine();
