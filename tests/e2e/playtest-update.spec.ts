import { expect, test, type Page } from '@playwright/test';
import { CURRENT, action, clickNav, enterParlor, expectScreen, playGame, seed, tableAction } from './helpers';

async function openFreeCell(page: Page) {
  await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'freecell');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT} .sol-card`)).toHaveCount(52);
}
async function readSave(page: Page, key = 'freecell/current') {
  return page.evaluate(
    (saveKey) =>
      new Promise<{ data: { hints?: number; moves: number; seed: number; storyLevel?: string }; piles: unknown[] }>(
        (resolve, reject) => {
          const req = indexedDB.open('inspire-card-parlor');
          req.onsuccess = () => {
            const db = req.result;
            const get = db.transaction('saves').objectStore('saves').get(saveKey);
            get.onsuccess = () => {
              resolve(get.result);
              db.close();
            };
            get.onerror = () => reject(get.error);
          };
          req.onerror = () => reject(req.error);
        },
      ),
    key,
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

for (const [levelId, gameId, boardId, options] of [
  ['th-7-1', 'klondike', 'kenmore_parlor', { draw: 3 }],
  ['th-7-5', 'spider', 'kenmore_parlor', { suits: 1 }],
  ['th-5-1', 'freecell', 'mrs_gray_safehouse', { puzzle: true }],
] as const) {
  test(`Story ${gameId}: New Game changes the deal and Restart repeats it`, async ({ page }) => {
    await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
    await enterParlor(page);
    const openChallenge = async () => {
      await page.evaluate((id) => {
        const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
        s.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
        s.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: id, chapterId: id.replace(/-\d$/, '') });
        s.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
      }, levelId);
      await expectScreen(page, 'GAMEPLAY');
    };
    const saved = () => readSave(page, `${gameId}/story`);
    const cards = page.locator(`${CURRENT} .sol-card`);
    const makeMove = async () => {
      if (gameId === 'freecell') {
        await cards.and(page.locator('[data-pile="tableau:0"][data-index="1"]')).click();
        await page.locator(`${CURRENT} .sol-slot[data-pile="cell:0"]`).click();
      } else {
        const stock = cards.and(page.locator('[data-pile="stock"]'));
        await stock.and(page.locator(`[data-index="${(await stock.count()) - 1}"]`)).click();
      }
      await expect.poll(async () => (await saved()).data.moves).toBe(1);
    };
    await openChallenge();
    await expect(cards.first()).toBeVisible();
    const original = await saved();

    if (gameId === 'klondike') {
      await makeMove();
      await tableAction(page, 'new-game');
      await action(page, 'false').click();
      await expect.poll(async () => (await saved()).data.moves).toBe(1);
    }
    await tableAction(page, 'new-game');
    if (gameId === 'klondike') await action(page, 'true').click();
    await expect.poll(async () => (await saved()).data.seed).not.toBe(original.data.seed);
    await expect(cards.first()).toBeVisible();
    const replacement = await saved();
    expect(replacement.data).toMatchObject({ storyLevel: levelId, moves: 0, ...options });
    expect(replacement.piles).not.toEqual(original.piles);
    await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', boardId);

    await makeMove();
    await tableAction(page, 'restart');
    await action(page, 'true').click();
    await expect.poll(async () => (await saved()).data.moves).toBe(0);
    await expect(cards.first()).toBeVisible();
    expect((await saved()).piles).toEqual(replacement.piles);
    expect((await saved()).data.seed).toBe(replacement.data.seed);

    await enterParlor(page);
    await openChallenge();
    await action(page, 'resume').click();
    await expect(cards.first()).toBeVisible();
    expect((await saved()).piles).toEqual(replacement.piles);

    await enterParlor(page);
    await openChallenge();
    await action(page, 'new').click();
    await expect.poll(async () => (await saved()).data.seed).not.toBe(replacement.data.seed);
    await expect(cards.first()).toBeVisible();
  });
}

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
