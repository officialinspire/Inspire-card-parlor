import { h } from '@/utils/dom';
import { fullscreen, getOrientation, trackViewport } from '@/utils/device';
import { attachPersistence } from '@/storage/persistence';
import { attachAudio } from '@/audio';
import { attachAnalytics, track } from '@/analytics/analytics';
import { attachTheme } from '@/themes/theme';
import { attachDeckThemes } from '@/decks';
import { ScreenManager } from '@/components/ScreenManager';
import { attachDialogs } from '@/components/Dialog';
import { attachNotifications } from '@/components/Notifications';
import { SCREENS } from '@/components/screens';
import { AppState } from './states';
import { goBack, navigate, store } from './store';
import { runBoot } from './boot';
import { APP } from './config';

/** BOOT: wire every subsystem to the store, build the shell, then start loading. */
export async function startApp(mount: HTMLElement): Promise<void> {
  attachPersistence(store);
  attachDeckThemes(store);
  attachTheme(store);
  attachAudio(store);
  attachAnalytics(store);

  trackViewport(() => store.dispatch({ type: 'SET_ORIENTATION', orientation: getOrientation() }));
  store.dispatch({ type: 'SET_ONLINE', online: navigator.onLine });
  addEventListener('online', () => store.dispatch({ type: 'SET_ONLINE', online: true }));
  addEventListener('offline', () => store.dispatch({ type: 'SET_ONLINE', online: false }));
  document.addEventListener('fullscreenchange', () =>
    store.dispatch({ type: 'SET_FULLSCREEN', fullscreen: fullscreen.active() }),
  );

  const stage = h('main', { class: 'stage' });
  mount.replaceChildren(stage);
  new ScreenManager(stage, store, SCREENS);
  attachDialogs(mount, store);
  attachNotifications(mount, store);

  addEventListener('keydown', (e) => {
    if (store.state.modals.length || e.metaKey || e.ctrlKey || e.altKey) return;
    const s = store.state.screen;
    // Escape / Backspace act as "back" everywhere except the hub and splash.
    if ((e.key === 'Escape' || e.key === 'Backspace') && s !== AppState.MAIN_MENU && s !== AppState.INITIALIZATION) {
      // Gameplay owns its own back (it asks before leaving the table).
      if (s === AppState.GAMEPLAY)
        document.querySelector<HTMLElement>('.screen:not([aria-hidden]) [data-nav="back"]')?.click();
      else goBack();
    }
    if (e.key === 'f' || e.key === 'F') void fullscreen.toggle();
  });

  // Block pinch/double-tap zoom gestures on iOS for a native feel.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  track('boot', { version: APP.version });
  navigate(AppState.INITIALIZATION);
  await runBoot(store);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }

  // Expose the store for debugging and end-to-end tests.
  Object.assign(window, { __ICP__: { store, navigate } });
}
