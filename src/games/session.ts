import { SaveStore } from '@/engine';

const store = new SaveStore();
let slot = 'current';

/**
 * Saved games for the table screens (IndexedDB). Story challenges play in
 * their own slot, so a story game never overwrites (or deletes) the game in
 * progress in Quick Play.
 */
export const saves = {
  save: (table: Parameters<SaveStore['save']>[0]) => store.save(table, slot),
  load: (gameId: string) => store.load(gameId, slot),
  delete: (gameId: string) => store.delete(gameId, slot),
  has: (gameId: string) => store.has(gameId, slot),
};

/** Switches saving to the story slot (or back to Quick Play with null). */
export function useStorySlot(on: boolean): void {
  slot = on ? 'story' : 'current';
}

/** End-to-end tests can pin the next deal with `window.__ICP_TEST_SEED__`. */
export function nextSeed(): number | undefined {
  const seed = (globalThis as { __ICP_TEST_SEED__?: number }).__ICP_TEST_SEED__;
  return typeof seed === 'number' ? seed : undefined;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

/** The deck and board on the table right now (story challenges bring their own), for results and achievements. */
let table: { deckId: string; boardId: string } | null = null;
export const setTableInfo = (info: { deckId: string; boardId: string } | null) => {
  table = info;
};
export const tableInfo = () => table;
