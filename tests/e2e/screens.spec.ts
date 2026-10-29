import { expect, test } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, seed, clickInPager } from './helpers';

test('collection: inspect a deck and equip it', async ({ page }) => {
  await seed(page, { profile: { level: 3 } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await clickInPager(page, '[data-deck="fredericksburg"]');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Fredericksburg');
  await page.locator('[data-dialog-action="use"]').click();
  await expect(page.locator('.toast')).toContainText('Fredericksburg');
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('Fredericksburg Heritage');
});

test('collection tabs: gallery and characters', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  await expect(page.locator(`${CURRENT} .gallery-cell .card-face`).first()).toBeVisible();
  await page.locator(`${CURRENT} [data-tab="characters"]`).click();
  await expect(page.locator(`${CURRENT} [data-character]`).first()).toBeVisible();
});

test('gameboards: equip an unlocked board, dialogs close with Escape', async ({ page }) => {
  await seed(page, { profile: { level: 2 } });
  await enterParlor(page);
  await clickNav(page, 'GAMEBOARDS');
  await clickInPager(page, '[data-board="backroom_card_table"]');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectScreen(page, 'GAMEBOARDS');

  await clickInPager(page, '[data-board="downtown_cafe"]');
  await page.locator('[data-dialog-action="use"]').click();
  await clickNav(page, 'back', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Downtown Café');
});

test('story: first chapter starts a game, later chapters are locked', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="chapter-2"]`).click();
  await expect(page.locator('.toast')).toContainText('Finish Chapter 1');
  await expectScreen(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="chapter-1"]`).click();
  await page.locator('[data-dialog-action="skip"]').click();
  await page.locator(`${CURRENT} [data-level="chapter-1-1"]`).click();
  await page.locator('[data-dialog-action="play"]').click();
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toContainText('Ch. 1 · Riverfront Warm-Up');
});

test('settings: every tab renders and the music track can be picked', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'SETTINGS');
  for (const tab of ['audio', 'music', 'display', 'gameplay', 'data']) {
    await page.locator(`${CURRENT} [data-tab="${tab}"]`).click();
    await expect(page.locator(`${CURRENT} .settings-panel`)).toBeVisible();
  }
  await page.locator(`${CURRENT} [data-tab="music"]`).click();
  await page.locator(`${CURRENT} [data-track="midnight-tea"]`).click();
  await expect(page.locator(`${CURRENT} [data-track="midnight-tea"]`)).toHaveAttribute('aria-checked', 'true');
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="music"]`)).toHaveText('Midnight Tea');
});

test('settings: lighting switches between day and night', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="display"]`).click();
  await page.getByRole('radio', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('radio', { name: 'Day' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
});

test('settings: reset asks for confirmation', async ({ page }) => {
  await seed(page, { profile: { credits: 999 } });
  await enterParlor(page);
  await expect(page.locator(`${CURRENT} .pill-credits`)).toContainText('999');
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="data"]`).click();

  await page.locator(`${CURRENT} [data-action="reset"]`).click();
  await page.locator('[data-dialog-action="false"]').click();
  await expectScreen(page, 'SETTINGS');

  await page.locator(`${CURRENT} [data-action="reset"]`).click();
  await page.locator('[data-dialog-action="true"]').click();
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator('.toast')).toContainText('swept clean');
  await expect(page.locator(`${CURRENT} .pill-credits`)).toContainText('250');
});

test('achievements and statistics tabs render', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'ACHIEVEMENTS');
  await expect(page.locator(`${CURRENT} .achievement-tile.earned`)).toHaveCount(1); // "Doors Open"
  await page.locator(`${CURRENT} [data-tab="games"]`).click();
  await expect(page.locator(`${CURRENT} .achievement-tile`).first()).toBeVisible();
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="STATISTICS"]`).click();
  await expectScreen(page, 'STATISTICS');
  await page.locator(`${CURRENT} [data-tab="war"]`).click();
  await expect(page.locator(`${CURRENT} .stat-grid .stat-item`)).toHaveCount(6);
});
