import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, playGame, seed, tableAction } from './helpers';

test.describe.configure({ timeout: 120_000 });

/** Pin the deal and (optionally) settings before the app boots. */
async function prepare(page: Page, settings: Record<string, unknown> = {}, dealSeed = 7) {
  await page.addInitScript((s) => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = s;
  }, dealSeed);
  await seed(page, { settings });
}

/** Quick Play → game → deck → board → table. */
async function openTable(page: Page, gameId: string) {
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, gameId);
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
}

const count = async (page: Page, side: string) =>
  Number(await page.locator(`${CURRENT} [data-count="${side}"]`).textContent());

const hudRound = async (page: Page) =>
  Number((await page.locator(`${CURRENT} [data-hud="round"]`).textContent())!.replace(/\D/g, ''));

test.describe('War', () => {
  test('deals 26 each against Jak Gold and plays a round', async ({ page }) => {
    await prepare(page);
    await enterParlor(page);
    await openTable(page, 'war');
    const options = page.locator('[data-options="war"]');
    await expect(options).toContainText('Jak Gold');
    await expect(options.getByRole('radio', { name: 'Jak Gold' })).toHaveAttribute('aria-checked', 'true');
    await page.locator('[data-dialog-action="deal"]').click();

    await expect(page.locator(`${CURRENT} [data-avatar="jak_gold"]`)).toBeVisible();
    expect(await count(page, 'player')).toBe(26);
    expect(await count(page, 'cpu')).toBe(26);
    await expect(page.locator(`${CURRENT} [data-hud="round"]`)).toHaveText('Round 0');

    await page.locator(`${CURRENT} [data-action="play-round"]`).click();
    await expect(page.locator(`${CURRENT} [data-banner]`)).toHaveAttribute('data-winner', /player|cpu/);
    await expect(page.locator(`${CURRENT} [data-hud="round"]`)).toHaveText('Round 1');
    expect((await count(page, 'player')) + (await count(page, 'cpu'))).toBe(52);
    // Both battle cards were turned face up.
    await expect(page.locator(`${CURRENT} [data-slot="player"] .card-face`).last()).toBeVisible();
    await expect(page.locator(`${CURRENT} [data-slot="cpu"] .card-face`).last()).toBeVisible();
  });

  test('speed, auto play, pause, keyboard and restart', async ({ page }) => {
    await prepare(page);
    await enterParlor(page);
    await openTable(page, 'war');
    await page.locator('[data-dialog-action="deal"]').click();

    const speed = page.locator(`${CURRENT} [data-action="speed"]`);
    await expect(speed).toHaveAttribute('data-speed', 'normal');
    await speed.click();
    await expect(speed).toHaveAttribute('data-speed', 'fast');
    await speed.click();
    await expect(speed).toHaveAttribute('data-speed', 'instant');
    await expect(speed).toContainText('Max');

    // Keyboard: Space plays a round.
    await page.locator(`${CURRENT} .war-field`).click();
    await page.keyboard.press('Space');
    await expect.poll(() => hudRound(page)).toBe(1);

    const auto = page.locator(`${CURRENT} [data-action="auto"]`);
    await auto.click();
    await expect(auto).toHaveAttribute('aria-pressed', 'true');
    await expect(auto).toHaveText('Pause');
    await expect.poll(() => hudRound(page)).toBeGreaterThan(5);
    await auto.click();
    await expect(auto).toHaveAttribute('aria-pressed', 'false');
    const paused = await hudRound(page);
    await page.waitForTimeout(400);
    expect(await hudRound(page)).toBe(paused);

    await tableAction(page, 'new-game');
    await page.locator('[data-dialog-action="true"]').click();
    await expect(page.locator(`${CURRENT} [data-hud="round"]`)).toHaveText('Round 0');
    expect(await count(page, 'player')).toBe(26);
  });

  test('auto plays to victory or defeat and records statistics', async ({ page }) => {
    await prepare(page, { warSpeed: 'instant' });
    await enterParlor(page);
    await openTable(page, 'war');
    await page.locator('[data-dialog-action="deal"]').click();
    await page.locator(`${CURRENT} [data-action="auto"]`).click();

    const result = page.locator('.dialog-result');
    await expect(result).toBeVisible({ timeout: 90_000 });
    const outcome = await result.locator('[data-result]').getAttribute('data-result');
    expect(['win', 'loss', 'draw']).toContain(outcome);
    if (outcome !== 'draw') {
      expect(Math.max(await count(page, 'player'), await count(page, 'cpu'))).toBe(52);
    }
    await page.locator('[data-dialog-action="menu"]').click();
    await expectScreen(page, 'MAIN_MENU');

    await page.locator(`${CURRENT} .menu-grid [data-nav="STATISTICS"]`).click();
    await page.locator(`${CURRENT} [data-tab="war"]`).click();
    await expect(page.locator(`${CURRENT} .stat-grid .stat-item`).first()).toContainText('1');
  });

  test('saves after each round and resumes', async ({ page }) => {
    await prepare(page, { warSpeed: 'instant' });
    await enterParlor(page);
    await openTable(page, 'war');
    await page.locator('[data-dialog-action="deal"]').click();
    for (let i = 0; i < 3; i++) await page.locator(`${CURRENT} [data-action="play-round"]`).click();
    await expect.poll(() => hudRound(page)).toBe(3);
    const before = await count(page, 'player');
    await page.waitForTimeout(200);

    await page.reload();
    await page.getByRole('button', { name: 'Enter Parlor' }).click();
    await expectScreen(page, 'MAIN_MENU');
    await openTable(page, 'war');
    await expect(page.getByRole('dialog')).toContainText('Round 3');
    await page.locator('[data-dialog-action="resume"]').click();
    await expect(page.locator(`${CURRENT} [data-hud="round"]`)).toHaveText('Round 3');
    expect(await count(page, 'player')).toBe(before);
  });
});

test.describe('Go Fish', () => {
  for (const [cpus, size] of [
    [1, 7],
    [2, 7],
    [3, 5],
  ] as const) {
    test(`deals against ${cpus} CPU(s) with opponents face down`, async ({ page }) => {
      await prepare(page, { goFishOpponents: cpus });
      await enterParlor(page);
      await openTable(page, 'go-fish');
      await expect(page.locator('[data-options="go-fish"] .lineup-item')).toHaveCount(cpus);
      await page.locator('[data-dialog-action="deal"]').click();

      await expect(page.locator(`${CURRENT} .gf-opp`)).toHaveCount(cpus);
      await expect(page.locator(`${CURRENT} [data-avatar="jak_gold"]`)).toBeVisible();
      // Hand counts (some cards may already be in a book from the deal).
      const handCards = await page.locator(`${CURRENT} .gf-hand .gf-card`).count();
      const books = await page.locator(`${CURRENT} .gf-book`).count();
      expect(handCards + books * 4).toBe(size);
      for (const opp of await page.locator(`${CURRENT} .gf-opp`).all()) {
        await expect(opp.locator('[data-count]')).toContainText(/\d+ cards?/);
      }
      expect(await count(page, 'pond')).toBe(52 - size * (cpus + 1));

      // Opponents' cards are only ever drawn face down, with no identity in the page.
      await expect(page.locator(`${CURRENT} .gf-opp .card-face`)).toHaveCount(0);
      await expect(page.locator(`${CURRENT} .gf-opp .gf-mini`).first()).toBeVisible();
      expect(await page.locator('[data-card-id]').count()).toBe(0);
      const faces = await page.locator(`${CURRENT} .card-face`).count();
      expect(faces).toBe(handCards + books);
    });
  }

  test('ask with the mouse: tap a card, confirm in the rank picker, see the bubbles', async ({ page }) => {
    await prepare(page, { goFishOpponents: 2 });
    await enterParlor(page);
    await openTable(page, 'go-fish');
    await page.locator('[data-dialog-action="deal"]').click();

    const firstCard = page.locator(`${CURRENT} .gf-hand .gf-card`).first();
    const rank = await firstCard.getAttribute('data-rank');
    await firstCard.click();
    const picker = page.locator('.dialog-ask');
    await expect(picker).toBeVisible();
    await expect(picker.locator(`[data-pick-rank="${rank}"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(picker.locator('[data-pick-target]')).toHaveCount(2);
    await picker.locator('[data-pick-target="friendly_local"]').click();
    await page.locator('[data-dialog-action="ask"]').click();

    await expect(page.locator(`${CURRENT} .gf-you > .bubble`)).toContainText('Friendly Local, any');
    await expect(page.locator(`${CURRENT} [data-status-text]`)).not.toBeEmpty();
  });

  test('ask with the keyboard', async ({ page }) => {
    await prepare(page, { goFishOpponents: 3 });
    await enterParlor(page);
    await openTable(page, 'go-fish');
    await page.locator('[data-dialog-action="deal"]').click();
    await page.locator(`${CURRENT} .gf-center`).click();
    await page.keyboard.press('Enter');
    const picker = page.locator('.dialog-ask');
    await expect(picker).toBeVisible();

    // Pick the highest rank held by its key, and the next opponent with →.
    const ranks = await page
      .locator(`${CURRENT} .gf-hand .gf-card`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-rank')!));
    const target = ranks.at(-1)!;
    const key = target === '10' ? '0' : target.toLowerCase();
    await page.keyboard.press(key);
    await expect(picker.locator(`[data-pick-rank="${target}"]`)).toHaveAttribute('aria-checked', 'true');
    const before = await picker.locator('[data-pick-target][aria-checked="true"]').getAttribute('data-pick-target');
    await page.keyboard.press('ArrowRight');
    await expect(picker.locator('[data-pick-target][aria-checked="true"]')).not.toHaveAttribute(
      'data-pick-target',
      before!,
    );
    await page.keyboard.press('Enter');
    await expect(picker).toHaveCount(0);
    await expect(page.locator(`${CURRENT} .gf-you > .bubble`)).toBeVisible();
  });

  test('plays a whole game to final scoring', async ({ page }) => {
    await prepare(page, { goFishOpponents: 1, reducedMotion: true, cpuDifficulty: 'easy' });
    await enterParlor(page);
    await openTable(page, 'go-fish');
    await page.locator('[data-dialog-action="deal"]').click();

    const result = page.locator('.dialog-result');
    const ask = page.locator(`${CURRENT} [data-action="ask"]`);
    for (let i = 0; i < 400 && !(await result.isVisible()); i++) {
      if (await ask.isEnabled().catch(() => false)) {
        await ask.click();
        await page.locator('[data-dialog-action="ask"]').click();
      } else await page.waitForTimeout(40);
    }
    await expect(result).toBeVisible();
    const books = await result.locator('[data-standing] strong').allTextContents();
    expect(books.map((b) => parseInt(b, 10)).reduce((a, b) => a + b, 0)).toBe(13);
    await page.locator('[data-dialog-action="menu"]').click();
    await page.locator(`${CURRENT} .menu-grid [data-nav="STATISTICS"]`).click();
    await page.locator(`${CURRENT} [data-tab="go-fish"]`).click();
    await expect(page.locator(`${CURRENT} .stat-grid .stat-item`).first()).toContainText('1');
  });

  test('saves and resumes, and explains the rules', async ({ page }) => {
    await prepare(page, { goFishOpponents: 2, reducedMotion: true });
    await enterParlor(page);
    await openTable(page, 'go-fish');
    await page.locator('[data-dialog-action="deal"]').click();
    const ask = page.locator(`${CURRENT} [data-action="ask"]`);
    await ask.click();
    await page.locator('[data-dialog-action="ask"]').click();
    await expect(ask).toBeEnabled({ timeout: 20_000 });
    const hand = await page
      .locator(`${CURRENT} .gf-hand .gf-card`)
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-rank')));
    const pond = await count(page, 'pond');
    await page.waitForTimeout(200);

    await page.reload();
    await page.getByRole('button', { name: 'Enter Parlor' }).click();
    await expectScreen(page, 'MAIN_MENU');
    await openTable(page, 'go-fish');
    await page.locator('[data-dialog-action="resume"]').click();
    await expect(page.locator(`${CURRENT} .gf-opp`)).toHaveCount(2);
    expect(
      await page
        .locator(`${CURRENT} .gf-hand .gf-card`)
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-rank'))),
    ).toEqual(hand);
    expect(await count(page, 'pond')).toBe(pond);

    await tableAction(page, 'rules');
    await expect(page.getByRole('dialog')).toContainText('Go fish');
    await expect(page.getByRole('dialog')).toContainText('Empty pond');
  });
});
