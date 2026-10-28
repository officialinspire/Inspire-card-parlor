import { expect, test } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectNoOverflow, expectScreen } from './helpers';

const MENU = [
  ['GAME_SELECTION', 'Quick Play'],
  ['STORY_MODE', 'Story Mode'],
  ['COLLECTION', 'Card Collection'],
  ['GAMEBOARDS', 'Gameboards'],
  ['ACHIEVEMENTS', 'Achievements'],
  ['STATISTICS', 'Statistics'],
  ['SETTINGS', 'Settings'],
] as const;

test.beforeEach(async ({ page }) => {
  await enterParlor(page);
});

test('shows every menu entry and the player status', async ({ page }) => {
  for (const [state, label] of MENU) {
    const entry = page.locator(`${CURRENT} :is(.menu-grid, .menu-hero) [data-nav="${state}"]`);
    await expect(entry, label).toBeVisible();
    await expect(entry).toContainText(label);
  }
  await expect(page.locator(`${CURRENT} [data-status="level"]`)).toContainText('1');
  await expect(page.locator(`${CURRENT} .pill-credits`)).toContainText('250');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('INSPIRE Classic');
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Velvet Green');
  await expect(page.locator(`${CURRENT} [data-value="music"]`)).toHaveText('Lamplight Shuffle');
});

test('fits the viewport without scrolling', async ({ page }) => {
  await expectNoOverflow(page);
});

test('every menu entry opens its screen, and back/home return to the menu', async ({ page }) => {
  for (const [state] of MENU) {
    await page.locator(`${CURRENT} :is(.menu-grid, .menu-hero) [data-nav="${state}"]`).click();
    await expectScreen(page, state);
    await expectNoOverflow(page, `${CURRENT} .nav-header button`);
    await clickNav(page, 'back', 'MAIN_MENU');

    await page.locator(`${CURRENT} :is(.menu-grid, .menu-hero) [data-nav="${state}"]`).click();
    await expectScreen(page, state);
    await clickNav(page, 'home', 'MAIN_MENU');
  }
});

test('status chips open the collection and gameboards', async ({ page }) => {
  await page.locator(`${CURRENT} [data-status="deck"]`).click();
  await expectScreen(page, 'COLLECTION');
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} [data-status="board"]`).click();
  await expectScreen(page, 'GAMEBOARDS');
  await clickNav(page, 'back', 'MAIN_MENU');
  await page.locator(`${CURRENT} [data-status="level"]`).click();
  await expectScreen(page, 'STATISTICS');
});

test('the next-track button changes the music shown', async ({ page }) => {
  const label = page.locator(`${CURRENT} [data-value="music"]`);
  await page.locator(`${CURRENT} [data-action="next-track"]`).click();
  await expect(label).toHaveText('Rain on the Window');
  await page.locator(`${CURRENT} [data-action="next-track"]`).click();
  await expect(label).toHaveText('Corner Café');
});

test('Escape goes back from inner screens', async ({ page }) => {
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} .screen-title`).focus();
  await page.keyboard.press('Escape');
  await expectScreen(page, 'MAIN_MENU');
});

test('portrait stacks the hero above the menu; landscape puts them side by side', async ({ page }) => {
  const hero = await page.locator(`${CURRENT} .menu-hero`).boundingBox();
  const grid = await page.locator(`${CURRENT} .menu-grid`).boundingBox();
  const vp = page.viewportSize()!;
  if (vp.width > vp.height) {
    expect(grid!.x).toBeGreaterThan(hero!.x + hero!.width - 1);
    expect(Math.abs(grid!.y - hero!.y)).toBeLessThan(4);
  } else {
    expect(grid!.y).toBeGreaterThan(hero!.y + hero!.height - 1);
  }
});

test('fullscreen can be toggled', async ({ page }) => {
  const btn = page.locator(`${CURRENT} [data-action="fullscreen"]`);
  await expect(btn).toBeVisible();
  await btn.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
});
