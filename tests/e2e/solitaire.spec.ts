import { expect, test, type Locator, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, playGame, seed, tableAction } from './helpers';

test.describe.configure({ timeout: 90_000 });

async function open(page: Page, gameId: string, settings: Record<string, unknown> = {}, dealSeed = 7) {
  await page.addInitScript((s) => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = s;
  }, dealSeed);
  await seed(page, { settings: { reducedMotion: true, ...settings } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, gameId);
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  if (gameId !== 'freecell') await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT} .sol-board .sol-card`).first()).toBeVisible();
}

const moves = async (page: Page) =>
  Number((await page.locator(`${CURRENT} [data-hud="moves"]`).textContent())!.replace(/\D/g, ''));
const board = (page: Page) => page.locator(`${CURRENT} .sol-board`);

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20) };
}

async function drag(page: Page, from: Locator, to: Locator) {
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

/**
 * Ask for a hint and return its source (lowest hinted card) and target. The
 * target is resolved to a pile up front, because selecting the source clears
 * the hint highlights.
 */
async function hinted(page: Page) {
  await page.locator(`${CURRENT} [data-action="hint"]`).click();
  const sourceEl = page.locator(`${CURRENT} .sol-card[data-hint="source"]`).first();
  const hasMove = (await sourceEl.count()) > 0;
  const pile = hasMove
    ? await page.locator(`${CURRENT} .sol-slot[data-hint="target"]`).getAttribute('data-pile')
    : null;
  const cards = page.locator(`${CURRENT} .sol-card[data-pile="${pile}"]`);
  const target = (await cards.count()) ? cards.last() : page.locator(`${CURRENT} .sol-slot[data-pile="${pile}"]`);
  const key = hasMove ? await sourceEl.getAttribute('data-key') : null;
  const source = page.locator(`${CURRENT} .sol-card[data-key="${key}"]`);
  return { source, target, hasMove };
}

const GAMES = [
  ['klondike', 52],
  ['spider', 104],
  ['freecell', 52],
] as const;

for (const [gameId, total] of GAMES) {
  test.describe(gameId, () => {
    test('deals the full board without page scrolling or hidden-card leaks', async ({ page }) => {
      await open(page, gameId);
      await expect(page.locator(`${CURRENT} .sol-card`)).toHaveCount(total);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      // Face-down cards carry no identity in the page.
      expect(await page.locator('[data-card-id]').count()).toBe(0);
      expect(await page.locator(`${CURRENT} .sol-card.card-back[data-code]`).count()).toBe(0);
      // Every card fits on the board.
      const box = (await board(page).boundingBox())!;
      for (const c of await page.locator(`${CURRENT} .sol-card`).all()) {
        const r = (await c.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1);
        expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height + 1);
      }
    });

    test('tap-to-select follows a hint; undo reverses it', async ({ page }) => {
      await open(page, gameId);
      let h = await hinted(page);
      if (!h.hasMove && gameId !== 'freecell') {
        await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
        h = await hinted(page);
      }
      expect(h.hasMove).toBe(true);
      const before = await moves(page);
      await h.source.click();
      await expect(page.locator(`${CURRENT} .sol-card.selected`).first()).toBeVisible();
      await h.target.click({ force: true });
      await expect.poll(() => moves(page)).toBe(before + 1);
      await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);

      const undo = page.locator(`${CURRENT} [data-action="undo"]`);
      await expect(undo).toBeEnabled();
      // Keyboard: U undoes.
      await page.keyboard.press('u');
      await expect.poll(() => moves(page)).toBe(before + 2);
      if (before === 0) await expect(undo).toBeDisabled();
    });

    test('drag-and-drop moves cards; illegal drops are rejected', async ({ page }) => {
      await open(page, gameId);
      // Illegal: a non-Ace onto an empty foundation (Spider has no manual foundation moves at all).
      const top = page.locator(`${CURRENT} .sol-card.pickable.card-face:not([data-code^="A"])`).last();
      await drag(page, top, page.locator(`${CURRENT} .sol-slot[data-pile="foundation:0"]`));
      expect(await moves(page)).toBe(0);

      let h = await hinted(page);
      if (!h.hasMove) {
        await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
        h = await hinted(page);
      }
      const before = await moves(page);
      await drag(page, h.source, h.target);
      await expect.poll(() => moves(page)).toBe(before + 1);
    });

    test('pause hides the board; restart re-deals the same game; new game deals another', async ({ page }) => {
      await open(page, gameId);
      const firstCodes = await page
        .locator(`${CURRENT} .sol-card.card-face`)
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')).join());

      await page.locator(`${CURRENT} [data-action="pause"]`).click();
      await expect(page.locator(`${CURRENT} .sol-pause`)).toBeVisible();
      await expect(page.locator(`${CURRENT} .sol-card`).first()).toBeHidden();
      const t = await page.locator(`${CURRENT} [data-hud="time"]`).textContent();
      await page.waitForTimeout(1300);
      expect(await page.locator(`${CURRENT} [data-hud="time"]`).textContent()).toBe(t);
      await page.locator(`${CURRENT} [data-action="resume"]`).click();
      await expect(page.locator(`${CURRENT} .sol-pause`)).toBeHidden();

      // Make a move, then restart: same deal, back to zero moves (after confirming).
      const h = await hinted(page);
      if (h.hasMove) {
        await h.source.dblclick();
        if ((await moves(page)) === 0) {
          await h.source.click();
          await h.target.click({ force: true });
        }
      } else await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
      await expect.poll(() => moves(page)).toBeGreaterThan(0);
      await tableAction(page, 'restart');
      await page.locator('[data-dialog-action="true"]').click();
      await expect.poll(() => moves(page)).toBe(0);
      expect(
        await page
          .locator(`${CURRENT} .sol-card.card-face`)
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-code')).join()),
      ).toBe(firstCodes);

      await page.locator(`${CURRENT} [data-action="new-game"]`).click();
      await expect(page.locator(`${CURRENT} .sol-card`)).toHaveCount(total);
      expect(await moves(page)).toBe(0);
    });

    test('rules, settings and statistics dialogs', async ({ page }) => {
      await open(page, gameId);
      const dialog = page.getByRole('dialog');
      await tableAction(page, 'rules');
      await expect(dialog).toContainText('How to play');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await tableAction(page, 'game-stats');
      await expect(page.locator(`[data-stats="${gameId}"] .stat-item`)).toHaveCount(6);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.locator(`${CURRENT} [data-action="game-settings"]`).click();
      await expect(dialog).toContainText('settings');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });

    test('saves and resumes', async ({ page }) => {
      await open(page, gameId);
      const h = await hinted(page);
      if (h.hasMove) {
        await h.source.click();
        await h.target.click({ force: true });
      } else await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
      await expect.poll(() => moves(page)).toBe(1);
      const faces = await page.locator(`${CURRENT} .sol-card.card-face`).count();
      await page.waitForTimeout(250);
      await page.reload();
      await page.getByRole('button', { name: 'Enter Parlor' }).click();
      await expectScreen(page, 'MAIN_MENU');
      await clickNav(page, 'GAME_SELECTION');
      await playGame(page, gameId);
      await clickNav(page, 'BOARD_SELECTION');
      await clickNav(page, 'GAMEPLAY');
      await expect(page.getByRole('dialog')).toContainText('1 moves');
      await page.locator('[data-dialog-action="resume"]').click();
      await expect.poll(() => moves(page)).toBe(1);
      expect(await page.locator(`${CURRENT} .sol-card.card-face`).count()).toBe(faces);
    });
  });
}

test('Klondike: Draw 3 turns three cards; settings switch draw mode', async ({ page }) => {
  await open(page, 'klondike', { klondikeDraw: 3 });
  await expect(page.locator(`${CURRENT} [data-hud="extra"]`)).toHaveText('Draw 3');
  await expect(page.locator(`${CURRENT} [data-count="stock"]`)).toHaveText('24');
  await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
  await expect(page.locator(`${CURRENT} [data-count="stock"]`)).toHaveText('21');
  await expect(page.locator(`${CURRENT} .sol-card[data-pile="waste"]`)).toHaveCount(3);
  await page.keyboard.press('d');
  await expect(page.locator(`${CURRENT} .sol-card[data-pile="waste"]`)).toHaveCount(6);

  await page.locator(`${CURRENT} [data-action="game-settings"]`).click();
  await page.getByRole('radio', { name: 'Draw 1' }).click();
  await page.locator('[data-dialog-action="new"]').click();
  await page.locator('[data-dialog-action="true"]').click(); // abandon confirmation
  await expect(page.locator(`${CURRENT} [data-hud="extra"]`)).toHaveText('Draw 1');
  await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
  await expect(page.locator(`${CURRENT} .sol-card[data-pile="waste"]`)).toHaveCount(1);
});

test('Spider: deals ten cards from the stock', async ({ page }) => {
  await open(page, 'spider', { spiderSuits: 4 });
  await expect(page.locator(`${CURRENT} [data-count="stock"]`)).toHaveText('5 deals');
  const faces = await page.locator(`${CURRENT} .sol-card.card-face`).count();
  expect(faces).toBe(10);
  await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
  await expect(page.locator(`${CURRENT} .sol-card.card-face`)).toHaveCount(20);
  await expect(page.locator(`${CURRENT} [data-count="stock"]`)).toHaveText('4 deals');
  await expect(page.locator(`${CURRENT} [data-hud="score"]`)).toHaveText('Score 499');
});

test('FreeCell: double-tap sends a card to the best spot', async ({ page }) => {
  await open(page, 'freecell');
  const card = page.locator(`${CURRENT} .sol-card[data-pile="tableau:0"]`).last();
  await card.dblclick();
  await expect.poll(() => moves(page)).toBe(1);
});
