import type { Store } from '@/core/store';
import type { ThemeMode } from '@/core/types';
import { prefersReducedMotion } from '@/utils/device';
import './tokens.css';
import './base.css';
import './components.css';
import './screens.css';
import './progression.css';

/** Day runs 7:00–18:59 on the player's own clock; the parlor lights its lamps after that. */
export function resolveTheme(mode: ThemeMode, hour = new Date().getHours()): 'day' | 'night' {
  if (mode !== 'auto') return mode;
  return hour >= 7 && hour < 19 ? 'day' : 'night';
}

/** Reflects settings/device state onto <html> so CSS can respond. */
export function attachTheme(store: Store): void {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (prefersReducedMotion() && !localStorage.getItem('icp:settings')) {
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { reducedMotion: true } });
  }
  const apply = () => {
    const { settings, orientation, online } = store.state;
    const theme = resolveTheme(settings.theme);
    root.dataset.theme = theme;
    root.classList.toggle('reduced-motion', settings.reducedMotion);
    root.classList.toggle('left-handed', settings.leftHanded);
    root.dataset.orientation = orientation;
    root.dataset.online = String(online);
    root.dataset.animSpeed = settings.cardAnimationSpeed;
    meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#efe4cf');
  };
  apply();
  store.subscribe((s, prev) => {
    if (s.settings !== prev.settings || s.orientation !== prev.orientation || s.online !== prev.online) apply();
  });
  // Re-check "auto" lighting every few minutes so the parlor follows the clock.
  setInterval(() => store.state.settings.theme === 'auto' && apply(), 5 * 60_000);
}
