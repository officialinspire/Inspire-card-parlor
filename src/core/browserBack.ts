import type { Store } from './store';
import { AppState } from './states';
import { goBack } from './store';

/**
 * The browser's Back (and Android's back gesture) steps back inside the
 * parlor instead of leaving it: one history entry is added when the player
 * leaves the main menu, and Back closes an open dialog first, then steps
 * back a screen (Gameplay and Story Mode use their own Back, so a game in
 * progress still asks before leaving the table).
 *
 * From the main menu Back leaves as it normally would — nobody is trapped —
 * and it can never return to the opening sequence.
 */
export function attachBrowserBack(store: Store): void {
  let armed = false;
  const arm = () => {
    if (armed) return;
    history.pushState({ icp: 'parlor' }, '');
    armed = true;
  };
  const inParlor = (s: AppState) => s !== AppState.BOOT && s !== AppState.INITIALIZATION && s !== AppState.MAIN_MENU;

  store.select(
    (s) => s.screen,
    (screen) => {
      if (inParlor(screen)) arm();
    },
  );

  addEventListener('popstate', () => {
    armed = false;
    const { screen, modals } = store.state;
    if (modals.length) {
      // The dialog's own Escape handling closes it (or does nothing for one that must be answered).
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    } else if (screen === AppState.GAMEPLAY || screen === AppState.STORY_MODE) {
      document.querySelector<HTMLElement>('.screen:not([aria-hidden]) [data-nav="back"]')?.click();
    } else if (inParlor(screen)) {
      goBack();
    } else return;
    // Still inside the parlor (or a dialog asks first): keep one step of Back in hand.
    queueMicrotask(() => {
      if (inParlor(store.state.screen) || store.state.modals.length) arm();
    });
  });
}
