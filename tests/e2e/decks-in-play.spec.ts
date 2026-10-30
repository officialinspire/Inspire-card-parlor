import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickInPager, clickNav, enterParlor, expectScreen, playGame, seed } from './helpers';

/**
 * Every deck made from an uploaded sprite sheet, played in all five games:
 * picked through Quick Play's deck screen, dealt, and drawn from its own
 * artwork (never the drawn fallback).
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
const GAMES = ['klondike', 'spider', 'freecell', 'war', 'go-fish'] as const;

test.describe.configure({ timeout: 180_000 });

test.beforeEach(({}, info) => {
  // One phone and one desktop layout is enough for 40 deals.
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name));
});

async function deal(page: Page, game: string, deck: string) {
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, game);
  await clickInPager(page, `[data-deck="${deck}"]`);
  await expect(page.locator(`${CURRENT} [data-deck="${deck}"]`)).toHaveAttribute('aria-pressed', 'true');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  // Games with options (draw count, suits, opponents) ask first; FreeCell deals straight away.
  const dealBtn = page.locator('[data-dialog-action="deal"]');
  await dealBtn.waitFor({ timeout: 2_000 }).then(
    () => dealBtn.click(),
    () => undefined,
  );
  await expect(page.locator(`${CURRENT} .card`).first()).toBeVisible();
}

/** Face-up cards and backs on the table are drawn from the deck's artwork. */
async function expectArtwork(page: Page, deck: string) {
  const faces = page.locator(`${CURRENT} .card-face[data-theme^="${deck}"]`);
  await expect(faces.first()).toHaveAttribute('data-art', 'atlas');
  await expect(page.locator(`${CURRENT} .card-face[data-art="fallback"]`)).toHaveCount(0);
  // FreeCell deals every card face up; elsewhere backs use the deck's back artwork.
  const backs = page.locator(`${CURRENT} .card-back`);
  if (await backs.count()) await expect(backs.first()).toHaveAttribute('data-art', 'image');
  // The sprite sheet really loaded in the browser.
  const loaded = await page.evaluate(
    (d) =>
      performance
        .getEntriesByType('resource')
        .some(
          (e) =>
            e.name.includes(`/assets/cards/${d}/faces.webp`) && (e as PerformanceResourceTiming).decodedBodySize > 0,
        ),
    deck,
  );
  expect(loaded).toBe(true);
}

for (const deck of DECKS) {
  test(`${deck} plays in all five games`, async ({ page }) => {
    await seed(page, {
      profile: {
        level: 99,
        storyChapter: 99,
        unlockedAchievements: ['win-streak-5', 'war-flawless', 'collector-5'],
      },
    });
    await enterParlor(page);
    for (const game of GAMES) {
      await test.step(game, async () => {
        await deal(page, game, deck);
        if (game === 'war') {
          // War deals face down; play a round to turn two cards over.
          await page.locator(`${CURRENT} [data-action="play-round"]`).click();
          // A tied first round goes to war, which takes a few seconds to play out.
          await expect(page.locator(`${CURRENT} [data-banner]`)).toHaveAttribute('data-winner', /player|cpu/, {
            timeout: 15_000,
          });
        }
        await expectArtwork(page, deck);
        await clickNav(page, 'home', 'MAIN_MENU');
        const leave = page.locator('[data-dialog-action="leave"]');
        if (await leave.isVisible().catch(() => false)) await leave.click();
        await expectScreen(page, 'MAIN_MENU');
      });
    }
  });
}
