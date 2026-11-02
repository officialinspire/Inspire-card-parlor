/**
 * Whether the device is keeping the player's progress. Writes report here;
 * the app tells the player once when saving starts failing (storage full,
 * blocked in a private window), and again only after it has recovered and
 * failed anew. Nothing here throws.
 */
export type StorageArea = 'progress' | 'games';
type Listener = (area: StorageArea, ok: boolean) => void;

const listeners = new Set<Listener>();
const failing = new Set<StorageArea>();

export function reportWrite(area: StorageArea, ok: boolean): void {
  const was = failing.has(area);
  if (ok) failing.delete(area);
  else failing.add(area);
  if (was !== !ok) for (const l of listeners) l(area, ok);
}

/** Called when an area starts failing (ok = false) or recovers (ok = true). */
export function onStorageHealth(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const storageFailing = (area?: StorageArea) => (area ? failing.has(area) : failing.size > 0);
