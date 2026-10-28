export interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  /** Seconds per chord. */
  bar: number;
  /** Chord voicings in Hz, looped in order. */
  chords: number[][];
  pad: OscillatorType;
  /** Low-pass cutoff for the pad (lower = warmer). */
  warmth: number;
  /** Bell notes per bar, as fractions of the bar. */
  bells: number[];
  /** Octave multiplier for bell notes. */
  bellOctave: number;
}

/**
 * Generative lounge tracks. Each is a slow chord loop with soft bell
 * accents; recorded music in /public/assets/music can replace them later.
 */
export const TRACKS: readonly MusicTrack[] = [
  {
    id: 'lamplight',
    title: 'Lamplight Shuffle',
    mood: 'Warm & easy',
    bar: 4.2,
    chords: [
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
    ],
    pad: 'triangle',
    warmth: 900,
    bells: [0.5],
    bellOctave: 4,
  },
  {
    id: 'window-rain',
    title: 'Rain on the Window',
    mood: 'Quiet & rainy',
    bar: 5.4,
    chords: [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ],
    pad: 'sine',
    warmth: 700,
    bells: [0.25, 0.7],
    bellOctave: 4,
  },
  {
    id: 'corner-cafe',
    title: 'Corner Café',
    mood: 'Bright & sunny',
    bar: 3.4,
    chords: [
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [146.83, 185.0, 220.0, 261.63], // D7
    ],
    pad: 'triangle',
    warmth: 1300,
    bells: [0.25, 0.5, 0.875],
    bellOctave: 4,
  },
  {
    id: 'midnight-tea',
    title: 'Midnight Tea',
    mood: 'Slow & dreamy',
    bar: 6,
    chords: [
      [138.59, 164.81, 207.65, 246.94], // C#m7
      [123.47, 155.56, 185.0, 220.0], // Bmaj7-ish
      [110.0, 138.59, 164.81, 207.65], // Amaj7
      [123.47, 146.83, 185.0, 220.0], // Bm7
    ],
    pad: 'sine',
    warmth: 600,
    bells: [0.6],
    bellOctave: 4,
  },
];

export const getTrack = (id: string) => TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;

export function nextTrackId(id: string, step = 1): string {
  const i = TRACKS.findIndex((t) => t.id === id);
  return TRACKS[(i + step + TRACKS.length) % TRACKS.length]!.id;
}
