import { expect, test, type Locator, type Page } from '@playwright/test';
import { KlondikeGame } from '../../src/games/solitaire/KlondikeGame';
import { FreeCellGame } from '../../src/games/solitaire/FreeCellGame';
import { solve, type SolverStep } from '../../src/games/solitaire/solver';
import type { SolitaireGame } from '../../src/games/solitaire/SolitaireGame';
import { CURRENT, enterParlor, expectScreen, seed } from './helpers';

/**
 * Plays a whole solitaire game to victory through the real interface: the
 * solver finds a winning line for a seeded deal (with the game's own rules),
 * then each move is made by tapping the card and its destination. Checks the
 * win is detected, the result dialog shows, and statistics and achievements
 * are recorded. (Spider is left out: its solver lines run to ~1,500 taps.)
 */
test.describe.configure({ timeout: 240_000 });
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['desktop', 'phone-portrait'].includes(info.project.name), 'one desktop and one phone layout');
});

async function openSeeded(page: Page, gameId: string, dealSeed: number) {
  await page.addInitScript((s) => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = s;
  }, dealSeed);
  await seed(page, {
    settings: { reducedMotion: true, autoComplete: false, musicPaused: true, klondikeDraw: 1, spiderSuits: 1 },
  });
  await enterParlor(page);
  await page.evaluate((g) => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: g });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  }, gameId);
  await expectScreen(page, 'GAMEPLAY');
  const deal = page.locator('[data-dialog-action="deal"]');
  if (await deal.isVisible({ timeout: 1500 }).catch(() => false)) await deal.click();
  await expect(page.locator(`${CURRENT} .sol-board .sol-card`).first()).toBeVisible();
  // A tap during the opening deal only skips it: wait for the deal to finish.
  await expect(page.locator(`${CURRENT} .sol-board[data-dealing]`)).toHaveCount(0, { timeout: 15_000 });
}

/** Where every card is: changes after every move and every stock action. */
const layout = (page: Page) =>
  page.locator(`${CURRENT} .sol-board .sol-card`).evaluateAll((els) =>
    els
      .map(
        (e) =>
          `${(e as HTMLElement).dataset.key}@${(e as HTMLElement).dataset.pile}:${(e as HTMLElement).dataset.side}`,
      )
      .sort()
      .join(','),
  );

/** Taps a card on its visible top strip (cards lower in a column cover the rest). */
const tapTop = { position: { x: 14, y: 8 } };

async function playLine(page: Page, line: SolverStep[]) {
  // Two taps on the same card within 350 ms are a double-tap (send it to its best spot),
  // so a player tapping the card they just dropped onto pauses briefly; so do we.
  let lastKey: string | null = null;
  const tap = async (target: Locator, opts: Parameters<Locator['click']>[0] = {}) => {
    const key = await target.getAttribute('data-key').catch(() => null);
    if (key && key === lastKey) await page.waitForTimeout(400);
    lastKey = key;
    await target.click({ ...tapTop, ...opts });
  };
  for (const [i, step] of line.entries()) {
    const before = await layout(page);
    if (step.kind === 'stock') {
      const stock = page.locator(`${CURRENT} .sol-card[data-pile="stock"]`);
      if (await stock.count()) await tap(stock.last());
      else await tap(page.locator(`${CURRENT} .sol-slot[data-pile="stock"]`), { force: true });
    } else {
      const { from, index, to } = step.move;
      await tap(page.locator(`${CURRENT} .sol-card[data-pile="${from}"][data-index="${index}"]`));
      const dest = page.locator(`${CURRENT} .sol-card[data-pile="${to}"]`);
      if (await dest.count()) await tap(dest.last(), { force: true });
      else await tap(page.locator(`${CURRENT} .sol-slot[data-pile="${to}"]`), { force: true });
    }
    if (i < line.length - 1) await expect.poll(() => layout(page), { message: `step ${i + 1}` }).not.toBe(before);
  }
}

const CASES: [string, number, () => SolitaireGame][] = [
  ['freecell', 1001, () => FreeCellGame.create({ seed: 1001 })],
  ['klondike', 1008, () => KlondikeGame.create({ seed: 1008, draw: 1 })],
];

for (const [gameId, dealSeed, create] of CASES) {
  test(`${gameId}: a full game played by tapping is won, celebrated and recorded`, async ({ page }) => {
    const solution = solve(create(), 250_000);
    expect(solution.solved, 'the seeded deal is winnable').toBe(true);
    await openSeeded(page, gameId, dealSeed);
    await playLine(page, solution.line);

    const result = page.locator('.dialog-result');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result.locator('[data-result]')).toHaveAttribute('data-result', 'win');
    const profile = await page.evaluate(
      () =>
        (
          window as unknown as {
            __ICP__: {
              store: { state: { profile: { stats: Record<string, { won: number }>; unlockedAchievements: string[] } } };
            };
          }
        ).__ICP__.store.state.profile,
    );
    expect(profile.stats[gameId]!.won).toBe(1);
    expect(profile.unlockedAchievements).toEqual(expect.arrayContaining(['first-win', `${gameId}-1`]));
  });
}
