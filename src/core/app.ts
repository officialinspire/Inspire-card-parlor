import { h } from '@/utils/dom';
import { getOrientation, trackViewport } from '@/utils/device';
import { attachPersistence } from '@/storage/persistence';
import { attachAudio } from '@/audio';
import { attachAnalytics, track } from '@/analytics/analytics';
import { attachTheme } from '@/themes/theme';
import { ScreenManager } from '@/components/ScreenManager';
import { attachModalLayer } from '@/components/Modal';
import { SCREENS } from '@/components/screens';
import { AppState } from './states';
import { goBack, navigate, store } from './store';
import { runBoot } from './boot';
import { APP } from './config';

/** BOOT: wire every subsystem to the store, build the shell, then start loading. */
export async function startApp(mount: HTMLElement): Promise<void> {
  attachPersistence(store);
  attachTheme(store);
  attachAudio(store);
  attachAnalytics(store);

  trackViewport(() => store.dispatch({ type: 'SET_ORIENTATION', orientation: getOrientation() }));
  store.dispatch({ type: 'SET_ONLINE', online: navigator.onLine });
  addEventListener('online', () => store.dispatch({ type: 'SET_ONLINE', online: true }));
  addEventListener('offline', () => store.dispatch({ type: 'SET_ONLINE', online: false }));

  const stage = h('main', { class: 'stage' });
  mount.replaceChildren(stage);
  new ScreenManager(stage, store, SCREENS);
  attachModalLayer(mount, store);

  // Keyboard: Escape acts as "back" outside the hub and splash.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || store.state.modal) return;
    const s = store.state.screen;
    if (s !== AppState.MAIN_MENU && s !== AppState.INITIALIZATION && s !== AppState.BOOT) goBack();
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

  // Expose the store for debugging in development.
  if (import.meta.env.DEV) Object.assign(window, { __ICP__: { store, navigate } });
}
