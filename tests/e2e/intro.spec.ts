import { devices, expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, seed } from './helpers';

/**
 * The opening sequence (Prompt 29): black → OFFICIAL INSPIRE presents → the
 * title with the shuffle and real loading → TOUCH TO START → fade to black →
 * the menu rises from black.
 */
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

const stage = (page: Page) => page.locator('.init').getAttribute('data-stage');
const start = (page: Page) => page.getByRole('button', { name: 'Enter Parlor' });
const icp = <T>(page: Page, fn: string) =>
  page.evaluate((fn) => {
    const w = window as unknown as {
      __ICP__: {
        store: { state: { profile: { journal: { counters: Record<string, number> } } } };
        analytics: { event: string }[];
      };
    };
    return fn === 'visits'
      ? (w.__ICP__.store.state.profile.journal.counters.visits ?? 0)
      : w.__ICP__.analytics.filter((e) => e.event === 'enter_parlor').length;
  }, fn) as Promise<T>;

test('a fresh launch: black, the studio, the title, then Touch to Start once loading is done', async ({ page }) => {
  await page.goto('./', { waitUntil: 'commit' });
  // The very first painted frame is black, before any app style arrives.
  // (The page's own <html> style, in place from the first byte; <body> may not exist yet.)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(0, 0, 0)');
  await expect(page.locator('.init')).toHaveAttribute('data-plan', 'full');
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /black|presents/);
  await expect(page.locator('.intro-presents')).toContainText('OFFICIAL INSPIRE');
  await expect(page.locator('.intro-presents')).toContainText('presents');
  await expect(page.locator('[data-action="skip-intro"]')).toBeVisible();
  await expect(page.locator('.init')).toHaveAttribute('data-stage', 'presents');
  // Touch to Start only after the title, and only when loading has really finished.
  await expect(start(page)).toBeHidden();
  await expect(start(page)).toBeVisible({ timeout: 8000 });
  expect(await stage(page)).toBe('ready');
  await expect(page.locator(`${CURRENT} .game-subtitle`)).toHaveText('The Thirteenth Hand');
  await expect(page.locator(`${CURRENT} .boot-bar`)).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('[data-action="skip-intro"]')).toBeHidden();
  // Large enough for a thumb.
  const box = (await start(page).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  expect(box.width).toBeGreaterThanOrEqual(240);
  // Start: the intro fades to black, then the menu rises out of black.
  // The veil can come and go quickly, so record that it appeared rather than racing it.
  await page.evaluate(() => {
    const w = window as unknown as { __veil?: boolean };
    new MutationObserver(() => {
      if (document.querySelector('.menu-veil')) w.__veil = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await start(page).click();
  await expectScreen(page, 'MAIN_MENU');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __veil?: boolean }).__veil)).toBe(true);
  await expect(page.locator(`${CURRENT} .menu-veil`)).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-booted'))).toBe(true);
});

test('skip with a tap, Escape or the Skip button; a skip never starts the game by itself', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /black|presents/);
  await page.mouse.click(20, 300);
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /title|ready/);
  await expect(start(page)).toBeVisible();
  await page.waitForTimeout(600);
  await expectScreen(page, 'INITIALIZATION');
  // A second visit in this tab is the brief opening: straight to the title.
  await page.reload();
  await expect(page.locator('.init')).toHaveAttribute('data-plan', 'brief');
  await expect(page.locator('[data-action="skip-intro"]')).toBeHidden();
  await expect(start(page)).toBeVisible();
});

test('returning launches open at the title; the setting can ask for the full intro every time', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('icp:intro-seen', '1'));
  await page.goto('./');
  await expect(page.locator('.init')).toHaveAttribute('data-plan', 'brief');
  await expect(start(page)).toBeVisible();
  await start(page).click();
  await expectScreen(page, 'MAIN_MENU');
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="display"]`).click();
  await page.locator(`${CURRENT} [data-setting="startupIntro"] button`, { hasText: 'Full' }).click();
  await page.reload();
  await expect(page.locator('.init')).toHaveAttribute('data-plan', 'full');
  await page.keyboard.press('Escape');
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /title|ready/);
});

test('slow loading: no start until the parlor is ready, and slow images never hold it shut', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief', musicPaused: true } });
  // The artwork list takes 2.5s; the riverfront painting and the logo take 6s.
  await page.route('**/assets/artwork.json', async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.continue();
  });
  await page.route(/assets\/(backgrounds\/menu|branding)\//, async (r) => {
    await new Promise((res) => setTimeout(res, 6000));
    await r.continue();
  });
  // Only wait for the document: the page's load event would itself wait for the slow images.
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.init')).toHaveAttribute('data-stage', 'title');
  await page.mouse.click(30, 300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  // Still on the title: no prompt, no menu (the test hooks only appear once loading is done).
  await expect(page.locator('.init')).toHaveAttribute('data-stage', 'title');
  await expect(page.locator('.menu')).toHaveCount(0);
  await expect(start(page)).toBeHidden();
  // The capped image waits release the doors well before the 6s images arrive.
  await expect(start(page)).toBeVisible({ timeout: 6000 });
  await start(page).click();
  await expectScreen(page, 'MAIN_MENU');
});

test('keyboard: Enter or Space starts once the prompt is up', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief' } });
  await page.goto('./');
  await expect(start(page)).toBeVisible();
  await expect(start(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expectScreen(page, 'MAIN_MENU');
});

test('rapid taps start once: one visit counted, one music voice', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief' } });
  await page.goto('./');
  await expect(start(page)).toBeVisible();
  const box = (await start(page).boundingBox())!;
  for (let i = 0; i < 5; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Enter');
  await expectScreen(page, 'MAIN_MENU');
  expect(await icp<number>(page, 'visits')).toBe(1);
  const voices = await page.evaluate(
    () => (window as unknown as { __ICP__: { audio(): { voices: number } } }).__ICP__.audio().voices,
  );
  expect(voices).toBeLessThanOrEqual(1);
});

test('muted: starting stays silent', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief', musicPaused: true, muted: true } });
  await page.goto('./');
  await start(page).click();
  await expectScreen(page, 'MAIN_MENU');
  const music = await page.evaluate(
    () => (window as unknown as { __ICP__: { audio(): { playing: boolean } } }).__ICP__.audio().playing,
  );
  expect(music).toBe(false);
});

test('reduced motion: the same stages as quick cuts, no shimmer or glow', async ({ page }) => {
  await seed(page, { settings: { reducedMotion: true, startupIntro: 'full' } });
  await page.goto('./');
  await expect(page.locator('.init')).toHaveClass(/calm/);
  await expect(start(page)).toBeVisible({ timeout: 4000 });
  const anim = await start(page).evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await start(page).click();
  await expectScreen(page, 'MAIN_MENU');
});

test('a hidden tab holds the intro where it is', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.init')).toHaveAttribute('data-stage', 'presents');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.init')).toHaveClass(/paused/);
  await page.waitForTimeout(3500);
  expect(await stage(page)).toBe('presents');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(start(page)).toBeVisible({ timeout: 6000 });
});

test('a phone like Safari on iPhone: tap to skip, tap to start', async ({ browser }) => {
  const { defaultBrowserType: _, ...iphone } = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...iphone, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto('./');
  await expect(page.locator('.init')).toHaveAttribute('data-stage', /black|presents/);
  await page.tap('.init', { position: { x: 40, y: 300 } });
  await expect(start(page)).toBeVisible();
  await start(page).tap();
  await expectScreen(page, 'MAIN_MENU');
  await ctx.close();
});

test('browser back steps back inside the parlor and never returns to the intro', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'SETTINGS');
  await page.goBack();
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator('.init')).toHaveCount(0);
  // A game: back steps out of the table (it may ask first), not back to the intro.
  await clickNav(page, 'STATISTICS');
  await page.goBack();
  await expectScreen(page, 'MAIN_MENU');
});
