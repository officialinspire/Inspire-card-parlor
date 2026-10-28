import type { Store } from '@/core/store';
import type { AppState } from '@/core/states';
import type { Screen, ScreenRegistry } from './Screen';

/**
 * Swaps screens in response to `state.screen`, running a short
 * cross-fade/slide. Direction follows navigation depth so "back"
 * feels like back.
 */
export class ScreenManager {
  #current: { state: AppState; screen: Screen } | null = null;
  #stage: HTMLElement;

  constructor(
    root: HTMLElement,
    private store: Store,
    private registry: ScreenRegistry,
  ) {
    this.#stage = root;
    store.subscribe((s, prev, action) => {
      if (s.screen === prev.screen) return;
      const dir = action.type === 'BACK' || s.history.length < prev.history.length ? 'back' : 'forward';
      this.show(s.screen, dir);
    });
  }

  show(state: AppState, dir: 'forward' | 'back' = 'forward'): void {
    const factory = this.registry[state];
    if (!factory) {
      console.warn(`[ScreenManager] no screen registered for ${state}`);
      return;
    }
    const next = factory({ store: this.store });
    next.el.classList.add('screen');
    next.el.dataset.state = state;

    const reduced = this.store.state.settings.reducedMotion;
    const old = this.#current;
    this.#current = { state, screen: next };

    this.#stage.appendChild(next.el);
    if (!reduced) next.el.classList.add(`enter-${dir}`);
    requestAnimationFrame(() => {
      next.el.classList.remove(`enter-${dir}`);
      next.mount?.();
      // Move focus for keyboard/screen-reader users.
      next.el.querySelector<HTMLElement>('[autofocus], .screen-title, button')?.focus({ preventScroll: true });
    });

    if (old) {
      old.screen.unmount?.();
      const el = old.screen.el;
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
      if (reduced) el.remove();
      else {
        el.classList.add(`leave-${dir}`);
        const remove = () => el.remove();
        el.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 600);
      }
    }
  }
}
