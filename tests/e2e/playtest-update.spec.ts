import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, playGame, seed, tableAction } from './helpers';

async function openFreeCell(page: Page) {
  await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'freecell');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT} .sol-card`)).toHaveCount(52);
}
async function readSave(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ data: { hints?: number; moves: number; seed: number }; piles: unknown[] }>((resolve, reject) => {
        const req = indexedDB.open('inspire-card-parlor');
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('saves').objectStore('saves').get('freecell/current');
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

test('three hints survive reload; restart and new game persist the replacement hand', async ({ page }) => {
  await openFreeCell(page);
  const original = await readSave(page);
  const hint = page.locator(`${CURRENT} [data-action="hint"]`);
  for (let i = 0; i < 3; i++) await hint.click();
  await expect(hint).toBeDisabled();
  await expect.poll(async () => (await readSave(page)).data.hints).toBe(3);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'freecell');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="resume"]').click();
  await expect(hint).toBeDisabled();
  await tableAction(page, 'restart');
  await expect(hint).toBeEnabled();
  await expect.poll(async () => (await readSave(page)).data.hints ?? 0).toBe(0);
  expect((await readSave(page)).piles).toEqual(original.piles);
  await tableAction(page, 'new-game');
  await expect.poll(async () => (await readSave(page)).data.seed).not.toBe(original.data.seed);
  await expect(page.locator(`${CURRENT} [data-card-preview]`)).toContainText('Select a card');
});

test('save files download and import with confirmation; invalid files keep progress', async ({ page }) => {
  await openFreeCell(page);
  await tableAction(page, 'hint');
  await tableAction(page, 'home');
  await expectScreen(page, 'MAIN_MENU');
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="data"]`).click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-action="export-save"]').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^inspire-card-parlor-.*\.json$/);
  const path = (await download.path())!;
  const original = await readSave(page);
  await page.locator('[data-save-file]').setInputFiles(path);
  await expect(page.getByRole('heading', { name: 'Load this save file?' })).toBeVisible();
  await page.locator('[data-dialog-action="true"]').click();
  await expect(page.locator('.toast', { hasText: 'Save loaded.' })).toBeVisible();
  expect((await readSave(page)).piles).toEqual(original.piles);
  expect((await readSave(page)).data.hints).toBe(1);
  await page
    .locator('[data-save-file]')
    .setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await expect(page.locator('.toast', { hasText: 'not a supported' })).toBeVisible();
  expect((await readSave(page)).piles).toEqual(original.piles);
});
