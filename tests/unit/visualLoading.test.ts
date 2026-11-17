import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from '@/assets/AssetManager';
import { DeckThemeManager } from '@/decks/DeckThemeManager';

describe('visual loading recovery', () => {
  it('deduplicates concurrent loads, then retries a transient image failure', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ width: 200, height: 280 });
    const assets = new AssetManager({ loadImage: loader, supportsWebP: () => true });
    const ref = { path: 'back', formats: ['webp'] as ['webp'] };
    const a = assets.loadImage('assets/cards/classic/', ref);
    expect(assets.loadImage('assets/cards/classic/', ref)).toBe(a);
    expect(await a).toBeNull();
    expect(await assets.loadImage('assets/cards/classic/', ref)).toMatchObject({ width: 200 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not mistake a published opening card back for a fully loaded deck', async () => {
    let release!: () => void;
    const assets = new AssetManager({
      loadImage: async () => ({ width: 1300, height: 560 }),
      fetchJson: async () => ({ frames: {} }),
      supportsWebP: () => true,
    });
    assets.deferFacesUntil(
      new Promise<void>((r) => {
        release = r;
      }),
    );
    const theme = new DeckThemeManager({
      matureAllowed: () => false,
      placeholderArt: () => false,
      variantFor: () => undefined,
    }).resolve('classic');
    const loading = assets.loadDeck(theme);
    await vi.waitFor(() => expect(assets.getDeckArt(theme.key)?.back).toBeTruthy());
    expect(assets.loadDeck(theme)).toBe(loading);
    release();
    expect((await loading).missing).toEqual([]);
  });
});
