import { store } from '@/core/store';

/**
 * Optional vibration feedback. Only on devices with the Vibration API, only
 * when the player keeps "Haptic feedback" on, and never while the page is
 * hidden. Patterns stay short so they feel like taps, not buzzes.
 */
export type Haptic = 'tap' | 'success' | 'error' | 'impact' | 'celebrate';

const PATTERNS: Record<Haptic, number | number[]> = {
  tap: 8,
  success: [12, 40, 18],
  error: [30, 50, 30],
  impact: 35,
  celebrate: [20, 60, 20, 60, 40],
};

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** Vibrates if supported and enabled. `force` skips the setting (used to preview it when switched on). */
export function haptic(kind: Haptic, force = false): boolean {
  if (!hapticsSupported() || (typeof document !== 'undefined' && document.hidden)) return false;
  if (!force && !store.state.settings.haptics) return false;
  try {
    return navigator.vibrate(PATTERNS[kind]);
  } catch {
    return false;
  }
}
