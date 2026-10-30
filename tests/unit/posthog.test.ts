import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('@/analytics/posthog');

async function load(key = 'phc_test_key'): Promise<Mod> {
  vi.resetModules();
  vi.stubEnv('VITE_POSTHOG_KEY', key);
  return import('@/analytics/posthog');
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sentBatch = () =>
  JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body)) as {
    api_key: string;
    batch: { event: string; properties: Record<string, unknown> }[];
  };

describe('PostHog analytics', () => {
  it('sends events with the suite conventions and no personal data', async () => {
    const a = await load();
    a.startAnalytics(true);
    a.capture('game_completed', {
      game: 'klondike',
      mode: 'quick_play',
      difficulty: 'draw-1',
      score: 900,
      duration_seconds: 210,
    });
    await a.flushAnalytics();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://us.i.posthog.com/batch/');
    const { api_key, batch } = sentBatch();
    expect(api_key).toBe('phc_test_key');
    expect(batch[0]!.event).toBe('game_completed');
    expect(batch[0]!.properties).toMatchObject({
      suite: 'inspire_card_parlor',
      brand: 'INSPIRE',
      game: 'klondike',
      mode: 'quick_play',
      difficulty: 'draw-1',
      score: 900,
      duration_seconds: 210,
      $geoip_disable: true,
    });
    expect(batch[0]!.properties.game_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(batch[0]!.properties).toHaveProperty('source');
    expect(batch[0]!.properties).toHaveProperty('referrer');
    // An anonymous random id is the only identifier.
    expect(String(batch[0]!.properties.distinct_id)).toMatch(/^[0-9a-f-]{20,}$/);
    for (const k of Object.keys(batch[0]!.properties)) expect(k).not.toMatch(/name|email|player|url/i);
  });

  it('keeps events while offline or when sending fails, and sends them later', async () => {
    const a = await load();
    a.startAnalytics(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    a.capture('game_started', { game: 'war' });
    await a.flushAnalytics();
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(a.flushAnalytics()).resolves.toBeUndefined();
    expect(JSON.parse(localStorage.getItem('icp:analytics-queue')!)).toHaveLength(1);
    await a.flushAnalytics();
    expect(sentBatch().batch.map((e) => e.event)).toEqual(['game_started']);
    expect(JSON.parse(localStorage.getItem('icp:analytics-queue')!)).toHaveLength(0);
  });

  it('sends nothing when the player opts out, or when no key is configured', async () => {
    const a = await load();
    a.startAnalytics(false);
    a.capture('game_started', { game: 'war' });
    await a.flushAnalytics();
    expect(fetchMock).not.toHaveBeenCalled();
    const none = await load('');
    expect(none.analyticsConfigured()).toBe(false);
    none.startAnalytics(true);
    none.capture('game_started', { game: 'war' });
    await none.flushAnalytics();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('icp:analytics-queue')).toBeNull();
  });

  it('never throws into the game, even when storage is unavailable', async () => {
    const a = await load();
    a.startAnalytics(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => a.capture('error_encountered', { error_kind: 'test' })).not.toThrow();
  });
});
