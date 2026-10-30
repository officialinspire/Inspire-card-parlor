import type { Store } from '@/core/store';
import type { Settings } from '@/core/types';
import { audio } from './engine';
import { getTrack, type MusicCategoryId } from './tracks';
import { nextInPlaylist, previousInPlaylist, type PlaylistState } from './playlist';

export { audio } from './engine';
export type { Sfx } from './engine';
export { gameSound, onGameSound, type GameSound } from './gameSounds';
export {
  TRACKS,
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
    void audio.unlock().then(() => setSettings({ musicPaused: false }));
  },
  pause(): void {
    setSettings({ musicPaused: true });
  },
  toggle(): void {
    if (bound?.state.settings.musicPaused) music.play();
    else music.pause();
  },
  select(id: string): void {
    void audio.unlock().then(() => setSettings({ musicTrack: id, musicPaused: false }));
  },
  next(): void {
    if (!bound) return;
    const s = bound.state.settings;
    const id = nextInPlaylist(s.musicTrack, playlistState(s), { manual: true, recent: history });
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
  const s = bound.state.settings;
  const id = nextInPlaylist(s.musicTrack, playlistState(s), { manual: false, recent: history });
  if (id === null) return setSettings({ musicPaused: true });
  if (id === s.musicTrack) return audio.restartTrack();
  setSettings({ musicTrack: id });
}

/** Keeps the audio engine in sync with settings and page visibility. */
export function attachAudio(store: Store): void {
  bound = store;
  audio.configure(store.state.settings);
  audio.onTrackEnd(onTrackEnd);
  store.select(
    (s) => s.settings,
    (settings) => audio.configure(settings),
  );
  const follow = () => {
    const s = store.state.settings;
    if (!store.state.boot.ready || store.state.screen === 'INITIALIZATION' || store.state.screen === 'BOOT') return;
    if (s.musicPaused) return audio.stopMusic();
    const track = getTrack(s.musicTrack);
    if (history[history.length - 1] !== track.id) history.push(track.id);
    if (history.length > 30) history.shift();
    audio.startMusic(track);
  };
  store.select((s) => s.settings.musicTrack, follow);
  store.select((s) => s.settings.musicPaused, follow);
  document.addEventListener('visibilitychange', () => audio.setSuspended(document.hidden));

  // Browsers only allow sound after a gesture: unlock on the first one anywhere.
  const unlock = () => void audio.unlock().then(follow);
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}

/** Starts music after the Enter button (a user gesture), unless the player paused it. */
export function startMusicFromGesture(store: Store): void {
  void audio.unlock().then(() => {
    const s = store.state.settings;
    if (!s.musicPaused) audio.startMusic(getTrack(s.musicTrack));
  });
}
