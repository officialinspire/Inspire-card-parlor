/**
 * Minimal promise-based IndexedDB key/value store. Used for larger records
 * such as saved games, replays and the analytics event log.
 */
const DB_NAME = 'inspire-card-parlor';
const DB_VERSION = 1;
export const STORES = ['saves', 'events', 'cache'] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in globalThis)) return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => resolve(undefined);
  });
}

export const idb = {
  ready: () => open().then((db) => db !== null),
  get: <T>(store: StoreName, key: IDBValidKey) => run<T>(store, 'readonly', (s) => s.get(key)),
  set: (store: StoreName, key: IDBValidKey, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key)),
  delete: (store: StoreName, key: IDBValidKey) => run(store, 'readwrite', (s) => s.delete(key)),
  keys: (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
  clear: (store: StoreName) => run(store, 'readwrite', (s) => s.clear()),
};
