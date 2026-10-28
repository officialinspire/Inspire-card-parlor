import { SaveStore } from '@/engine';

/** Saved games for the table screens (IndexedDB). */
export const saves = new SaveStore();

/** End-to-end tests can pin the next deal with `window.__ICP_TEST_SEED__`. */
export function nextSeed(): number | undefined {
  const seed = (globalThis as { __ICP_TEST_SEED__?: number }).__ICP_TEST_SEED__;
  return typeof seed === 'number' ? seed : undefined;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
