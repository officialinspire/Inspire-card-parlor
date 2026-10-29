import type { Store } from '@/core/store';
import { audio } from './engine';
import { getTrack } from './tracks';

export { audio } from './engine';
export type { Sfx } from './engine';
export { gameSound, onGameSound, type GameSound } from './gameSounds';
export { TRACKS, getTrack, nextTrackId } from './tracks';

/** Keeps the audio engine in sync with settings and page visibility. */
export function attachAudio(store: Store): void {
  audio.configure(store.state.settings);
  store.select(
    (s) => s.settings,
    (settings) => audio.configure(settings),
  );
  store.select(
    (s) => s.settings.musicTrack,
    (id) => audio.startMusic(getTrack(id)),
  );
  document.addEventListener('visibilitychange', () => audio.setSuspended(document.hidden));

  // Unlock on the first gesture anywhere, in case the player skips the Enter button.
  const unlock = () => {
    void audio.unlock().then(() => {
      if (store.state.boot.ready && store.state.screen !== 'INITIALIZATION') {
        audio.startMusic(getTrack(store.state.settings.musicTrack));
      }
    });
  };
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}
