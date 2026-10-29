import { expect, test } from '@playwright/test';
import { CURRENT, expectNoOverflow, expectScreen, seed } from './helpers';

test('the title screen loads to ENTER PARLOR with the logo, progress and version', async ({ page }) => {
  await page.goto('./');
  const logo = page.locator(`${CURRENT} h1 img.init-logo`);
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt', 'INSPIRE Card Parlor');
  await expect(page.locator(`${CURRENT} img.brand-logo`)).toHaveCount(1);
  await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await expect(page.locator(`${CURRENT} .init-version`)).toContainText(/Version \d+\.\d+\.\d+/);
  const enter = page.getByRole('button', { name: 'Enter Parlor' });
  await expect(enter).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`${CURRENT} .boot-bar`)).toHaveAttribute('aria-valuenow', '100');
  // The painted riverfront sits softly behind the title.
  await expect(page.locator(`${CURRENT} .env-splash .env-scene.active`)).toHaveClass(/loaded/);
  await expectNoOverflow(page);

  await enter.click();
  await expectScreen(page, 'MAIN_MENU');
});

test('reduced motion keeps the title and menu still', async ({ page }) => {
  await seed(page, { settings: { reducedMotion: true } });
  await page.goto('./');
  await expect(page.locator(`${CURRENT} .env`)).toHaveAttribute('data-motion', 'calm');
  const duration = await page
    .locator(`${CURRENT} .shuffle-card`)
    .first()
    .evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  // No ambient layer (stars, shimmer) and no parallax.
  await expect(page.locator(`${CURRENT} .env-ambient`)).toBeHidden();
  await expect(page.locator(`${CURRENT} .env`)).toHaveAttribute('data-motion', 'calm');
});
