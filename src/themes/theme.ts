import type { Store } from '@/core/store';
import { prefersReducedMotion } from '@/utils/device';
import './tokens.css';
import './base.css';
import './components.css';
import './screens.css';

/** Reflects settings/device state onto <html> so CSS can respond. */
export function attachTheme(store: Store): void {
  const root = document.documentElement;
  if (prefersReducedMotion() && !localStorage.getItem('icp:settings')) {
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { reducedMotion: true } });
  }
  const apply = () => {
    const { settings, orientation, online } = store.state;
    root.classList.toggle('reduced-motion', settings.reducedMotion);
    root.classList.toggle('left-handed', settings.leftHanded);
    root.dataset.orientation = orientation;
    root.dataset.online = String(online);
    root.dataset.animSpeed = settings.cardAnimationSpeed;
  };
  apply();
  store.subscribe((s, prev) => {
    if (s.settings !== prev.settings || s.orientation !== prev.orientation || s.online !== prev.online) apply();
  });
}
