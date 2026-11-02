import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, seed } from './helpers';

/**
 * The riverfront ambience (Prompt 30): its own bus under the music, day and
 * night scenes, full on the main menu, ducked on other menu screens, silent
 * in Story Mode and at the table, never stacked, nothing before Touch to
 * Start, and no network needed.
 */
test.describe.configure({ timeout: 120_000 });
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

interface AmbienceState {
  scene: 'day' | 'night' | null;
  instances: number;
  fading: number;
  level: number;
  bus: number;
  sources: number;
  timers: number;
  target: { scene: 'day' | 'night' | null; level: number };
}
const amb = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ICP__: { ambience(): AmbienceState } }).__ICP__.ambience());
const ctxState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ICP__: { audioContext(): string | null } }).__ICP__.audioContext());
const set = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate(
    (patch) =>
      (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
        type: 'UPDATE_SETTINGS',
        patch,
      }),
    patch,
  );
const go = (page: Page, to: string) =>
  page.evaluate(
    (to) =>
      (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
        type: 'NAVIGATE',
        to,
      }),
    to,
  );
/** Waits until only the live scene is left (fades finished). */
const settled = (page: Page, scene: 'day' | 'night' | null) =>
  expect
    .poll(async () => {
      const s = await amb(page);
      return `${s.scene} ${s.instances}`;
    })
    .toBe(scene ? `${scene} 1` : 'null 0');

const day = { settings: { theme: 'day', startupIntro: 'brief', musicPaused: true } };

test('nothing before Touch to Start; the day scene fades in with the menu', async ({ page }) => {
  await seed(page, { settings: { ...day.settings, startupIntro: 'full' } });
  await page.goto('./');
  // Skipping the intro is a gesture (sound may unlock), but the title stays silent.
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /black|presents/);
  await page.mouse.click(10, 200);
  const start = page.getByRole('button', { name: 'Enter Parlor' });
  await expect(start).toBeVisible();
  await page.waitForTimeout(800);
  expect((await amb(page)).instances).toBe(0);
  await start.click();
  await expectScreen(page, 'MAIN_MENU');
  await settled(page, 'day');
  const s = await amb(page);
  expect(s.sources).toBe(4); // river, babble, breeze, town
  await expect.poll(async () => (await amb(page)).level).toBeGreaterThan(0.95);
  expect(s.bus).toBeGreaterThan(0);
});

test('day and night crossfade once, smoothly, and leave one scene', async ({ page }) => {
  await seed(page, day);
  await enterParlor(page);
  await settled(page, 'day');
  await page.locator(`${CURRENT} [data-env-choice="night"]`).click();
  // During the crossfade both may sound; never more.
  const during = await amb(page);
  expect(during.instances).toBeLessThanOrEqual(2);
  expect(during.scene).toBe('night');
  await settled(page, 'night');
  expect((await amb(page)).sources).toBe(3);
  // The level (shared gain) moves smoothly: sample it while ducking and restoring.
  await clickNav(page, 'SETTINGS');
  const samples: number[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push((await amb(page)).level);
    await page.waitForTimeout(60);
  }
  for (let i = 1; i < samples.length; i++)
    expect(Math.abs(samples[i]! - samples[i - 1]!), `step ${i}: ${samples.join(', ')}`).toBeLessThan(0.3);
  expect(samples.at(-1)!).toBeLessThan(0.5);
});

test('mute, music-only and ambience-only', async ({ page }) => {
  await seed(page, day);
  await enterParlor(page);
  await settled(page, 'day');
  // Ambience volume rides its own bus.
  await set(page, { ambienceVolume: 1 });
  await expect.poll(async () => (await amb(page)).bus).toBeGreaterThan(0.2);
  // Music only: ambience off fades out and releases everything.
  await set(page, { ambience: false, musicPaused: false });
  await settled(page, null);
  expect((await amb(page)).timers).toBe(0);
  // Ambience only: the river comes back; the music stays as the player left it (paused).
  await set(page, { ambience: true, musicPaused: true });
  await settled(page, 'day');
  const music = await page.evaluate(
    () => (window as unknown as { __ICP__: { audio(): { playing: boolean } } }).__ICP__.audio().playing,
  );
  expect(music).toBe(false);
  // Mute all silences the master (the ambience keeps its place, silently).
  await set(page, { muted: true });
  await page.waitForTimeout(300);
  expect((await amb(page)).scene).toBe('day');
});

test('a game silences it; the menu brings it back; rapid navigation never stacks loops', async ({ page }) => {
  await seed(page, day);
  await enterParlor(page);
  await settled(page, 'day');
  await page.locator(`${CURRENT} [data-action="quick-play"]`).click();
  await expectScreen(page, 'GAMEPLAY');
  await settled(page, null);
  await go(page, 'MAIN_MENU');
  await settled(page, 'day');
  // Twenty fast round trips through menus and a table.
  for (let i = 0; i < 20; i++) {
    await go(page, i % 3 === 0 ? 'GAMEPLAY' : 'SETTINGS');
    await go(page, 'MAIN_MENU');
  }
  const mid = await amb(page);
  expect(mid.instances).toBeLessThanOrEqual(2);
  await settled(page, 'day');
  const s = await amb(page);
  expect(s.sources).toBe(4);
  expect(s.timers).toBeLessThanOrEqual(3);
});

test('a hidden tab suspends sound; showing it again resumes', async ({ page }) => {
  await seed(page, day);
  await enterParlor(page);
  await settled(page, 'day');
  expect(await ctxState(page)).toBe('running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => ctxState(page)).toBe('suspended');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => ctxState(page)).toBe('running');
  await settled(page, 'day');
});

test('offline: the procedural ambience needs no network, and no recording is fetched', async ({ page, context }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (/assets\/ambience\//.test(r.url())) requested.push(r.url());
  });
  await seed(page, day);
  await enterParlor(page);
  await settled(page, 'day');
  await context.setOffline(true);
  await page.locator(`${CURRENT} [data-env-choice="night"]`).click();
  await settled(page, 'night');
  await page.waitForTimeout(1500);
  expect(requested).toEqual([]);
  await context.setOffline(false);
});

test('mobile autoplay rules: no audio at all until a gesture; reduced motion and Low effects still the scene', async ({
  page,
}) => {
  await seed(page, { settings: { ...day.settings, lowEffects: true } });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Enter Parlor' })).toBeVisible();
  // Loaded and waiting, but nobody has touched the page: no audio context exists yet.
  expect(await ctxState(page)).toBeNull();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  expect(await ctxState(page)).toBe('running');
  // Low effects: the scene is still (no ambient layer), while the sound plays on.
  await expect(page.locator(`${CURRENT} .env`)).toHaveAttribute('data-motion', 'calm');
  await expect(page.locator(`${CURRENT} .env-ambient`)).toBeHidden();
  await settled(page, 'day');
});
