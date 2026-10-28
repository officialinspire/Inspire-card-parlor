import { expect, test } from '@playwright/test';
import {
  CURRENT,
  clickNav,
  enterParlor,
  expectNoOverflow,
  expectScreen,
  playGame,
  revealInPager,
  seed,
  clickInPager,
} from './helpers';

const GAMES = ['klondike', 'spider', 'freecell', 'war', 'go-fish'];

test('lists all five games with thumbnail, description, difficulty, stats and a Play button', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  const seen = new Set<string>();
  for (let guard = 0; guard < 10 && seen.size < GAMES.length; guard++) {
    const cards = page.locator(`${CURRENT} .game-card`);
    for (const card of await cards.all()) {
      const id = (await card.getAttribute('data-game'))!;
      seen.add(id);
      await expect(card.locator('.ill-thumb')).toBeVisible();
      await expect(card.locator('.game-name')).not.toBeEmpty();
      await expect(card.locator('.difficulty')).toBeVisible();
      await expect(card.locator('.game-stats .stat-item')).toHaveCount(3);
      await expect(card.locator(`[data-play="${id}"]`)).toBeVisible();
    }
    await expectNoOverflow(page, `${CURRENT} .game-play, ${CURRENT} .pager-nav button`);
    const next = page.locator(`${CURRENT} [data-pager="next"]`);
    if ((await next.isVisible()) && (await next.isEnabled())) await next.click();
  }
  expect([...seen].sort()).toEqual([...GAMES].sort());
});

test('Play → deck → board → table; leaving keeps the game to resume', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'klondike');
  await expect(page.locator(`${CURRENT} .nav-steps li.current`)).toHaveText('Deck');
  await clickNav(page, 'BOARD_SELECTION');
  await expect(page.locator(`${CURRENT} .nav-steps li.current`)).toHaveText('Board');
  await clickNav(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT} .screen-title`)).toHaveText('Klondike');

  // Back returns to the board step; the game is saved, so there is nothing to confirm.
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  await expect(page.getByRole('dialog')).toContainText('Resume');
  await page.locator('[data-dialog-action="resume"]').click();

  // Home goes straight to the main menu.
  await page.locator(`${CURRENT} [data-nav="home"]`).click();
  await expectScreen(page, 'MAIN_MENU');
});

test('locked decks explain how to unlock them', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'spider');
  await clickInPager(page, '[data-deck="fredericksburg"]');
  await expect(page.locator('.toast')).toContainText('Reach level 3');
  await expect(await revealInPager(page, '[data-deck="classic"]')).toHaveAttribute('aria-pressed', 'true');
});

test('remembers deck and board per game across reloads', async ({ page }) => {
  await seed(page, { profile: { level: 6 } });
  await enterParlor(page);

  // Spider with Fredericksburg on Downtown Café.
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'spider');
  await clickInPager(page, '[data-deck="fredericksburg"]');
  await clickNav(page, 'BOARD_SELECTION');
  await clickInPager(page, '[data-board="downtown_cafe"]');
  await clickNav(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('Fredericksburg');
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Downtown Café');

  // Klondike with the classic deck on Woodland Clearing.
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'klondike');
  await clickInPager(page, '[data-deck="classic"]');
  await clickNav(page, 'BOARD_SELECTION');
  await clickInPager(page, '[data-board="woodland_clearing"]');
  await clickNav(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();

  await page.waitForTimeout(400); // let the debounced save land
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Woodland Clearing');

  // Quick Play opens on the last game played.
  await clickNav(page, 'GAME_SELECTION');
  await expect(page.locator(`${CURRENT} .game-card.last`)).toHaveAttribute('data-game', 'klondike');

  // Picking Spider again restores its own deck and board.
  await playGame(page, 'spider');
  await expect(page.locator(`${CURRENT} [data-deck="fredericksburg"]`)).toHaveAttribute('aria-pressed', 'true');
  await clickNav(page, 'BOARD_SELECTION');
  await expect(page.locator(`${CURRENT} [data-board="downtown_cafe"]`)).toHaveAttribute('aria-pressed', 'true');
});
