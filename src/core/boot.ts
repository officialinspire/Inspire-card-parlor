import type { Store } from './store';
import { idb } from '@/storage/idb';
import { wait } from '@/utils/timing';
import { DECKS } from '@/decks/registry';
import { BOARDS } from '@/boards/registry';
import { GAMES } from '@/games/registry';

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

/**
 * Runs the loading sequence shown on the initialization screen.
 * Steps are real work where it exists today (storage, fonts, icons) and
 * placeholders for asset packs that will arrive with gameplay.
 */
export async function runBoot(store: Store): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const steps: BootStep[] = [
    { label: 'Unlocking the parlor doors…', run: () => idb.ready() },
    { label: 'Polishing the tables…', run: () => Promise.all(BOARDS.map(() => wait(40))) },
    { label: 'Shuffling the decks…', run: () => Promise.all(DECKS.map(() => wait(60))) },
    { label: 'Setting out the games…', run: () => wait(GAMES.length * 40) },
    { label: 'Lighting the lamps…', run: () => preloadImage(`${base}assets/icons/icon.svg`) },
    {
      label: 'Tuning the piano…',
      run: () => Promise.race([document.fonts?.ready ?? Promise.resolve(), wait(1500)]),
    },
  ];

  const minDuration = store.state.settings.reducedMotion ? 300 : 1800;
  const started = performance.now();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    store.dispatch({ type: 'BOOT_PROGRESS', progress: i / steps.length, label: step.label });
    await step.run().catch(() => undefined);
    // Pace the steps so the shuffle animation gets its moment.
    const target = (minDuration * (i + 1)) / steps.length;
    const elapsed = performance.now() - started;
    if (elapsed < target) await wait(target - elapsed);
  }
  store.dispatch({ type: 'BOOT_READY' });
}
