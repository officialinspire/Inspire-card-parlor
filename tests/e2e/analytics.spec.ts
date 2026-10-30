import { expect, test, type Page } from '@playwright/test';
import { CURRENT, enterParlor, expectScreen, seed } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['desktop', 'phone-portrait'].includes(info.project.name), 'one desktop and one phone layout');
});

type Event = { event: string; properties: Record<string, unknown> };
const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ICP__: { analytics: Event[] } }).__ICP__.analytics);

test('a game of War reports its life cycle with the suite properties', async ({ page }) => {
  const posthog: string[] = [];
  page.on('request', (r) => r.url().includes('posthog') && posthog.push(r.url()));
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  await page.locator(`${CURRENT} [data-action="play-round"]`).click();
  await page.locator(`${CURRENT} [data-action="pause"]`).click();
  await page.locator(`${CURRENT} [data-action="resume"]`).click();
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  await expect(page.locator('.dialog-result')).toBeVisible({ timeout: 90_000 });

  const list = await events(page);
  const names = list.map((e) => e.event);
  for (const name of ['game_opened', 'game_started', 'round_started', 'round_completed', 'game_paused', 'game_resumed'])
    expect(names, name).toContain(name);
  expect(names.some((n) => n === 'game_completed' || n === 'game_over')).toBe(true);
  expect(names.indexOf('game_opened')).toBeLessThan(names.indexOf('game_started'));
  // Rounds are capped so a long game doesn't flood the stream.
  expect(names.filter((n) => n.startsWith('round_')).length).toBeLessThanOrEqual(40);
  const end = list.find((e) => e.event === 'game_completed' || e.event === 'game_over')!;
  expect(end.properties).toMatchObject({
    suite: 'inspire_card_parlor',
    brand: 'INSPIRE',
    game: 'war',
    mode: 'quick_play',
    difficulty: 'standard',
  });
  expect(end.properties.duration_seconds).toBeGreaterThanOrEqual(0);
  expect(end.properties.game_version).toMatch(/^\d+\.\d+\.\d+$/);
  // The test build has no PostHog key: nothing leaves the device.
  expect(posthog).toEqual([]);
});

test('difficulty choices, audio and opting out', async ({ page }) => {
  await enterParlor(page);
  const dispatch = (a: unknown) =>
    page.evaluate(
      (x) => (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch(x),
      a,
    );
  await dispatch({ type: 'UPDATE_SETTINGS', patch: { spiderSuits: 4 } });
  let list = await events(page);
  expect(list.find((e) => e.event === 'difficulty_selected')?.properties).toMatchObject({
    game: 'spider',
    difficulty: '4-suit',
  });
  expect(list.map((e) => e.event)).toContain('audio_enabled');
  const before = list.length;
  await dispatch({ type: 'UPDATE_SETTINGS', patch: { analyticsEnabled: false } });
  await dispatch({ type: 'UPDATE_SETTINGS', patch: { spiderSuits: 2 } });
  list = await events(page);
  expect(list.length).toBe(before);
});
