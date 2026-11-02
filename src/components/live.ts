import type { RootState } from '@/core/types';
import { store } from '@/core/store';

interface Binding {
  el: Element;
  off: () => void;
  seen: boolean;
  born: number;
}
const bindings = new Set<Binding>();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Re-renders `el` whenever a store slice changes. The subscription ends once
 * the element has left the page: at the next store change, or at the next
 * sweep (`sweepLive`, run whenever a screen or dialog is removed), whichever
 * comes first. Ending it on removal matters: a widget whose slice never
 * changes again (a credit counter) would otherwise keep its whole screen alive
 * (measured: ~200–700 DOM nodes per screen visit, never collected).
 */
export function live<E extends Element, T>(el: E, selector: (s: RootState) => T, render: (el: E, value: T) => void): E {
  render(el, selector(store.state));
  const b: Binding = { el, off: () => undefined, seen: el.isConnected, born: now() };
  const unsubscribe = store.select(selector, (value) => {
    if (el.isConnected) b.seen = true;
    else if (b.seen) return b.off();
    render(el, value);
  });
  b.off = () => {
    unsubscribe();
    bindings.delete(b);
  };
  bindings.add(b);
  return el;
}

/**
 * Ends the subscriptions of live widgets no longer on the page. A widget that
 * was never attached is released too once it is a few seconds old (it was
 * built and dropped).
 */
export function sweepLive(): void {
  const t = now();
  for (const b of [...bindings]) {
    if (b.el.isConnected) b.seen = true;
    else if (b.seen || t - b.born > 3000) b.off();
  }
}

/** For tests and diagnostics: live widgets still subscribed. */
export const liveCount = () => bindings.size;
