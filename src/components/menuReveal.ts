/**
 * Hand-off from the opening sequence to the main menu: after Touch to Start
 * the intro fades to black, and the menu rises out of that black once, over
 * the given time. Any later visit to the menu (back from a game) just shows it.
 */
let pending: number | null = null;

export function requestMenuReveal(ms: number): void {
  pending = ms;
}

/** The reveal duration, once; null when the menu is not arriving from the intro. */
export function takeMenuReveal(): number | null {
  const ms = pending;
  pending = null;
  return ms;
}
