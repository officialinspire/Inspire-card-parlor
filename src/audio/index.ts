import type { Store } from '@/core/store';
import { audio } from './engine';

export { audio } from './engine';
export type { Sfx } from './engine';

/** Keeps the audio engine in sync with settings and page visibility. */
export function attachAudio(store: Store): void {
  audio.configure(store.state.settings);
  store.select(
    (s) => s.settings,
    (settings) => audio.configure(settings),
  );
  document.addEventListener('visibilitychange', () => audio.setSuspended(document.hidden));

  // Unlock on the first gesture anywhere, in case the player skips the Enter button.
  const unlock = () => {
    void audio.unlock().then(() => {
      if (store.state.boot.ready && store.state.screen !== 'INITIALIZATION') audio.startMusic();
    });
  };
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}
