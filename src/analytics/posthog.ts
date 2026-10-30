import { APP } from '@/core/config';

/**
 * Product analytics for the INSPIRE suite, sent to PostHog.
 *
 * Conventions: every event carries `suite: "inspire_card_parlor"`,
 * `brand: "INSPIRE"`, `game_version`, `source` and `referrer` (host only).
 * Event names are snake_case verbs (game_started, achievement_unlocked…).
 *
 * Privacy: an anonymous random id is the only identifier — no name, email,
 * save data or full URLs are sent, IP geolocation is disabled, and nothing
 * is sent when the player turns analytics off (Settings → Data) or the
 * browser asks not to be tracked. With no project key configured
 * (VITE_POSTHOG_KEY), nothing leaves the device at all.
 *
 * Reliability: events are batched; offline or failed batches wait in a small
 * local queue and are retried later. Analytics never throws into the game.
 */
export const SUITE = 'inspire_card_parlor';

export type ProductEvent =
  | 'game_opened'
  | 'game_started'
  | 'game_paused'
  | 'game_resumed'
  | 'game_completed'
  | 'game_over'
  | 'round_started'
  | 'round_completed'
  | 'achievement_unlocked'
  | 'high_score_achieved'
  | 'difficulty_selected'
  | 'pwa_installed'
  | 'audio_enabled'
  | 'error_encountered';

export interface EventProps {
  game?: string;
  mode?: 'quick_play' | 'story';
  difficulty?: string;
  score?: number;
  duration_seconds?: number;
  achievement?: string;
  outcome?: string;
  [key: string]: string | number | boolean | undefined;
}

const KEY = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim() || '';
const HOST = ((import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() || 'https://us.i.posthog.com').replace(
  /\/$/,
  '',
);
const QUEUE_KEY = 'icp:analytics-queue';
const ID_KEY = 'icp:analytics-id';
const MAX_QUEUE = 200;
const FLUSH_MS = 4000;

interface Captured {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

let enabled = false;
let queue: Captured[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/** For tests and the debug hook: the last events captured (sent or not). */
export const recentEvents: Captured[] = [];

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function anonymousId(): string {
  return safe(() => {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  }, 'anonymous');
}

/** Where the visit came from: an explicit ?source= / utm_source, the installed app, or direct. */
function source(): string {
  return safe(() => {
    const q = new URLSearchParams(location.search);
    const explicit = q.get('source') ?? q.get('utm_source');
    if (explicit) return explicit.slice(0, 40);
    if (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)
      return 'pwa';
    return 'web';
  }, 'web');
}

/** The referring site's host only (never a full URL). */
function referrer(): string {
  return safe(() => (document.referrer ? new URL(document.referrer).host : '$direct'), '$direct');
}

const doNotTrack = () =>
  safe(() => navigator.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1', false);

export const analyticsConfigured = () => KEY !== '';

/** Turns sending on or off (the player's setting). Turning it off also drops anything queued. */
export function setAnalyticsEnabled(on: boolean): void {
  enabled = on && !doNotTrack();
  if (!enabled) {
    queue = [];
    safe(() => localStorage.removeItem(QUEUE_KEY), undefined);
  }
}

/** Records a product event (and sends it, when configured, enabled and online). */
export function capture(event: ProductEvent, props: EventProps = {}): void {
  safe(() => {
    if (!enabled) return;
    const properties: Record<string, unknown> = {
      suite: SUITE,
      brand: 'INSPIRE',
      game_version: APP.version,
      source: source(),
      referrer: referrer(),
      distinct_id: anonymousId(),
      $process_person_profile: false,
      $geoip_disable: true,
    };
    for (const [k, v] of Object.entries(props)) if (v !== undefined) properties[k] = v;
    const item = { event, properties, timestamp: new Date().toISOString() };
    recentEvents.push(item);
    if (recentEvents.length > 200) recentEvents.shift();
    if (!KEY) return;
    queue.push(item);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    persist();
    schedule();
  }, undefined);
}

function persist(): void {
  safe(() => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)), undefined);
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushAnalytics();
  }, FLUSH_MS);
}

/** Sends queued events. Keeps them on failure (offline, blocked), to retry later. */
export async function flushAnalytics(opts: { beacon?: boolean } = {}): Promise<void> {
  if (!KEY || !enabled || !queue.length) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const batch = queue.slice(0, 50);
  const body = JSON.stringify({ api_key: KEY, batch });
  try {
    if (opts.beacon && navigator.sendBeacon?.(`${HOST}/batch/`, new Blob([body], { type: 'application/json' }))) {
      queue = queue.slice(batch.length);
    } else {
      const res = await fetch(`${HOST}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
      if (!res.ok) return;
      queue = queue.slice(batch.length);
    }
    persist();
    if (queue.length) schedule();
  } catch {
    /* offline or blocked: keep the queue */
  }
}

/** Restores anything left from an earlier visit and flushes at sensible moments. */
export function startAnalytics(on: boolean): void {
  setAnalyticsEnabled(on);
  if (!KEY) return;
  queue = safe(() => JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Captured[], []).slice(-MAX_QUEUE);
  if (enabled && queue.length) schedule();
  addEventListener('online', () => void flushAnalytics());
  addEventListener('pagehide', () => void flushAnalytics({ beacon: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flushAnalytics({ beacon: true });
  });
}
