import { expect, test, type Page } from '@playwright/test';
import {
  CURRENT,
  clickInPager,
  clickNav,
  enterParlor,
  expectNoOverflow,
  expectScreen,
  revealInPager,
  seed,
} from './helpers';

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: 'block' });

type Profile = {
  credits: number;
  unlockedDecks: string[];
  unlockedBoards: string[];
  story: { completed: string[]; rewarded: string[]; stamps: string[] };
};
const profile = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ICP__: { store: { state: { profile: Profile } } } }).__ICP__.store.state.profile,
  );

const chapterLevels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `chapter-${n}-${i + 1}`);

async function openStory(page: Page) {
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter="chapter-1"]`)).toBeVisible();
}

/** Opens a chapter (skipping its intro if shown) and starts a challenge through its dialogue. */
async function playLevel(page: Page, chapter: string, level: string) {
  await page.locator(`${CURRENT} [data-chapter="${chapter}"]`).click();
  const skip = page.locator('[data-dialog-action="skip"]');
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="${chapter}"]`)).toBeVisible();
  await clickInPager(page, `[data-level="${level}"]`);
  await expect(page.locator('.dialog-story [data-objective]')).toBeVisible();
  await page.locator('[data-dialog-action="play"]').click();
  await expectScreen(page, 'GAMEPLAY');
}

/** War challenges: auto-play the verified deal at full speed. */
async function autoWar(page: Page) {
  const deal = page.locator('[data-dialog-action="deal"]');
  if (await deal.isVisible({ timeout: 1500 }).catch(() => false)) await deal.click();
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  const result = page.locator('.dialog-result');
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result.locator('[data-result]')).toHaveAttribute('data-result', 'win');
  await page.locator('[data-dialog-action="menu"]').click(); // "Story map"
  await expectScreen(page, 'STORY_MODE');
}

test('a challenge from intro to reward; rewards persist and are paid only once', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await openStory(page);
  // Passport starts empty; chapter 2 is locked.
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-chapter="chapter-2"]`)).toHaveClass(/locked/);

  // First visit plays the chapter introduction, which can be skipped.
  await page.locator(`${CURRENT} [data-chapter="chapter-1"]`).click();
  await expect(page.locator('.dialog-story')).toContainText('The Hometown');
  await page.locator('[data-dialog-action="skip"]').click();
  // Only the first challenge is open.
  await expect(page.locator(`${CURRENT} [data-level="chapter-1-1"]`)).not.toHaveClass(/locked/);
  await expect(page.locator(`${CURRENT} [data-level="chapter-1-2"]`)).toHaveClass(/locked/);
  await page.locator(`${CURRENT} [data-action="chapter-intro"]`).click(); // replay the intro on demand
  await page.locator('[data-dialog-action="skip"]').click();

  await page.locator(`${CURRENT} [data-level="chapter-1-1"]`).click();
  await expect(page.locator('.dialog-story [data-objective]')).toContainText('Win the game');
  await expect(page.locator('.dialog-story [data-rewards]')).toContainText('credits');
  await page.locator('[data-dialog-action="play"]').click();
  await expectScreen(page, 'GAMEPLAY');
  // The challenge brings its own deck and table.
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', 'picnic_table');
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toContainText('Riverfront Warm-Up');
  const before = (await profile(page)).credits;
  await autoWar(page);

  const result = page.locator('[data-story-result="complete"]');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-reward="credits"]')).toBeVisible();
  await page.locator('.dialog-story-result [data-dialog-action]').last().click();
  await expect(page.locator(`${CURRENT} [data-level="chapter-1-1"]`)).toHaveClass(/done/);
  await expect(page.locator(`${CURRENT} [data-level="chapter-1-2"]`)).not.toHaveClass(/locked/);
  const after = await profile(page);
  expect(after.story.completed).toContain('chapter-1-1');
  expect(after.credits).toBeGreaterThan(before);

  // Survives a reload.
  await page.waitForTimeout(400);
  await page.reload();
  await enterParlor(page).catch(async () => {
    await page.getByRole('button', { name: 'Enter Parlor' }).click();
    await expectScreen(page, 'MAIN_MENU');
  });
  const reloaded = await profile(page);
  expect(reloaded.story.completed).toContain('chapter-1-1');
  expect(reloaded.story.rewarded).toContain('level:chapter-1-1');

  // Replaying pays nothing more (the War itself still pays its usual game credits).
  await openStory(page);
  await playLevel(page, 'chapter-1', 'chapter-1-1');
  const replayStart = (await profile(page)).credits;
  await autoWar(page);
  await expect(page.locator('[data-story-result="complete"]')).toContainText('already collected');
  const replayEnd = (await profile(page)).credits;
  expect(replayEnd - replayStart).toBeLessThanOrEqual(30); // only the normal War win, no story reward
});

test('finishing a chapter stamps the passport and grants its rewards', async ({ page }) => {
  await seed(page, {
    settings: { warSpeed: 'instant' },
    profile: {
      story: {
        completed: [...chapterLevels(1), ...chapterLevels(2, 4)],
        rewarded: [...chapterLevels(1), ...chapterLevels(2, 4)].map((id) => `level:${id}`).concat('chapter:chapter-1'),
        stamps: ['hometown'],
        introsSeen: ['chapter-1', 'chapter-2'],
        attempts: {},
      },
      storyChapter: 1,
    },
  });
  await enterParlor(page);
  await openStory(page);
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(1);
  await playLevel(page, 'chapter-2', 'chapter-2-5');
  await autoWar(page);
  await page.locator('.dialog-story-result [data-dialog-action]').last().click();
  const done = page.locator('[data-chapter-complete="chapter-2"]');
  await expect(done).toBeVisible();
  await expect(done).toContainText('BlackJak Jak Gold deck');
  await expect(done).toContainText('Passport stamp');
  await page.locator('[data-dialog-action="ok"]').click();
  const p = await profile(page);
  expect(p.story.stamps).toEqual(['hometown', 'casino']);
  expect(p.unlockedDecks).toContain('jak_gold');
  expect(p.unlockedBoards).toContain('jak_golds_casino');
  // Back on the chapter list, chapter 3 is open and two stamps show.
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(2);
  await expect(page.locator(`${CURRENT} [data-chapter="chapter-3"]`)).not.toHaveClass(/locked/);
});

test('every challenge launches with its own game, deck and table, and seeded deals repeat exactly', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone-portrait', 'one layout is enough to launch all 35');
  await seed(page, { profile: { storyChapter: 7 } });
  await enterParlor(page);
  const levels = await page.evaluate(
    () =>
      (
        window as unknown as {
          __ICP__: { story: { id: string; game: string; deck: string; board: string; seeded: boolean }[] };
        }
      ).__ICP__.story,
  );
  expect(levels).toHaveLength(35);
  const launch = async (id: string) => {
    await page.evaluate((levelId) => {
      const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
      s.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
      s.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
      s.dispatch({ type: 'SELECT_STORY_LEVEL', levelId, chapterId: levelId.replace(/-\d$/, '') });
      s.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
    }, id);
    await expectScreen(page, 'GAMEPLAY');
    // A story game in progress is offered for resume: start fresh.
    const fresh = page.locator('[data-dialog-action="new"]');
    if (await fresh.isVisible({ timeout: 800 }).catch(() => false)) await fresh.click();
    await expect(page.locator('[data-dialog-action="deal"]')).toHaveCount(0); // no options dialog in story
    await expect(page.locator(`${CURRENT} .card`).first()).toBeVisible();
    await expect(page.locator('.dialog-backdrop')).toHaveCount(0);
  };
  const faces = () =>
    page
      .locator(`${CURRENT} .card-face`)
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.code).join(','));
  for (const l of levels) {
    await test.step(l.id, async () => {
      await launch(l.id);
      await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', l.board);
      await expect(page.locator(`${CURRENT} .card[data-theme^="${l.deck}@"]`).first()).toBeAttached();
      if (l.seeded && ['klondike', 'spider', 'freecell'].includes(l.game)) {
        await expect.poll(faces).not.toBe('');
        const first = await faces();
        await launch(l.id);
        await expect.poll(faces, { message: `${l.id} deals the same verified deal every time` }).toBe(first);
      }
    });
  }
});

test('Quick Play is untouched by the story', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await openStory(page);
  await playLevel(page, 'chapter-1', 'chapter-1-1');
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  // A normal War: its options dialog, the player's own deck and board.
  await expect(page.locator('[data-dialog-action="deal"]')).toBeVisible();
  await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toHaveText('BlackJak Standard · Backroom Card Table');
});

test('story screens fit every layout without scrolling', async ({ page }) => {
  await seed(page, { profile: { storyChapter: 3 } });
  await enterParlor(page);
  await openStory(page);
  await expectNoOverflow(page);
  await page.locator(`${CURRENT} [data-chapter="chapter-2"]`).click();
  await page.locator('[data-dialog-action="skip"]').click();
  await expectNoOverflow(page);
  await (await revealInPager(page, '[data-level="chapter-2-1"]')).click();
  const dialog = page.locator('.dialog-story');
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  await expect(page.locator('[data-dialog-action="play"]')).toBeInViewport();
});
