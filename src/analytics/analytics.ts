import type { Store } from '@/core/store';
import { idb } from '@/storage/idb';

export interface AnalyticsEvent {
  name: string;
  at: number;
  data?: Record<string, unknown>;
}

/**
 * Privacy-first, on-device analytics. Events are kept locally in IndexedDB
 * (capped) to power the Statistics screen and future balancing. Nothing is
 * transmitted off the device.
 */
const MAX_BUFFER = 50;
const SESSION_KEY = `session-${Date.now()}`;
let enabled = true;
let buffer: AnalyticsEvent[] = [];

export function track(name: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  buffer.push({ name, at: Date.now(), ...(data ? { data } : {}) });
  if (buffer.length >= MAX_BUFFER) void flush();
  if (import.meta.env.DEV) console.debug('[analytics]', name, data ?? '');
}

export async function flush(): Promise<void> {
  if (!buffer.length) return;
  const existing = (await idb.get<AnalyticsEvent[]>('events', SESSION_KEY)) ?? [];
  const merged = existing.concat(buffer).slice(-500);
  buffer = [];
  await idb.set('events', SESSION_KEY, merged);
}

export function attachAnalytics(store: Store): void {
  enabled = store.state.settings.analyticsEnabled;
  store.select(
    (s) => s.settings.analyticsEnabled,
    (v) => {
      enabled = v;
      if (!v) buffer = [];
    },
  );
  store.select(
    (s) => s.screen,
    (screen, from) => track('screen_view', { screen, from }),
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flush();
  });
}
