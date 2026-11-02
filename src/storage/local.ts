import { reportWrite } from './health';

const PREFIX = 'icp:';

/** Small, exception-safe LocalStorage wrapper for settings and profile data. */
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  /** Returns false (and reports it) when the device refuses the write. */
  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      reportWrite('progress', true);
      return true;
    } catch {
      // Storage full or blocked (private mode): progress stays in memory, and the player is told.
      reportWrite('progress', false);
      return false;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  clearAll(): void {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};
