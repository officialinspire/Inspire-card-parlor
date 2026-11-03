import { describe, expect, it, vi } from 'vitest';
import { store } from '@/core/store';
import { live, liveCount, releaseLive, sweepLive } from '@/components/live';
import { onStorageHealth, reportWrite, storageFailing } from '@/storage/health';
import { local } from '@/storage/local';
import { AssetManager } from '@/assets/AssetManager';

/** Prompt 32: no screen kept alive by its widgets; saving problems reported; card faces wait for the opening. */
describe('live widgets let go of their screen', () => {
  it('releases a quickly discarded owner before any sweep observes it', () => {
    const before = liveCount();
    const root = document.createElement('section');
    const render = vi.fn();
    root.append(live(document.createElement('span'), (s) => s.settings.sfxVolume, render));
    expect(liveCount()).toBe(before + 1);
    releaseLive(root);
    expect(liveCount()).toBe(before);
    render.mockClear();
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { sfxVolume: 0.77 } });
    expect(render).not.toHaveBeenCalled();
  });

  it('a widget whose value never changes again is released when its screen is removed', () => {
    const screen = document.createElement('section');
    const pill = live(
      document.createElement('span'),
      (s) => s.profile.credits,
      (el, v) => (el.textContent = String(v)),
    );
    screen.append(pill);
    document.body.append(screen);
    const before = liveCount();
    sweepLive(); // still on the page: kept
    expect(liveCount()).toBe(before);
    screen.remove();
    sweepLive();
    expect(liveCount()).toBe(before - 1);
  });

  it('a widget that changes value after leaving is released too, and never rendered again', () => {
    const el = document.createElement('span');
    document.body.append(el);
    const render = vi.fn();
    live(el, (s) => s.settings.sfxVolume, render);
    const n = liveCount();
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { sfxVolume: 0.31 } });
    el.remove();
    render.mockClear();
    store.dispatch({ type: 'UPDATE_SETTINGS', patch: { sfxVolume: 0.32 } });
    expect(render).not.toHaveBeenCalled();
    expect(liveCount()).toBe(n - 1);
  });
});

describe('saving problems are reported once, and their recovery', () => {
  it('reports a failing area once until it recovers', () => {
    const seen: string[] = [];
    const off = onStorageHealth((area, ok) => seen.push(`${area}:${ok}`));
    reportWrite('progress', false);
    reportWrite('progress', false);
    reportWrite('progress', false);
    expect(storageFailing('progress')).toBe(true);
    reportWrite('progress', true);
    reportWrite('progress', true);
    expect(seen).toEqual(['progress:false', 'progress:true']);
    off();
  });

  it('a refused localStorage write is reported, not thrown', () => {
    const seen: boolean[] = [];
    const off = onStorageHealth((_, ok) => seen.push(ok));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(local.set('x', { a: 1 })).toBe(false);
    spy.mockRestore();
    expect(local.set('x', { a: 1 })).toBe(true);
    expect(seen).toEqual([false, true]);
    off();
  });
});

describe('card faces wait for the opening', () => {
  it('publishes the back first, then the faces once the gate opens', async () => {
    const loaded: string[] = [];
    const am = new AssetManager({
      baseUrl: '/',
      supportsWebP: () => true,
      loadImage: async (url) => {
        loaded.push(url);
        return { width: 100, height: 140 };
      },
      fetchJson: async () => ({ frames: {} }),
    });
    let open!: () => void;
    am.deferFacesUntil(new Promise<void>((r) => (open = r)));
    const theme = {
      key: 'demo',
      mature: false,
      overrides: {},
      assets: {
        status: 'ready',
        basePath: 'assets/cards/demo/',
        faces: { type: 'atlas', image: { path: 'faces' }, grid: { columns: 13, rows: 4 } },
        back: { path: 'back' },
        preview: { path: 'preview' },
      },
    } as never;
    const done = am.loadDeck(theme);
    await vi.waitFor(() => expect(am.getDeckArt('demo')?.back).toBeTruthy());
    expect(loaded.some((u) => /faces/.test(u))).toBe(false);
    expect(am.getDeckArt('demo')!.faces).toBeNull();
    open();
    const art = await done;
    expect(loaded.some((u) => /faces/.test(u))).toBe(true);
    expect(art.faces).not.toBeNull();
    expect(art.back).not.toBeNull();
  });
});
