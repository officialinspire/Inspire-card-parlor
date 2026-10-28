import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, revealInPager, seed } from './helpers';

/* Runs only against the adult-content edition build (see playwright.config.ts). */

async function openContentSettings(page: Page) {
  await page.locator(`${CURRENT} .menu-grid [data-nav="SETTINGS"]`).click();
  await expectScreen(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="content"]`).click();
}

async function answerAgeGate(page: Page, yearsAgo: number, confirm = true) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Age check');
  await dialog.locator('[data-age-year]').selectOption(String(new Date().getFullYear() - yearsAgo));
  if (confirm) await dialog.locator('[data-age-confirm]').check();
  await page.locator('[data-dialog-action="ok"]').click();
}

test('the edition ships the isolated adult folder', async ({ request }) => {
  expect(await (await request.get('assets/cards/mature/yummyhole_after_dark/README.md')).text()).toContain(
    'artwork drop folder',
  );
});

test('adult decks stay off by default and refuse anyone who may be under age', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await expect(page.locator(`${CURRENT} [data-deck="yummyhole_after_dark"]`)).toHaveCount(0);
  await clickNav(page, 'home', 'MAIN_MENU');

  await openContentSettings(page);
  const toggle = page.locator(`${CURRENT} [data-setting="matureContent"]`);
  await expect(toggle.locator('input')).not.toBeChecked();
  await toggle.click();
  await answerAgeGate(page, 17);
  await expect(page.locator('.toast')).toContainText('only available to adults');
  await expect(toggle.locator('input')).not.toBeChecked();

  // Locked for the rest of the session: no second chance at the question.
  await toggle.click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(toggle.locator('input')).not.toBeChecked();
});

test('ticking the confirmation is required', async ({ page }) => {
  await enterParlor(page);
  await openContentSettings(page);
  await page.locator(`${CURRENT} [data-setting="matureContent"]`).click();
  await answerAgeGate(page, 30, false);
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"] input`)).not.toBeChecked();
});

test('adults can opt in; adult art never appears in ordinary previews; opting out resets', async ({ page }) => {
  await seed(page, { profile: { level: 10 } });
  await enterParlor(page);
  await openContentSettings(page);
  await page.locator(`${CURRENT} [data-setting="matureContent"]`).click();
  await answerAgeGate(page, 30);
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"] input`)).toBeChecked();

  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="COLLECTION"]`).click();
  const tile = await revealInPager(page, '[data-deck="yummyhole_after_dark"]');
  await expect(tile.locator('.card')).toHaveAttribute('data-cover', 'true');
  await expect(tile).toContainText('18+');
  await tile.locator('.tile-main').click();
  await expect(page.locator('[data-deck-detail="yummyhole_after_dark"] .card[data-cover]')).toHaveCount(0);
  await page.locator('[data-dialog-action="use"]').click();

  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-status="deck"] .card`)).toHaveAttribute('data-cover', 'true');

  await openContentSettings(page);
  await page.locator(`${CURRENT} [data-setting="matureContent"]`).click();
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('Classic');
});
