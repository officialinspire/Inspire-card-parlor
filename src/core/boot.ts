import type { Store } from './store';
import { idb } from '@/storage/idb';
import { wait } from '@/utils/timing';
import { loadArtworkManifest } from '@/assets/artworkManifest';
import { assetManager, deckThemes } from '@/decks';
import { environmentImage } from '@/components/environment';
import { resolveTheme } from '@/themes/theme';

interface BootStep {
  label: string;
  run: () => Promise<unknown>;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

/** Waits for an image, but never longer than `cap` ms: a slow network must not hold the doors shut. */
const preloadCapped = (src: string, cap: number) => Promise.race([preloadImage(src), wait(cap)]);

/**
 * Runs the loading shown on the title screen. Every step is real work — no
 * step is padded to make the bar look busy; the opening sequence
 * (Initialization.ts) gives the shuffle its moment instead. Images are
 * warmed so the title and the menu's riverfront appear whole, but a slow
 * image only delays its own step by a capped amount.
 */
export async function runBoot(store: Store): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const steps: BootStep[] = [
    { label: 'Unlocking the parlor doors…', run: () => idb.ready() },
    {
      label: 'Unpacking the artwork…',
      run: () =>
        loadArtworkManifest().then((r) => {
          // Artwork may have changed: drop cached themes and any art resolved before it arrived.
          if (r?.applied.length) {
            deckThemes.invalidate();
            assetManager.clear();
          }
        }),
    },
    { label: 'Hanging the sign…', run: () => preloadCapped(`${base}assets/branding/logo.webp`, 2500) },
    {
      label: 'Lighting the riverfront…',
      run: () => preloadCapped(environmentImage(resolveTheme(store.state.settings.theme)), 3000),
    },
    { label: 'Shuffling the decks…', run: () => preloadCapped(`${base}assets/icons/icon.svg`, 1500) },
    {
      label: 'Tuning the piano…',
      run: () => Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(1500)]),
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    store.dispatch({ type: 'BOOT_PROGRESS', progress: i / steps.length, label: step.label });
    await step.run().catch(() => undefined);
  }
  store.dispatch({ type: 'BOOT_PROGRESS', progress: 1, label: 'The parlor is open.' });
  store.dispatch({ type: 'BOOT_READY' });
}
