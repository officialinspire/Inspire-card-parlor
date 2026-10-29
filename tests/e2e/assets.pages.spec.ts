import { expect, test, type Page } from '@playwright/test';
import { CURRENT, expectScreen, seed } from './helpers';

/**
 * The production build served from /Inspire-card-parlor/, as GitHub Pages
 * does. Walks the title screen, both menu scenes, the collection, gameboards
 * and a game table, and fails on any asset that does not load.
 */

test.describe.configure({ timeout: 120_000 });
test.use({ serviceWorkers: 'block' });

function watchFailures(page: Page): string[] {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && new URL(r.url()).host === new URL(page.url() || r.url()).host)
      failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('localhost')) failed.push(`failed ${r.url()}`);
  });
  return failed;
}

/** Every <img> on the page decoded to a real image. */
async function expectImagesLoaded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>('.screen:not([aria-hidden]) img')]
          .filter((i) => i.src && !i.complete === false && i.naturalWidth === 0)
          .map((i) => i.src),
      ),
    )
    .toEqual([]);
}

const go = (page: Page, to: string) =>
  page.evaluate((s) => {
    const store = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    store.dispatch({ type: 'NAVIGATE', to: s });
  }, to);

test('every asset loads from the GitHub Pages project path', async ({ page }) => {
  const failed = watchFailures(page);
  await seed(page, { profile: { level: 99, storyChapter: 99 }, settings: { theme: 'night' } });
  await page.goto('./');
  expect(new URL(page.url()).pathname).toBe('/Inspire-card-parlor/');

  // Title: logo and the softened riverfront.
  await expect(page.locator(`${CURRENT} .init-logo`)).toBeVisible();
  await expect(page.locator(`${CURRENT} .env-scene.active`)).toHaveClass(/loaded/);
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');

  // Both menu scenes.
  await expect(page.locator(`${CURRENT} .env-night`)).toHaveClass(/loaded/);
  await page.locator(`${CURRENT} [data-env-choice="day"]`).click();
  await expect(page.locator(`${CURRENT} .env-day`)).toHaveClass(/loaded/);
  await expectImagesLoaded(page);

  // Deck collection: previews and card art from the sprite sheets.
  await go(page, 'COLLECTION');
  await expectScreen(page, 'COLLECTION');
  await expect(page.locator(`${CURRENT} .card-back[data-art="image"]`).first()).toBeVisible();
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  await expect(page.locator(`${CURRENT} .gallery-cell .card[data-art="atlas"]`).first()).toBeVisible();

  // Gameboards: painted boards (CSS custom-property URLs are the easy ones to get wrong).
  await go(page, 'GAMEBOARDS');
  await expectScreen(page, 'GAMEBOARDS');
  await expectImagesLoaded(page);

  // A game table on the painted felt with an illustrated deck.
  await page.evaluate(() => {
    const store = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    store.dispatch({ type: 'SELECT_GAME', gameId: 'klondike' });
    store.dispatch({ type: 'SELECT_DECK', deckId: 'dantes_world' });
    store.dispatch({ type: 'SELECT_BOARD', boardId: 'backroom_card_table' });
    for (const to of ['MAIN_MENU', 'GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      store.dispatch({ type: 'NAVIGATE', to });
  });
  await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board-art', 'image');
  await expect(page.locator(`${CURRENT} .card-face[data-art="atlas"]`).first()).toBeVisible();
  const boardArt = await page
    .locator(`${CURRENT}.table`)
    .evaluate((t) => getComputedStyle(t).getPropertyValue('--board-art'));
  expect(boardArt).toContain('/Inspire-card-parlor/assets/backgrounds/backroom_card_table/background.webp');

  // App manifest icons resolve too.
  for (const icon of ['assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/branding/social-card.jpg']) {
    expect((await page.request.get(icon)).status(), icon).toBe(200);
  }
  expect(failed).toEqual([]);
});
