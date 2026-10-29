import { expect, test } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectNoOverflow, expectScreen } from './helpers';

const MENU = [
  ['GAME_SELECTION', 'Quick Play'],
  ['STORY_MODE', 'Story Mode'],
  ['COLLECTION', 'Deck Collection'],
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
    const entry = page.locator(`${CURRENT} :is(.menu-grid > *, .menu-play)[data-nav="${state}"]`);
    await expect(entry, label).toBeVisible();
    await expect(entry).toContainText(label);
  }
  await expect(page.locator(`${CURRENT} [data-status="level"]`)).toContainText('1');
  await expect(page.locator(`${CURRENT} .pill-credits`)).toContainText('250');
  // Collection progress: a whole percentage.
  await expect(page.locator(`${CURRENT} [data-status="collection"]`)).toHaveAttribute('data-value', /^\d{1,3}$/);
  // One logo, as an image with the title as its text alternative.
  await expect(page.locator(`${CURRENT} img.brand-logo`)).toHaveCount(1);
  await expect(page.locator(`${CURRENT} h1 img.brand-logo`)).toHaveAttribute('alt', 'INSPIRE Card Parlor');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('BlackJak Standard');
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Backroom Card Table');
  await expect(page.locator(`${CURRENT} [data-value="music"]`)).toHaveText('Lamplight Shuffle');
});

test('fits the viewport without scrolling', async ({ page }) => {
  await expectNoOverflow(page);
});

test('every menu entry opens its screen, and back/home return to the menu', async ({ page }) => {
  for (const [state] of MENU) {
    await page.locator(`${CURRENT} :is(.menu-grid > *, .menu-play)[data-nav="${state}"]`).click();
    await expectScreen(page, state);
    await expectNoOverflow(page, `${CURRENT} .nav-header button`);
    await clickNav(page, 'back', 'MAIN_MENU');

    await page.locator(`${CURRENT} :is(.menu-grid > *, .menu-play)[data-nav="${state}"]`).click();
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

test('portrait puts the painting above the menu; landscape puts it beside', async ({ page }) => {
  const stage = (await page.locator(`${CURRENT} .menu-stage`).boundingBox())!;
  const panel = (await page.locator(`${CURRENT} .menu-panel`).boundingBox())!;
  const vp = page.viewportSize()!;
  if (vp.width > vp.height) expect(stage.x).toBeGreaterThanOrEqual(panel.x + panel.width - 1);
  else expect(panel.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1);
  // The painting is drawn behind the menu and has loaded.
  await expect(page.locator(`${CURRENT} .env-scene.active`)).toHaveClass(/loaded/);
});

test('day and night scenes can be chosen from the menu', async ({ page }) => {
  const scene = page.locator(`${CURRENT} .env`);
  await page.locator(`${CURRENT} [data-env-choice="night"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(scene).toHaveAttribute('data-env', 'night');
  await expect(page.locator(`${CURRENT} [data-env-choice="night"]`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator(`${CURRENT} .env-night.active img.env-art`)).toHaveAttribute('src', /menu\/night\.webp$/);
  await expect(page.locator(`${CURRENT} .env-night`)).toHaveClass(/loaded/);

  await page.locator(`${CURRENT} [data-env-choice="day"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await expect(scene).toHaveAttribute('data-env', 'day');
  // The choice is remembered.
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expect(page.locator(`${CURRENT} [data-env-choice="day"]`)).toHaveAttribute('aria-checked', 'true');
});

test('no menu control is covered by another', async ({ page }) => {
  // Wait for the deal-in animation to settle.
  await page.waitForTimeout(800);
  const covered = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('.screen:not([aria-hidden]) :is(button, a)')];
    return controls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !hit || !(el === hit || el.contains(hit));
      })
      .map((el) => el.textContent?.trim() || el.getAttribute('aria-label') || el.className);
  });
  expect(covered).toEqual([]);
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
