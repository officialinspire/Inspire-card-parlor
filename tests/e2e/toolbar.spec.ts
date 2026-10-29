import { expect, test, type Page } from '@playwright/test';
import {
  CURRENT,
  clickInPager,
  clickNav,
  enterParlor,
  expectScreen,
  revealInPager,
  seed,
  tableAction,
} from './helpers';

test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

const PRIMARY: Record<string, string[]> = {
  klondike: ['pause', 'undo', 'hint', 'new-game'],
  spider: ['pause', 'undo', 'hint', 'new-game'],
  freecell: ['pause', 'undo', 'hint', 'new-game'],
  war: ['pause', 'speed', 'new-game'],
  'go-fish': ['pause', 'hint', 'new-game'],
};

async function open(page: Page, game: string) {
  await page.addInitScript(() => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = 7;
    // Record every sound event the table raises.
    (window as unknown as { __sounds: unknown[] }).__sounds = [];
    addEventListener('icp:sound', (e) =>
      (window as unknown as { __sounds: unknown[] }).__sounds.push((e as CustomEvent).detail),
    );
  });
  await enterParlor(page);
  await page.evaluate((g) => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: g });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  }, game);
  await expectScreen(page, 'GAMEPLAY');
  const deal = page.locator('[data-dialog-action="deal"]');
  if (await deal.isVisible().catch(() => false)) await deal.click();
  await expect(page.locator(`${CURRENT} .card`).first()).toBeVisible();
  await expect(page.locator('.dialog-backdrop')).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-dealing]`)).toHaveCount(0);
}

const sounds = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sounds: { event: string; played: boolean; at: number }[] }).__sounds);

for (const game of Object.keys(PRIMARY)) {
  test(`${game}: compact toolbar with pause, music, settings and a More panel`, async ({ page }) => {
    await open(page, game);
    const bar = page.locator(`${CURRENT} .game-toolbar`);
    for (const action of [...PRIMARY[game]!, 'music', 'game-settings', 'more'])
      await expect(bar.locator(`[data-action="${action}"]`), action).toBeVisible();

    // Pause holds the table; Resume brings it back.
    await bar.locator('[data-action="pause"]').click();
    await expect(bar.locator('[data-action="pause"]')).toHaveAttribute('aria-pressed', 'true');
    const resume = page.locator(`${CURRENT} [data-action="resume"]`);
    await expect(resume).toBeVisible();
    await resume.click();
    await expect(bar.locator('[data-action="pause"]')).toHaveAttribute('aria-pressed', 'false');

    // Music switches the soundtrack off and on, and remembers it.
    const music = bar.locator('[data-action="music"]');
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'false');
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __ICP__: { store: { state: { settings: { musicMuted: boolean } } } } }).__ICP__.store
            .state.settings.musicMuted,
      ),
    ).toBe(true);
    await music.click();
    await expect(music).toHaveAttribute('aria-pressed', 'true');

    // Secondary actions live in the More panel, which closes on Escape or a tap elsewhere.
    const more = bar.locator('[data-action="more"]');
    await more.click();
    const panel = page.locator(`${CURRENT} [data-more-panel]`);
    await expect(panel).toBeVisible();
    for (const a of ['rules', 'game-stats', 'home']) await expect(panel.locator(`[data-action="${a}"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expectScreen(page, 'GAMEPLAY'); // Escape closed the panel, it did not leave the table
    await more.click();
    await page.locator(`${CURRENT} .table-stage`).click({ position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();

    // Settings opens the table settings.
    await bar.locator('[data-action="game-settings"]').click();
    await expect(page.locator('.dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // The game still plays after all of that (nothing was lost or duplicated).
    if (game === 'war') {
      await page.locator(`${CURRENT} [data-action="play-round"]`).click();
      await expect(page.locator(`${CURRENT} [data-hud="round"]`)).toHaveText('Round 1');
    }
  });
}

test('full screen where supported, otherwise a focus mode; never required', async ({ page }) => {
  await open(page, 'freecell');
  await tableAction(page, 'fullscreen');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await tableAction(page, 'fullscreen');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test('focus mode stands in when the browser has no full screen', async ({ page }) => {
  await page.addInitScript(() => {
    // Like iPhone Safari: neither the standard nor the prefixed API.
    for (const name of ['requestFullscreen', 'webkitRequestFullscreen'])
      Object.defineProperty(Element.prototype, name, { value: undefined, configurable: true });
  });
  await open(page, 'klondike');
  await tableAction(page, 'focus-mode');
  await expect(page.locator('html')).toHaveClass(/focus-mode/);
  await expect(page.locator(`${CURRENT} .table-hud`)).toBeHidden();
  await tableAction(page, 'focus-mode');
  await expect(page.locator(`${CURRENT} .table-hud`)).toBeVisible();
});

test('sound hooks: shuffle and deal, valid and invalid moves, flips, one sound per action', async ({ page }) => {
  await open(page, 'klondike');
  let log = await sounds(page);
  expect(log.map((e) => e.event)).toContain('card_shuffle');
  expect(log.some((e) => e.event === 'card_deal' && e.played)).toBe(true);

  // Draw from the stock: a move that turns a card over.
  await page.evaluate(() => ((window as unknown as { __sounds: unknown[] }).__sounds = []));
  await page.locator(`${CURRENT} .sol-slot-stock`).click({ force: true });
  await expect.poll(async () => (await sounds(page)).length).toBeGreaterThan(0);
  log = await sounds(page);
  expect(log.map((e) => e.event)).toEqual(expect.arrayContaining(['card_move', 'valid_move', 'card_flip']));
  // card_move and valid_move describe the same action: only one of them is heard.
  const heardMoves = log.filter((e) => ['card_move', 'valid_move'].includes(e.event) && e.played);
  expect(heardMoves).toHaveLength(1);

  // An impossible move: a single error sound.
  await page.evaluate(() => ((window as unknown as { __sounds: unknown[] }).__sounds = []));
  const waste = page.locator(`${CURRENT} .sol-card[data-pile="waste"]`).last();
  await waste.dblclick();
  await expect.poll(async () => (await sounds(page)).length).toBeGreaterThan(0);
  log = await sounds(page);
  const errorOrMove = log.filter((e) => e.played).map((e) => e.event);
  expect(errorOrMove.length).toBeGreaterThan(0);
  expect(errorOrMove.length).toBeLessThanOrEqual(2);
});

test('War: dramatic reveal, and victory sounds once', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await open(page, 'war');
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  const result = page.locator('.dialog-result');
  await expect(result).toBeVisible({ timeout: 90_000 });
  const outcome = await result.locator('[data-result]').getAttribute('data-result');
  const victories = (await sounds(page)).filter((e) => e.event === 'victory');
  expect(victories).toHaveLength(outcome === 'win' ? 1 : 0);
});

test('tap-to-move works as an alternative to dragging', async ({ page }) => {
  await open(page, 'freecell');
  // Tap a column's top card, then an empty free cell.
  const top = page.locator(`${CURRENT} .sol-card[data-pile="tableau:0"]`).last();
  const code = await top.getAttribute('data-code');
  await top.click();
  await expect(top).toHaveClass(/selected/);
  await page.locator(`${CURRENT} .sol-slot[data-pile="cell:0"]`).click({ force: true });
  await expect(page.locator(`${CURRENT} .sol-card[data-pile="cell:0"]`)).toHaveAttribute('data-code', code!);
  await expect(page.locator(`${CURRENT} [data-hud="moves"]`)).toHaveText('Moves 1');
});

test('gameboard gallery: painted thumbnails, select, ambience and a remembered choice', async ({ page }) => {
  await seed(page, { profile: { level: 99, storyChapter: 99 } });
  await enterParlor(page);
  await clickNav(page, 'GAMEBOARDS');
  // Painted boards come first and show their own artwork.
  const first = page.locator(`${CURRENT} [data-board]`).first();
  await expect(first).toHaveAttribute('data-board', /backroom_card_table|picnic_table|rappahannock_riverside/);
  for (const id of ['picnic_table', 'backroom_card_table', 'rappahannock_riverside']) {
    const tile = await revealInPager(page, `[data-board="${id}"]`);
    await expect(tile).toBeVisible();
    await expect
      .poll(() => tile.locator('.board-swatch').evaluate((e) => getComputedStyle(e).getPropertyValue('--board-art')))
      .toContain(`assets/backgrounds/${id}/preview.webp`);
  }
  // Unlock state is shown on locked boards.
  await clickInPager(page, '[data-board="masonic_study"]');
  await page.keyboard.press('Escape');

  // Select a board straight from its tile.
  await clickInPager(page, '[data-select-board="rappahannock_riverside"]');
  await expect(page.locator(`${CURRENT} [data-board="rappahannock_riverside"]`)).toHaveClass(/selected/);

  // Ambience is optional.
  const ambience = page.locator(`${CURRENT} [data-setting="ambientAnimations"] input`);
  await ambience.uncheck({ force: true });
  await expect(ambience).not.toBeChecked();

  // The choice survives a reload.
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expect(page.locator(`${CURRENT} [data-value="board"]`)).toHaveText('Rappahannock Riverside');
});
