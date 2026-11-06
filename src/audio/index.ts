import type { Store } from '@/core/store';
import type { Settings } from '@/core/types';
import { AppState } from '@/core/states';
import { audio } from './engine';
import { getTrack, markUnavailable, playableTracks, type MusicCategoryId, type MusicTrack } from './tracks';

const DEFAULT_SYNTH = 'lamplight';
import { nextInPlaylist, previousInPlaylist, type PlaylistState } from './playlist';

export { audio } from './engine';
export type { Sfx } from './engine';
export { gameHaptic, gameSound, onGameSound, type GameSound } from './gameSounds';
export {
  ALL_TRACKS,
  playableTracks,
  markUnavailable,
  MUSIC_CATEGORIES,
  RECORDED_TRACKS,
  getTrack,
  getCategory,
  tracksIn,
  nextTrackId,
  type MusicTrack,
  type MusicCategoryId,
} from './tracks';
export { nextRepeat, type RepeatMode } from './playlist';

let bound: Store | null = null;
/** The story director's track for the current moment (null outside Story Mode). */
let context: string | null = null;
/** The player picked music themselves during this Story Mode visit: their choice wins. */
let override = false;
let follow: () => void = () => undefined;

/**
 * Sets (or clears, with null) the story's music for the current moment.
 * `inStory` is false once the player has left Story Mode (and its tables):
 * only then is their own pick forgotten, so a choice made in a chapter holds
 * on the map and in the next chapter too.
 */
let settle: ReturnType<typeof setTimeout> | null = null;
/** Screens can pass through several moments at once (a game → the map → a chapter): settle first. */
const SETTLE_MS = 220;

export function setMusicContext(trackId: string | null, inStory = trackId !== null): void {
  if (!inStory) override = false;
  if (trackId === context) return;
  context = trackId;
  // One crossfade for the place the player lands on, not one per screen passed through.
  if (settle) clearTimeout(settle);
  settle = setTimeout(() => {
    settle = null;
    follow();
  }, SETTLE_MS);
}

/** The track that should be heard now: the story's, unless the player chose otherwise. */
function wantedTrack(s: Settings): { track: MusicTrack; source: 'story' | 'player' } {
  if (context && s.storySoundtrack && !override && playableTracks().some((t) => t.id === context))
    return { track: getTrack(context), source: 'story' };
  return { track: getTrack(s.musicTrack), source: 'player' };
}
const playerChoice = () => {
  if (context) override = true;
};
/** Tracks played this session, for Previous and to keep shuffle from repeating itself. */
const history: string[] = [];

const playlistState = (s: Settings): PlaylistState => ({
  category: s.musicCategory as MusicCategoryId | 'all',
  shuffle: s.musicShuffle,
  repeat: s.musicRepeat,
});

const setSettings = (patch: Partial<Settings>) => bound?.dispatch({ type: 'UPDATE_SETTINGS', patch });

/**
 * The music player's controls. State lives in settings (track, paused,
 * shuffle, repeat, playlist), so it survives reloads and every screen shows
 * the same thing; the engine follows the settings.
 */
export const music = {
  play(): void {
    const unlocked = audio.unlock();
    setSettings({ musicPaused: false });
    void unlocked.then(follow);
  },
  pause(): void {
    setSettings({ musicPaused: true });
  },
  toggle(): void {
    if (bound?.state.settings.musicPaused) music.play();
    else music.pause();
  },
  select(id: string): void {
    playerChoice();
    const unlocked = audio.unlock();
    setSettings({ musicTrack: id, musicPaused: false });
    follow();
    void unlocked.then(follow);
  },
  next(): void {
    if (!bound) return;
    const s = bound.state.settings;
    const from = bound.state.nowPlaying?.track ?? s.musicTrack;
    const id = nextInPlaylist(from, playlistState(s), { manual: true, recent: history });
    if (id) music.select(id);
  },
  previous(): void {
    if (!bound) return;
    const s = bound.state.settings;
    // Like a CD player: past the first few seconds, Previous restarts the track.
    if (audio.playing && audio.position > 5) return audio.restartTrack();
    music.select(previousInPlaylist(s.musicTrack, playlistState(s), history));
  },
  setCategory(category: string): void {
    if (!bound) return;
    const tracks = playlistState({ ...bound.state.settings, musicCategory: category });
    const inList = nextInPlaylist('', tracks, { manual: true });
    const current = getTrack(bound.state.settings.musicTrack);
    // Switching playlist starts it, unless the current track already belongs.
    setSettings({
      musicCategory: category,
      ...(category === 'all' || current.category === category ? {} : { musicTrack: inList ?? current.id }),
    });
  },
};

/** When a track finishes, move on per shuffle and repeat. */
function onTrackEnd(): void {
  if (!bound) return;
  // The story's music loops for as long as the scene lasts.
  if (bound.state.nowPlaying?.source === 'story') return audio.restartTrack();
  const s = bound.state.settings;
  const id = nextInPlaylist(s.musicTrack, playlistState(s), { manual: false, recent: history });
  if (id === null) return setSettings({ musicPaused: true });
  if (id === s.musicTrack) return audio.restartTrack();
  setSettings({ musicTrack: id });
}

/** A recorded track that can't play leaves the library for this session; the music moves on. */
function onTrackFailed(track: MusicTrack): void {
  if (!bound) return;
  markUnavailable(track.id);
  // A story track that can't play gives way to the player's own music.
  if (track.id === context) return follow();
  const s = bound.state.settings;
  if (s.musicTrack !== track.id) return;
  const id = nextInPlaylist(track.id, playlistState(s), { manual: true, recent: history });
  setSettings({ musicTrack: id && id !== track.id ? id : getTrack(DEFAULT_SYNTH).id });
}

/** Keeps the audio engine in sync with settings and page visibility. */
export function attachAudio(store: Store): void {
  bound = store;
  audio.configure(store.state.settings);
  audio.onTrackEnd(onTrackEnd);
  audio.onTrackFailed(onTrackFailed);
  store.select(
    (s) => s.settings,
    (settings) => audio.configure(settings),
  );
  const opening = (s: Store['state']) => s.screen === AppState.INITIALIZATION || s.screen === AppState.BOOT;
  audio.setEffectsEnabled(!opening(store.state));
  follow = () => {
    const s = store.state.settings;
    if (!store.state.boot.ready || opening(store.state) || document.hidden) return;
    const { track, source } = wantedTrack(s);
    const now = store.state.nowPlaying;
    if (now?.track !== track.id || now.source !== source)
      store.dispatch({ type: 'NOW_PLAYING', nowPlaying: { track: track.id, source } });
    if (s.musicPaused) return audio.stopMusic();
    if (history[history.length - 1] !== track.id) history.push(track.id);
    if (history.length > 30) history.shift();
    // One track at a time: the engine crossfades from whatever is playing.
    audio.startMusic(track);
  };
  store.select((s) => s.settings.musicTrack, follow);
  store.select((s) => s.settings.musicPaused, follow);
  store.select((s) => s.settings.storySoundtrack, follow);
  store.select((s) => s.boot.ready, follow);
  // The studio video plays before the menu. Keep game effects and music
  // silent throughout the opening, even if Web Audio is already unlocked.
  store.select(opening, (inIntro) => {
    audio.setEffectsEnabled(!inIntro);
    follow();
  });
  document.addEventListener('visibilitychange', () => {
    void audio.setSuspended(document.hidden).then(follow);
  });

  // A browser can unlock Web Audio yet refuse a later HTML media play.
  // Retry that recording on the next click or key, with user activation.
  const onGesture = () => {
    if (document.hidden) return;
    audio.retryRecordingFromGesture();
    if (!audio.unlocked) void audio.unlock().then(follow);
  };
  addEventListener('click', onGesture, { capture: true });
  addEventListener('keydown', onGesture, { capture: true });
}
