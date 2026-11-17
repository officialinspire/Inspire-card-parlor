import { expect, test } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, revealInPager, seed } from './helpers';

test('studio video starts after the gesture and Escape skips into the menu', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief', muted: true } });
  await page.goto('./');
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expect(page.locator('[data-studio-intro]')).toBeVisible();
  await expect(page.locator('video')).toHaveJSProperty('muted', true);
  await expect(page.locator('video')).toHaveAttribute('src', /inspiresoftwareintro\.mp4$/);
  await page.keyboard.press('Escape');
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator('video')).toHaveCount(0);
});

test('a missing intro does not prevent entering the game', async ({ page }) => {
  await page.route('**/inspiresoftwareintro.mp4', (route) => route.abort());
  await enterParlor(page);
  await expectScreen(page, 'MAIN_MENU');
});

test('Dante V2 purchase reveals the deck and persists after reload', async ({ page }) => {
  await seed(page, { profile: { credits: 600 } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await expect(page.locator(`${CURRENT} [data-deck="dante_v2"]`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Parlor Shop' }).click();
  await page.locator('[data-buy="dante_v2"]').click();
  await page.getByRole('button', { name: 'Buy', exact: true }).click();
  await expect(page.locator('[data-shop-balance]')).toContainText('100 credits');
  await expect(page.locator('[data-buy="dante_v2"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(await revealInPager(page, '[data-deck="dante_v2"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('icp:profile') ?? '{}').unlockedDecks))
    .toContain('dante_v2');
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await expect(await revealInPager(page, '[data-deck="dante_v2"]')).toBeVisible();
});
