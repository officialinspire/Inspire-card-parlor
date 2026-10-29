import { expect, test, type Page } from '@playwright/test';
import { CURRENT, enterParlor, expectScreen, seed } from './helpers';

/**
 * Every game with every completed deck on every painted gameboard.
 *
 * Phone portrait plays the full matrix (8 decks × 3 boards × 5 games);
 * landscape and desktop play every deck in every game, rotating the boards.
 * Each table is checked for: the board painting, the deck's own artwork,
 * readable cards, reachable (clickable) cards, a toolbar that never covers
 * the table, no page scrolling, and an intact deal (no cards lost or added).
 */

const DECKS = [
  'classic',
  'inspire',
  'jak_gold',
  'dantes_world',
  'fredericksburg',
  'fredericksburg_downtown',
  'eastern_woodlands',
  'spycraft',
];
const BOARDS = ['backroom_card_table', 'picnic_table', 'rappahannock_riverside'];
const GAMES = ['klondike', 'spider', 'freecell', 'war', 'go-fish'] as const;

test.describe.configure({ timeout: 240_000 });
test.use({ serviceWorkers: 'block' });

const FULL = 'phone-portrait';
const ROTATING = ['small-phone', 'phone-landscape', 'desktop'];

async function openTable(page: Page, game: string, deck: string, board: string): Promise<void> {
  await page.evaluate(
    ([g, d, b]) => {
      const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
      s.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
      s.dispatch({ type: 'SELECT_GAME', gameId: g });
      s.dispatch({ type: 'SELECT_DECK', deckId: d });
      s.dispatch({ type: 'SELECT_BOARD', boardId: b });
      for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
        s.dispatch({ type: 'NAVIGATE', to });
    },
    [game, deck, board],
  );
  const deal = page.locator('[data-dialog-action="deal"]');
  const resume = page.locator('[data-dialog-action="new"]');
  await expect(deal.or(resume).or(page.locator(`${CURRENT} .card`).first())).toBeVisible();
  if (await resume.isVisible()) await resume.click();
  if (await deal.isVisible()) await deal.click();
  await expect(page.locator(`${CURRENT} .card`).first()).toBeVisible();
  // One screen on stage (the previous table has slid away), the deal dialog
  // faded out and the opening deal finished.
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator('.dialog-backdrop')).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-dealing]`)).toHaveCount(0);
  await settled(page);
}

/** No card is mid-flight (ambient loops on the board are ignored). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== 'running' ||
          !((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest?.('.card'),
      ),
  );
}

async function checkTable(page: Page, game: string, deck: string, board: string): Promise<void> {
  const table = page.locator(`${CURRENT}.table`);
  await expect(table).toHaveAttribute('data-board', board);
  await expect(table).toHaveAttribute('data-board-art', 'image');

  if (game === 'war') {
    await page.locator(`${CURRENT} [data-action="play-round"]`).click();
    // The battle cards are revealed in the deck's art, then swept to the winner's pile.
    await expect(page.locator(`${CURRENT} .war-slot .card-face[data-theme^="${deck}"]`).first()).toHaveAttribute(
      'data-art',
      'atlas',
    );
    await expect(page.locator(`${CURRENT} [data-banner]`)).toHaveAttribute('data-winner', /player|cpu|draw/);
    await expect(page.locator(`${CURRENT} [data-action="play-round"]`)).toBeEnabled();
    await settled(page);
    const sum = await page.evaluate(() =>
      [...document.querySelectorAll('.screen:not([aria-hidden]) [data-count]')].reduce(
        (n, e) => n + Number(e.textContent),
        0,
      ),
    );
    expect(sum, 'War keeps all 52 cards').toBe(52);
  }

  // The deck's own artwork, never the drawn fallback.
  const faces = page.locator(`${CURRENT} .card-face[data-theme^="${deck}"]`);
  if (game !== 'war') await expect(faces.first()).toHaveAttribute('data-art', 'atlas');
  else await expect(page.locator(`${CURRENT} .card-back`).first()).toHaveAttribute('data-art', 'image');
  await expect(page.locator(`${CURRENT} .card-face[data-art="fallback"]`)).toHaveCount(0);

  const report = await page.evaluate((g) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const screen = document.querySelector('.screen:not([aria-hidden])')!;
    const stage = screen.querySelector('.table-stage')!.getBoundingClientRect();
    const toolbar = screen.querySelector('.game-toolbar')!.getBoundingClientRect();
    const problems: string[] = [];

    // Cards: readable (big enough, or showing the index chip), inside the table.
    const faces = [...screen.querySelectorAll<HTMLElement>('.card-face')].filter((c) => c.offsetParent);
    for (const c of faces) {
      const r = c.getBoundingClientRect();
      if (r.width < 14) problems.push(`card too small: ${c.dataset.code} ${r.width}px`);
      const chip = c.querySelector<HTMLElement>('.card-index');
      const chipShown = chip && getComputedStyle(chip).display !== 'none';
      if (r.width < 58 && c.dataset.art === 'atlas' && !chipShown && !c.closest('.gf-book'))
        problems.push(`small card without index: ${c.dataset.code} ${Math.round(r.width)}px`);
      if (chipShown && parseFloat(getComputedStyle(chip!).fontSize) < 9.5)
        problems.push(`index too small on ${c.dataset.code}`);
      if (r.right > vw + 1 || r.bottom > vh + 1) problems.push(`card off screen: ${c.dataset.code}`);
    }

    // Clickable: the top card of every solitaire column, and every card in a Go Fish hand.
    const hit = (el: Element, x: number, y: number) => {
      const at = document.elementFromPoint(x, y);
      return !!at && (at === el || el.contains(at));
    };
    const what = (x: number, y: number) => {
      const at = document.elementFromPoint(x, y) as HTMLElement | null;
      const card = at?.closest<HTMLElement>('.card');
      return card ? `${card.dataset.pile}#${card.dataset.index}` : (at?.className ?? 'nothing');
    };
    if (['klondike', 'spider', 'freecell'].includes(g)) {
      const cols = new Map<string, HTMLElement>();
      for (const c of screen.querySelectorAll<HTMLElement>('.sol-card[data-pile^="tableau"]')) {
        const prev = cols.get(c.dataset.pile!);
        if (!prev || Number(c.dataset.index) > Number(prev.dataset.index)) cols.set(c.dataset.pile!, c);
      }
      for (const [pile, c] of cols) {
        const r = c.getBoundingClientRect();
        const [x, y] = [r.left + r.width / 2, r.top + r.height * 0.6];
        if (!hit(c, x, y)) problems.push(`top card of ${pile} not clickable (hit ${what(x, y)})`);
        if (r.bottom > stage.bottom + 1) problems.push(`${pile} runs under the toolbar`);
      }
      const n = screen.querySelectorAll('.sol-card').length;
      const expected = g === 'spider' ? 104 : 52;
      if (n !== expected) problems.push(`${n} cards on the table, expected ${expected}`);
    }
    if (g === 'go-fish') {
      for (const b of screen.querySelectorAll<HTMLElement>('.gf-card')) {
        const r = b.getBoundingClientRect();
        // Overlapped hand cards show at least their left strip.
        if (!hit(b, r.left + Math.min(10, r.width / 4), r.top + r.height / 2)) problems.push('hand card not clickable');
      }
    }

    // The toolbar sits beside or below the table, never over it; its buttons are on screen.
    const overlaps =
      toolbar.left < stage.right - 1 &&
      stage.left < toolbar.right - 1 &&
      toolbar.top < stage.bottom - 1 &&
      stage.top < toolbar.bottom - 1;
    if (overlaps) problems.push('toolbar covers the table');
    for (const b of screen.querySelectorAll<HTMLElement>('.game-toolbar .tool-btn')) {
      const r = b.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.right > vw + 1 || r.bottom > vh + 1))
        problems.push(`tool off screen: ${b.dataset.action}`);
      if (r.width && (r.width < 40 || r.height < 36)) problems.push(`tool too small to tap: ${b.dataset.action}`);
    }
    if (document.documentElement.scrollWidth > vw + 1 || document.documentElement.scrollHeight > vh + 1)
      problems.push('page scrolls');
    return problems;
  }, game);
  expect(report, `${game} · ${deck} · ${board}`).toEqual([]);
}

async function play(page: Page, combos: [string, string][]) {
  await seed(page, {
    profile: { level: 99, storyChapter: 99, unlockedAchievements: ['win-streak-5', 'war-flawless', 'collector-5'] },
    settings: { cardAnimationSpeed: 'fast', warSpeed: 'fast' },
  });
  await enterParlor(page);
  for (const [deck, board] of combos) {
    for (const game of GAMES) {
      await test.step(`${game} · ${deck} · ${board}`, async () => {
        await openTable(page, game, deck, board);
        await checkTable(page, game, deck, board);
      });
    }
  }
}

for (const board of BOARDS) {
  for (const deck of DECKS) {
    test(`${deck} on ${board}: all five games`, async ({ page }, info) => {
      test.skip(info.project.name !== FULL, 'full matrix runs on phone portrait');
      await play(page, [[deck, board]]);
    });
  }
}

for (const [i, deck] of DECKS.entries()) {
  test(`${deck}: all five games (rotating boards)`, async ({ page }, info) => {
    test.skip(!ROTATING.includes(info.project.name), 'runs on small phone, landscape and desktop');
    await play(page, [[deck, BOARDS[i % BOARDS.length]!]]);
  });
}
