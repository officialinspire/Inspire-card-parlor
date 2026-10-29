export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const getOrientation = (): 'portrait' | 'landscape' => (innerWidth >= innerHeight ? 'landscape' : 'portrait');

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Older WebKit (iPad Safari) only has the prefixed API. */
interface WebkitFullscreen {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}
const doc = () => document as Document & WebkitFullscreen;
const root = () => document.documentElement as HTMLElement & WebkitFullscreen;

export const fullscreen = {
  supported: () => !!(root().requestFullscreen || root().webkitRequestFullscreen),
  active: () => !!(document.fullscreenElement || doc().webkitFullscreenElement),
  async toggle(): Promise<void> {
    try {
      if (fullscreen.active()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc().webkitExitFullscreen?.();
      } else if (root().requestFullscreen) await root().requestFullscreen({ navigationUI: 'hide' });
      else await root().webkitRequestFullscreen?.();
    } catch {
      /* denied, or not allowed here (iPhone Safari): the game never depends on it */
    }
  },
};

/** Keeps a CSS var in sync with the real visible height (mobile URL bars). */
export function trackViewport(onChange: () => void): void {
  const update = () => {
    const h = window.visualViewport?.height ?? innerHeight;
    document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
    onChange();
  };
  update();
  addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  addEventListener('orientationchange', () => setTimeout(update, 150));
}
