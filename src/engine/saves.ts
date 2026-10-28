import { idb } from '@/storage/idb';
import { Table, validateSnapshot, type TableSnapshot } from './Table';

export interface SaveBackend {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  keys(): Promise<string[]>;
}

/** IndexedDB-backed saves (the "saves" object store). */
export const idbSaveBackend: SaveBackend = {
  get: (key) => idb.get('saves', key),
  set: (key, value) => idb.set('saves', key, value),
  delete: (key) => idb.delete('saves', key),
  keys: async () => ((await idb.keys('saves')) ?? []).map(String),
};

/** In-memory saves for tests and private-mode fallbacks. */
export function memorySaveBackend(): SaveBackend {
  const map = new Map<string, unknown>();
  return {
    get: async (key) => structuredClone(map.get(key)) as never,
    set: async (key, value) => map.set(key, structuredClone(value)),
    delete: async (key) => map.delete(key),
    keys: async () => [...map.keys()],
  };
}

/** Save slots per game, e.g. "klondike/current". */
export class SaveStore {
  constructor(private backend: SaveBackend = idbSaveBackend) {}

  static key(gameId: string, slot = 'current') {
    return `${gameId}/${slot}`;
  }

  async save(table: Table, slot = 'current'): Promise<TableSnapshot> {
    const snap = table.snapshot();
    await this.backend.set(SaveStore.key(table.gameId, slot), snap);
    return snap;
  }

  /** Restores a saved table, or null if there is none or it fails validation. */
  async load(gameId: string, slot = 'current'): Promise<Table | null> {
    const snap = await this.backend.get<TableSnapshot>(SaveStore.key(gameId, slot));
    if (!snap) return null;
    try {
      validateSnapshot(snap);
      return Table.restore(snap);
    } catch (err) {
      console.warn(`[saves] discarding invalid save ${gameId}/${slot}:`, err);
      return null;
    }
  }

  async has(gameId: string, slot = 'current'): Promise<boolean> {
    return (await this.backend.get(SaveStore.key(gameId, slot))) !== undefined;
  }

  async delete(gameId: string, slot = 'current'): Promise<void> {
    await this.backend.delete(SaveStore.key(gameId, slot));
  }

  async list(gameId?: string): Promise<string[]> {
    const keys = await this.backend.keys();
    return gameId ? keys.filter((k) => k.startsWith(`${gameId}/`)) : keys;
  }
}
