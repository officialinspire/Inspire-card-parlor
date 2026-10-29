import { describe, expect, it } from 'vitest';
import { environment, environmentImage, richMotionAllowed } from '@/components/environment';
import { celebrate } from '@/components/Notifications';
import { Store } from '@/core/store';
import { store } from '@/core/store';

const nav = (over: Record<string, unknown> = {}) =>
  ({ hardwareConcurrency: 8, deviceMemory: 8, connection: { saveData: false }, ...over }) as unknown as Navigator;

describe('menu environment', () => {
  it('only animates on capable devices without reduced motion or data saver', () => {
    expect(richMotionAllowed(false, nav())).toBe(true);
    expect(richMotionAllowed(true, nav())).toBe(false);
    expect(richMotionAllowed(false, nav({ connection: { saveData: true } }))).toBe(false);
    expect(richMotionAllowed(false, nav({ hardwareConcurrency: 2 }))).toBe(false);
    expect(richMotionAllowed(false, nav({ deviceMemory: 2 }))).toBe(false);
    // Browsers that don't report these hints are given the benefit of the doubt.
    expect(richMotionAllowed(false, { connection: undefined } as unknown as Navigator)).toBe(true);
  });

  it('shows the scene for the chosen theme and loads only that painting', () => {
    const s = new Store();
    s.dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: 'night' } });
    const env = environment(s, { variant: 'menu' });
    const art = (k: string) => env.el.querySelector<HTMLImageElement>(`.env-${k} .env-art`)!;
    expect(env.el.dataset.env).toBe('night');
    expect(art('night').getAttribute('src')).toBe(environmentImage('night'));
    expect(art('day').getAttribute('src')).toBeNull();

    s.dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: 'day' } });
    expect(env.el.dataset.env).toBe('day');
    expect(art('day').getAttribute('src')).toBe(environmentImage('day'));
    expect(env.el.querySelector('.env-day')!.classList.contains('active')).toBe(true);
    expect(env.el.querySelector('.env-night')!.classList.contains('active')).toBe(false);

    s.dispatch({ type: 'UPDATE_SETTINGS', patch: { reducedMotion: true } });
    expect(env.el.dataset.motion).toBe('calm');
    env.destroy();
  });

  it('uses relative asset paths that work under a GitHub Pages project folder', () => {
    expect(environmentImage('day')).toMatch(/^(\.\/|\/)?assets\/backgrounds\/menu\/day\.webp$/);
  });
});

describe('celebrations', () => {
  it('posts a gold toast with a title', () => {
    celebrate('Achievement unlocked', 'Gold Rush');
    const n = store.state.notifications.at(-1)!;
    expect(n).toMatchObject({ kind: 'celebrate', title: 'Achievement unlocked', message: 'Gold Rush', icon: 'trophy' });
  });
});
