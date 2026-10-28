export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const getOrientation = (): 'portrait' | 'landscape' => (innerWidth >= innerHeight ? 'landscape' : 'portrait');

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const fullscreen = {
  supported: () => !!document.documentElement.requestFullscreen,
  active: () => !!document.fullscreenElement,
  async toggle(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* denied or unsupported (e.g. iOS Safari) */
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
