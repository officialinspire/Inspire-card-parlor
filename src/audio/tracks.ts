/**
 * The parlor's music library.
 *
 * Two kinds of track share one registry:
 *  - `synth`: generative pieces played by the Web Audio engine (slow chord
 *    loops with bells, bass and ambient textures). These are what ships today.
 *  - `file`: recorded music in /public/assets/music. None has been uploaded
 *    yet, so `RECORDED_TRACKS` is empty; adding an entry there (with a real
 *    file) is all it takes for it to appear in the player.
 *
 * Every track belongs to one of the six playlist categories.
 */

export type MusicCategoryId =
  | 'downtown-jazz'
  | 'rappahannock-morning'
  | 'woodland-ambience'
  | 'casino-lounge'
  | 'lofi-card-table'
  | 'midnight-solitaire';

export interface MusicCategory {
  id: MusicCategoryId;
  title: string;
  description: string;
}

export const MUSIC_CATEGORIES: readonly MusicCategory[] = [
  { id: 'downtown-jazz', title: 'Downtown Jazz', description: 'Brushed chords from a corner café.' },
  { id: 'rappahannock-morning', title: 'Rappahannock Morning', description: 'Sunrise on the river.' },
  { id: 'woodland-ambience', title: 'Woodland Ambience', description: 'Wind, leaves and birdsong.' },
  { id: 'casino-lounge', title: 'Casino Lounge', description: 'Velvet booths and a walking bass.' },
  { id: 'lofi-card-table', title: 'Lo-Fi Card Table', description: 'Dusty tape and soft rain.' },
  { id: 'midnight-solitaire', title: 'Midnight Solitaire', description: 'Slow and dreamy, for late games.' },
];

/** Background texture under a synthesized track. */
export type Texture = 'none' | 'rain' | 'water' | 'wind' | 'vinyl' | 'room';

interface TrackBase {
  id: string;
  title: string;
  mood: string;
  category: MusicCategoryId;
  /** Seconds before the player moves on (generative tracks never end on their own). */
  duration: number;
}

export interface SynthTrack extends TrackBase {
  kind: 'synth';
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
  /** Plucked bass on these fractions of the bar (root an octave down). */
  bass?: number[];
  texture?: Texture;
  /** Occasional bird calls (woodland). */
  birds?: boolean;
}

export interface FileTrack extends TrackBase {
  kind: 'file';
  /** Path under the site root, e.g. "assets/music/downtown-jazz-01.mp3". */
  src: string;
  /** Credited performer or composer, exactly as supplied. */
  artist?: string;
}

export type MusicTrack = SynthTrack | FileTrack;

// Chord voicings (Hz).
const Dm7 = [146.83, 174.61, 220.0, 261.63];
const G7 = [196.0, 246.94, 293.66, 349.23];
const Cmaj7 = [130.81, 164.81, 196.0, 246.94];
const Am7 = [220.0, 261.63, 329.63, 392.0];
const Fmaj7 = [174.61, 220.0, 261.63, 329.63];
const Em7 = [164.81, 196.0, 246.94, 293.66];
const Gmaj7 = [196.0, 246.94, 293.66, 369.99];
const D7 = [146.83, 185.0, 220.0, 261.63];
const Dmaj7 = [146.83, 185.0, 220.0, 277.18];
const Bm7 = [123.47, 146.83, 185.0, 220.0];
const Emaj7 = [164.81, 207.65, 246.94, 311.13];
const Asus2 = [110.0, 123.47, 164.81, 220.0];

/** Generative tracks. The first four are the originals (their ids are kept for saved settings). */
export const SYNTH_TRACKS: readonly SynthTrack[] = [
  {
    kind: 'synth',
    id: 'lamplight',
    title: 'Lamplight Shuffle',
    mood: 'Warm & easy',
    category: 'downtown-jazz',
    duration: 180,
    bar: 4.2,
    chords: [Dm7, G7, Cmaj7, Am7],
    pad: 'triangle',
    warmth: 900,
    bells: [0.5],
    bellOctave: 4,
    bass: [0, 0.5],
  },
  {
    kind: 'synth',
    id: 'corner-cafe',
    title: 'Corner Café',
    mood: 'Bright & sunny',
    category: 'downtown-jazz',
    duration: 170,
    bar: 3.4,
    chords: [Gmaj7, Em7, Am7, D7],
    pad: 'triangle',
    warmth: 1300,
    bells: [0.25, 0.5, 0.875],
    bellOctave: 4,
    bass: [0, 0.5],
    texture: 'room',
  },
  {
    kind: 'synth',
    id: 'river-dawn',
    title: 'River at Dawn',
    mood: 'Fresh & open',
    category: 'rappahannock-morning',
    duration: 200,
    bar: 5,
    chords: [Dmaj7, Gmaj7, Bm7, Asus2],
    pad: 'sine',
    warmth: 1100,
    bells: [0.2, 0.6],
    bellOctave: 4,
    texture: 'water',
  },
  {
    kind: 'synth',
    id: 'falmouth-bridge',
    title: 'Falmouth Bridge',
    mood: 'Gentle & golden',
    category: 'rappahannock-morning',
    duration: 190,
    bar: 4.6,
    chords: [Cmaj7, Fmaj7, Am7, G7],
    pad: 'triangle',
    warmth: 1000,
    bells: [0.375, 0.75],
    bellOctave: 4,
    texture: 'water',
    birds: true,
  },
  {
    kind: 'synth',
    id: 'woodland-hush',
    title: 'Woodland Hush',
    mood: 'Wind in the trees',
    category: 'woodland-ambience',
    duration: 220,
    bar: 6.5,
    chords: [Asus2, Em7, Dmaj7, Asus2],
    pad: 'sine',
    warmth: 650,
    bells: [0.7],
    bellOctave: 4,
    texture: 'wind',
    birds: true,
  },
  {
    kind: 'synth',
    id: 'turtle-creek',
    title: 'Turtle Creek',
    mood: 'Mossy & calm',
    category: 'woodland-ambience',
    duration: 210,
    bar: 6,
    chords: [Em7, Cmaj7, Gmaj7, D7],
    pad: 'sine',
    warmth: 700,
    bells: [0.3],
    bellOctave: 4,
    texture: 'water',
    birds: true,
  },
  {
    kind: 'synth',
    id: 'velvet-room',
    title: 'The Velvet Room',
    mood: 'Smoky & smooth',
    category: 'casino-lounge',
    duration: 180,
    bar: 3.6,
    chords: [Dm7, G7, Em7, Am7],
    pad: 'triangle',
    warmth: 1000,
    bells: [0.5, 0.75],
    bellOctave: 4,
    bass: [0, 0.25, 0.5, 0.75],
    texture: 'room',
  },
  {
    kind: 'synth',
    id: 'high-roller',
    title: 'High Roller',
    mood: 'Gold & glitter',
    category: 'casino-lounge',
    duration: 170,
    bar: 3.2,
    chords: [Fmaj7, Em7, Dm7, Cmaj7],
    pad: 'triangle',
    warmth: 1400,
    bells: [0.125, 0.5, 0.625],
    bellOctave: 4,
    bass: [0, 0.25, 0.5, 0.75],
  },
  {
    kind: 'synth',
    id: 'window-rain',
    title: 'Rain on the Window',
    mood: 'Quiet & rainy',
    category: 'lofi-card-table',
    duration: 200,
    bar: 5.4,
    chords: [Fmaj7, Em7, Dm7, Cmaj7],
    pad: 'sine',
    warmth: 700,
    bells: [0.25, 0.7],
    bellOctave: 4,
    texture: 'rain',
  },
  {
    kind: 'synth',
    id: 'tape-deck',
    title: 'Tape Deck Shuffle',
    mood: 'Dusty & mellow',
    category: 'lofi-card-table',
    duration: 180,
    bar: 4,
    chords: [Am7, Dm7, Gmaj7, Cmaj7],
    pad: 'triangle',
    warmth: 800,
    bells: [0.25, 0.625],
    bellOctave: 4,
    bass: [0, 0.625],
    texture: 'vinyl',
  },
  {
    kind: 'synth',
    id: 'midnight-tea',
    title: 'Midnight Tea',
    mood: 'Slow & dreamy',
    category: 'midnight-solitaire',
    duration: 220,
    bar: 6,
    chords: [
      [138.59, 164.81, 207.65, 246.94], // C#m7
      [123.47, 155.56, 185.0, 220.0], // Bmaj7-ish
      [110.0, 138.59, 164.81, 207.65], // Amaj7
      Bm7,
    ],
    pad: 'sine',
    warmth: 600,
    bells: [0.6],
    bellOctave: 4,
  },
  {
    kind: 'synth',
    id: 'last-hand',
    title: 'The Last Hand',
    mood: 'Moonlit & still',
    category: 'midnight-solitaire',
    duration: 230,
    bar: 7,
    chords: [Emaj7, Cmaj7, Am7, Bm7],
    pad: 'sine',
    warmth: 550,
    bells: [0.45, 0.9],
    bellOctave: 4,
    texture: 'vinyl',
  },
];

/**
 * Recorded music, uploaded by OFFICIAL INSPIRE (each file's own artist tag reads
 * "officialinspire"). To add more, put the file in public/assets/music and add
 * an entry here; the player never lists a file that isn't there. A file the
 * browser can't play is dropped from the library for the session and the
 * player moves on.
 */
export const RECORDED_TRACKS: readonly FileTrack[] = [
  {
    kind: 'file',
    id: 'parlor-menu',
    title: 'Inspire Card Parlor Menu Track',
    mood: 'The parlor theme',
    category: 'lofi-card-table',
    duration: 181,
    src: 'assets/music/inspire-card-parlor-menu-track.m4a',
    artist: 'OFFICIAL INSPIRE',
  },
  {
    kind: 'file',
    id: 'fxbg-saturday-walk',
    title: 'Downtown FXBG Saturday Walk',
    mood: 'A stroll down Caroline Street',
    category: 'downtown-jazz',
    duration: 170,
    src: 'assets/music/downtown-fxbg-saturday-walk.m4a',
    artist: 'OFFICIAL INSPIRE',
  },
  {
    kind: 'file',
    id: 'fxbg-after-dark',
    title: 'Downtown Fredericksburg After Dark',
    mood: 'Lamplit streets',
    category: 'downtown-jazz',
    duration: 179,
    src: 'assets/music/downtown-fredericksburg-after-dark.m4a',
    artist: 'OFFICIAL INSPIRE',
  },
  {
    kind: 'file',
    id: 'silent-study-hours',
    title: 'Silent Study Hours',
    mood: 'Quiet & focused',
    category: 'lofi-card-table',
    duration: 173,
    src: 'assets/music/silent-study-hours.m4a',
    artist: 'OFFICIAL INSPIRE',
  },
  {
    kind: 'file',
    id: 'shadows-of-the-occult',
    title: 'Shadows of the Occult',
    mood: 'Dark & mysterious',
    category: 'midnight-solitaire',
    duration: 178,
    src: 'assets/music/shadows-of-the-occult.m4a',
    artist: 'OFFICIAL INSPIRE',
  },
];

/** Recorded tracks that failed to load this session (unsupported format, missing file, offline). */
const unavailable = new Set<string>();
export const markUnavailable = (id: string) => void unavailable.add(id);

/** Every track in the library, recorded first. */
export const ALL_TRACKS: readonly MusicTrack[] = [...RECORDED_TRACKS, ...SYNTH_TRACKS];

/** The playable library: every track except recorded ones that failed to load this session. */
export const playableTracks = (): MusicTrack[] => ALL_TRACKS.filter((t) => !unavailable.has(t.id));

/** Looks a track up; unknown or unplayable ids fall back to the first playable track. */
export const getTrack = (id: string): MusicTrack => {
  const list = playableTracks();
  return list.find((t) => t.id === id) ?? list[0]!;
};

export const getCategory = (id: string): MusicCategory | undefined => MUSIC_CATEGORIES.find((c) => c.id === id);

export const tracksIn = (category: MusicCategoryId | 'all'): MusicTrack[] =>
  category === 'all' ? playableTracks() : playableTracks().filter((t) => t.category === category);

export function nextTrackId(id: string, step = 1): string {
  const list = playableTracks();
  const i = list.findIndex((t) => t.id === id);
  return list[(i + step + list.length) % list.length]!.id;
}
