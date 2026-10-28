import type { RootState } from '@/core/types';
import { store } from '@/core/store';

/**
 * Re-renders `el` whenever a store slice changes, and unsubscribes on its
 * own once the element has been removed from the page. Lets small widgets
 * (credit counters, now-playing chips) stay live without manual teardown.
 */
export function live<E extends Element, T>(el: E, selector: (s: RootState) => T, render: (el: E, value: T) => void): E {
  render(el, selector(store.state));
  let seen = false;
  const off = store.select(selector, (value) => {
    if (el.isConnected) seen = true;
    else if (seen) return off();
    render(el, value);
  });
  return el;
}
