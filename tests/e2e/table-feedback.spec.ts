import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, playGame, seed } from './helpers';

/**
 * Table feedback (upgrade series). Each test reproduces a problem found by
 * hand before the fix:
 *  - a tap that closed the More panel also picked up the card under it;
 *  - tap-to-select gave no sign of where the cards could go, and a refused
 *    move only shook (no reason, nothing under reduced motion);
 *  - War's Auto button read "Pause" while running (the same as the toolbar's
 *    Pause), and hiding the page let Auto Play run on unseen;
 *  - Go Fish didn't say what it was waiting for, and CPU turns played on in
 *    a hidden page.
 */
test.describe.configure({ timeout: 120_000 });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

async function open(page: Page, gameId: string, settings: Record<string, unknown> = {}, dealSeed = 7) {
  await page.addInitScript((s) => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = s;
  }, dealSeed);
  await seed(page, { settings: { reducedMotion: true, musicPaused: true, ...settings } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, gameId);
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  // Solitaires (and some tables) open with a deal dialog.
  await page
    .locator('[data-dialog-action="deal"]')
    .click({ timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

/** Pretends the page went to the background (a tab switch, the phone locked). */
const hidePage = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

test('a tap that closes the More panel never picks up the card beneath it', async ({ page }) => {
  await open(page, 'klondike');
  await page.locator(`${CURRENT} [data-action="more"]`).click();
  await expect(page.locator('[data-more-panel]')).toBeVisible();
  const card = page.locator(`${CURRENT} .sol-card.pickable`).last();
  const b = (await card.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator('[data-more-panel]')).toBeHidden();
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);
  // The next tap is an ordinary tap again.
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).not.toHaveCount(0);
});

test('a selected card shows where it can go; a refused move says why, and undo is unchanged', async ({ page }) => {
  await open(page, 'klondike');
  // The hinted move: select its card by tapping, and its destination is marked.
  await page.locator(`${CURRENT} [data-action="hint"]`).click();
  const key = await page.locator(`${CURRENT} .sol-card[data-hint="source"]`).first().getAttribute('data-key');
  const source = page.locator(`${CURRENT} .sol-card[data-key="${key}"]`);
  const targetPile = await page.locator(`${CURRENT} .sol-slot[data-hint="target"]`).getAttribute('data-pile');
  await source.click();
  await expect(page.locator(`${CURRENT} .sol-card.selected`).first()).toBeVisible();
  await expect(page.locator(`${CURRENT} .sol-slot[data-pile="${targetPile}"]`)).toHaveAttribute('data-legal', '');
  // Let go (tap the card again), then drag it onto a column that isn't marked: refused, with the reason.
  const legal = await page
    .locator(`${CURRENT} .sol-slot[data-legal]`)
    .evaluateAll((s) => s.map((x) => x.getAttribute('data-pile')));
  const from = await source.getAttribute('data-pile');
  await page.waitForTimeout(450); // two taps within 350 ms would be a double tap (send it to its best spot)
  await source.click();
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);
  const moves = async () =>
    Number((await page.locator(`${CURRENT} [data-hud="moves"]`).textContent())!.replace(/\D/g, ''));
  const before = await moves();
  const illegal = await page
    .locator(`${CURRENT} .sol-slot[data-pile^="tableau"]`)
    .evaluateAll(
      (s, [legal, from]) =>
        s.map((x) => x.getAttribute('data-pile')).find((p) => p !== from && !(legal as string[]).includes(p!)),
      [legal, from] as const,
    );
  const target = page.locator(`${CURRENT} .sol-card[data-pile="${illegal}"]`).last();
  const a = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + Math.min(a.height / 2, 14));
  await page.mouse.down();
  for (let k = 1; k <= 10; k++)
    await page.mouse.move(
      a.x + a.width / 2 + ((t.x - a.x) * k) / 10,
      a.y + Math.min(a.height / 2, 14) + ((t.y - a.y) * k) / 10,
    );
  // While carrying, the legal landing spots are marked too.
  await expect(page.locator(`${CURRENT} .sol-slot[data-legal]`).first()).toBeAttached();
  await page.mouse.up();
  await expect(page.locator('.toast').last()).toContainText(/can’t|Only|Foundations/);
  await expect(page.locator(`${CURRENT} .sol-card.sol-refused`)).not.toHaveCount(0);
  expect(await moves()).toBe(before);
  // Legal marks go once nothing is held; the toolbar's Undo is still off (no move was made).
  await expect(page.locator(`${CURRENT} [data-legal]`)).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-action="undo"]`)).toBeDisabled();
});

test('War: Auto Play is named apart from Pause, shows on the field, and stops when the page is hidden', async ({
  page,
}) => {
  await open(page, 'war', { warSpeed: 'normal', reducedMotion: false });
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  await expect(page.locator(`${CURRENT} [data-action="auto"]`)).toHaveText('Stop auto');
  await expect(page.locator(`${CURRENT} [data-action="pause"]`)).toContainText('Pause');
  await expect(page.locator(`${CURRENT} [data-auto-badge]`)).toBeVisible();
  await hidePage(page);
  await expect(page.locator(`${CURRENT} [data-action="auto"]`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(`${CURRENT} [data-auto-badge]`)).toBeHidden();
  await expect(page.locator(`${CURRENT} [data-action="pause"]`)).toHaveAttribute('aria-pressed', 'true');
  const round = await page.locator(`${CURRENT} [data-hud="round"]`).textContent();
  await page.waitForTimeout(2500);
  // At most the round already under way finishes; no new round starts.
  const after = Number((await page.locator(`${CURRENT} [data-hud="round"]`).textContent())!.replace(/\D/g, ''));
  expect(after - Number(round!.replace(/\D/g, ''))).toBeLessThanOrEqual(1);
});

test('Go Fish says what it is waiting for, and holds CPU turns while the page is hidden', async ({ page }) => {
  await open(page, 'go-fish');
  const waiting = page.locator(`${CURRENT} [data-waiting]`);
  await expect(waiting).toHaveText('Your turn: pick a card');
  await page.locator(`${CURRENT} .gf-card`).first().click();
  await page.locator('[data-dialog-action="ask"]').click();
  // Either your ask is being answered, or a CPU is playing: the label says which.
  await expect(waiting).toHaveText(/Your ask is being answered|Waiting for .+…|Your turn: pick a card/);
  await hidePage(page);
  await expect(waiting).toHaveText('Paused');
  await expect(page.locator(`${CURRENT} [data-action="pause"]`)).toHaveAttribute('aria-pressed', 'true');
  const turn = await page.locator(`${CURRENT} [data-hud="turn"]`).textContent();
  await page.waitForTimeout(2000);
  await expect(page.locator(`${CURRENT} [data-hud="turn"]`)).toHaveText(turn!);
});
