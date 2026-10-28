import type { Settings } from '@/core/types';
import { TRACKS, type MusicTrack } from './tracks';

export type Sfx = 'tap' | 'back' | 'flip' | 'shuffle' | 'chime' | 'error';

/**
 * Web Audio engine. Everything is synthesized for now so the parlor has
 * sound before recorded assets land in /public/assets/{music,sfx}.
 * The context is created lazily and unlocked on the first user gesture.
 */
class AudioEngine {
  #ctx: AudioContext | null = null;
  #master!: GainNode;
  #music!: GainNode;
  #sfx!: GainNode;
  #settings: Pick<Settings, 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'muted'> = {
    masterVolume: 0.8,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    muted: false,
  };
  #musicTimer: ReturnType<typeof setTimeout> | null = null;
  #noise: AudioBuffer | null = null;
  #track: MusicTrack = TRACKS[0]!;

  get unlocked(): boolean {
    return this.#ctx?.state === 'running';
  }

  /** Must be called from a user gesture (tap/click/key). */
  async unlock(): Promise<void> {
    if (!this.#ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.#ctx = new Ctor();
      this.#master = this.#ctx.createGain();
      this.#music = this.#ctx.createGain();
      this.#sfx = this.#ctx.createGain();
      this.#music.connect(this.#master);
      this.#sfx.connect(this.#master);
      this.#master.connect(this.#ctx.destination);
      this.#applyVolumes();
    }
    if (this.#ctx.state === 'suspended') await this.#ctx.resume().catch(() => undefined);
  }

  configure(settings: Settings): void {
    this.#settings = settings;
    this.#applyVolumes();
  }

  #applyVolumes(): void {
    if (!this.#ctx) return;
    const t = this.#ctx.currentTime;
    const s = this.#settings;
    this.#master.gain.setTargetAtTime(s.muted ? 0 : s.masterVolume, t, 0.05);
    this.#music.gain.setTargetAtTime(s.musicVolume * 0.35, t, 0.1);
    this.#sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
  }

  #noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.#noise) return this.#noise;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return (this.#noise = buf);
  }

  #tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number, out: AudioNode): void {
    const ctx = this.#ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  #swish(start: number, dur: number, freq: number, peak: number): void {
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
    src.connect(bp).connect(g).connect(this.#sfx);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.unlocked) return;
    const t = this.#ctx!.currentTime;
    switch (name) {
      case 'tap':
        this.#tone(880, t, 0.08, 'triangle', 0.18, this.#sfx);
        break;
      case 'back':
        this.#tone(520, t, 0.1, 'triangle', 0.16, this.#sfx);
        break;
      case 'flip':
        this.#swish(t, 0.09, 3200, 0.35);
        break;
      case 'shuffle':
        for (let i = 0; i < 9; i++) this.#swish(t + i * 0.045, 0.06, 2200 + Math.random() * 1800, 0.25);
        break;
      case 'chime':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.#tone(f, t + i * 0.08, 0.6, 'sine', 0.14, this.#sfx));
        break;
      case 'error':
        this.#tone(196, t, 0.18, 'sawtooth', 0.08, this.#sfx);
        break;
    }
  }

  /** Starts (or switches to) a generative track. */
  startMusic(track: MusicTrack = this.#track): void {
    const switching = track.id !== this.#track.id;
    this.#track = track;
    if (!this.unlocked) return;
    if (this.#musicTimer && !switching) return;
    this.stopMusic();
    let step = 0;
    const loop = () => {
      const ctx = this.#ctx!;
      const t = ctx.currentTime + 0.05;
      const { chords, bar, bells, bellOctave } = this.#track;
      const chord = chords[step % chords.length]!;
      chord.forEach((f) => this.#pad(f, t, bar + 1));
      for (const at of bells) {
        const bell = chord[Math.floor(Math.random() * chord.length)]! * bellOctave;
        this.#tone(bell, t + bar * at, 1.8, 'sine', 0.05, this.#music);
      }
      step++;
      this.#musicTimer = setTimeout(loop, bar * 1000);
    };
    loop();
  }

  get playing(): boolean {
    return this.#musicTimer !== null;
  }

  #pad(freq: number, start: number, dur: number): void {
    const ctx = this.#ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.#track.warmth;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.07, start + 1.2);
    g.gain.linearRampToValueAtTime(0, start + dur);
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = this.#track.pad;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(start);
      osc.stop(start + dur + 0.1);
    }
    lp.connect(g).connect(this.#music);
  }

  stopMusic(): void {
    if (this.#musicTimer) clearTimeout(this.#musicTimer);
    this.#musicTimer = null;
  }

  /** Pause everything while the tab is hidden. */
  setSuspended(suspended: boolean): void {
    if (!this.#ctx) return;
    if (suspended) void this.#ctx.suspend();
    else void this.#ctx.resume();
  }
}

export const audio = new AudioEngine();
