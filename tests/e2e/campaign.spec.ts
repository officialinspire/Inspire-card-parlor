import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickInPager, clickNav, enterParlor, expectScreen, seed } from './helpers';

/**
 * THE THIRTEENTH HAND, Chapters 3–9: every arrival scene with its host, the
 * Chapter 8 four-suit door (a wrong order, a hint, the right order), the
 * finale, the epilogue and the ghost rematches it opens.
 *
 * Challenges are finished through the real results path
 * (`__ICP__.storyResult`): their deals are proven winnable by the unit tests
 * (solver and War simulation), and a test cannot solve a solitaire by hand.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(
    !['phone-portrait', 'phone-landscape', 'small-phone', 'desktop'].includes(info.project.name),
    'the campaign flow on mobile layouts and one desktop',
  );
});

type Profile = {
  unlockedDecks: string[];
  unlockedBoards: string[];
  story: { completed: string[]; stamps: string[]; evidence: string[] };
};
const profile = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ICP__: { store: { state: { profile: Profile } } } }).__ICP__.store.state.profile,
  );
const settings = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __ICP__: { store: { state: { settings: { warOpponent: string } } } } }).__ICP__.store
        .state.settings,
  );

const levels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `th-${n}-${i + 1}`);
const chapters = (upTo: number) => Array.from({ length: upTo }, (_, i) => i + 1);
const HOSTS: Record<string, string> = {
  'th-3': 'dante',
  'th-4': 'jak_gold',
  'th-5': 'mrs_gray',
  'th-6': 'steve_gonzales',
  'th-7': 'mary_ball_washington',
  'th-8': 'steve_gonzales',
  'th-9': 'george_washington',
};

/** A save part-way through the campaign, as this build writes it. */
const save = (completed: string[], introsSeen: string[]) => ({
  settings: { musicPaused: true, warSpeed: 'instant' },
  profile: {
    schemaVersion: 3,
    storyChapter: 0,
    story: {
      campaign: 'thirteenth-hand',
      version: 2,
      completed,
      rewarded: [],
      stamps: [],
      introsSeen,
      attempts: {},
      evidence: [],
    },
  },
});

const tile = (page: Page, chapter: string) => page.locator(`${CURRENT} [data-chapter="${chapter}"]`);

async function openChapter(page: Page, chapter: string) {
  await tile(page, chapter).click();
  const skip = action(page, 'skip');
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="${chapter}"]`)).toBeVisible();
}

/** Records a finished story game through the real results path, then returns to Story Mode. */
async function finish(page: Page, levelId: string) {
  await page.evaluate((levelId) => {
    const icp = (
      window as unknown as {
        __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
      }
    ).__ICP__;
    icp.storyResult(levelId, 'win');
    icp.store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
  }, levelId);
  await expectScreen(page, 'STORY_MODE');
}

/** After a first win: the closing scene, the results, and (for a finale) the chapter's stamp. */
async function afterWin(page: Page, chapter: string, finale: boolean) {
  await expect(page.locator('.scene-outro')).toBeVisible();
  await action(page, 'ok').click();
  await expect(page.locator('[data-story-result="complete"]')).toBeVisible();
  await action(page, 'continue').click();
  if (finale) {
    await expect(page.locator(`[data-chapter-complete="${chapter}"]`)).toBeVisible();
    await action(page, 'ok').click();
  }
}

/** Taps the four marks in order in the door puzzle, then sets them. */
async function setMarks(page: Page, order: string[]) {
  const puzzle = page.locator('.dialog-suit-puzzle');
  await expect(puzzle).toBeVisible();
  const set = puzzle.locator('[data-dialog-action="set"]');
  await expect(set).toBeDisabled();
  for (const suit of order) await puzzle.locator(`[data-suit="${suit}"]`).click();
  await expect(puzzle.locator('.suit-slot.filled')).toHaveCount(4);
  await expect(set).toBeEnabled();
  await set.click();
}

test('every chapter from 3 to 9 opens with its host in the arrival scene', async ({ page }) => {
  await seed(
    page,
    save(
      chapters(9).flatMap((n) => levels(n)),
      ['th-1', 'th-2'],
    ),
  );
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  for (const [chapter, host] of Object.entries(HOSTS)) {
    await expect(tile(page, chapter)).toHaveAttribute('data-state', 'completed');
    await tile(page, chapter).click();
    const scene = page.locator('.dialog-scene');
    await expect(scene.locator('[data-scene]')).toBeVisible();
    expect(Number(await scene.locator('[data-scene]').getAttribute('data-lines'))).toBeGreaterThanOrEqual(3);
    // Read to the host's first line: their portrait (or Jak's avatar) is on screen.
    await expect
      .poll(async () => {
        if (await scene.locator(`[data-portrait="${host}"]`).isVisible()) return true;
        await scene.locator('[data-scene]').click();
        return false;
      })
      .toBe(true);
    await action(page, 'skip').click();
    await expect(page.locator(`${CURRENT} [data-chapter-view="${chapter}"]`)).toBeVisible();
    await page.locator(`${CURRENT} [data-nav="back"]`).click();
  }
});

test('the four-suit door: a wrong order earns a hint, the right one opens it, and Chapter 9 appears', async ({
  page,
}) => {
  const done = [...chapters(7).flatMap((n) => levels(n)), ...levels(8, 4)];
  await seed(page, save(done, ['th-1', 'th-2', 'th-3', 'th-4', 'th-5', 'th-6', 'th-7', 'th-8']));
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await expect(tile(page, 'th-9')).toHaveAttribute('data-state', 'locked');
  await openChapter(page, 'th-8');
  await clickInPager(page, '[data-level="th-8-5"]');
  await expect(page.locator('.dialog-scene [data-objective]')).toContainText('set the four marks');
  await action(page, 'play').click();

  // Jak's new deck order: wrong. The door stays shut, and someone offers a hint.
  await setMarks(page, ['spades', 'diamonds', 'clubs', 'hearts']);
  const hint = page.locator('.scene-puzzle-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('does not move');
  await action(page, 'retry').click();
  // Undo works, then Steve's order: spade, diamond, heart, club.
  const puzzle = page.locator('.dialog-suit-puzzle');
  await puzzle.locator('[data-suit="clubs"]').click();
  await puzzle.locator('[data-action="suit-undo"]').click();
  await expect(puzzle.locator('.suit-slot.filled')).toHaveCount(0);
  await setMarks(page, ['spades', 'diamonds', 'hearts', 'clubs']);
  await expect(page.locator('.scene-puzzle-solved')).toBeVisible();
  await action(page, 'ok').click();

  // Then the challenge itself, at the tunnels' table.
  await expect(page.locator('[data-versus="th-8-5"]')).toBeVisible();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', 'underground_tunnels');
  await finish(page, 'th-8-5');
  await afterWin(page, 'th-8', true);

  const p = await profile(page);
  expect(p.story.evidence).toContain('four-suit-puzzle');
  expect(p.story.stamps).toContain('th-lantern-cellar');
  await expect(tile(page, 'th-9')).toHaveAttribute('data-state', 'available');
  await expect(tile(page, 'th-9')).toHaveAccessibleName(/Washington’s Spectral Card Parlor/);
});

test('the thirteenth hand: the finale, the epilogue, then a ghost rematch at the War table', async ({ page }) => {
  const done = [...chapters(8).flatMap((n) => levels(n)), ...levels(9, 4)];
  await seed(
    page,
    save(
      done,
      chapters(9).map((n) => `th-${n}`),
    ),
  );
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-finished]`)).toHaveCount(0);
  await openChapter(page, 'th-9');
  await clickInPager(page, '[data-level="th-9-5"]');
  // The finale's scene brings Mary in, restrained, before the last game.
  await expect(page.locator('.dialog-scene [data-portrait="mary_ball_washington"]')).toBeVisible();
  await action(page, 'play').click();
  await expect(page.locator('[data-versus="th-9-5"] [data-opponent="george_washington"]')).toBeVisible();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', 'washington_final_table');
  await finish(page, 'th-9-5');
  await afterWin(page, 'th-9', true);

  // The epilogue: read to its last line, which opens the rematches.
  const epilogue = page.locator('.scene-epilogue');
  await expect(epilogue).toBeVisible();
  const stage = epilogue.locator('[data-scene]');
  const lines = Number(await stage.getAttribute('data-lines'));
  for (let i = 1; i < lines; i++) await stage.click();
  await expect(epilogue).toContainText('Ghost rematches are open');
  await action(page, 'ok').click();
  const rematches = page.locator('[data-rematches]');
  await expect(rematches).toBeVisible();
  await expect(rematches.locator('[data-rematch]')).toHaveCount(2);

  const p = await profile(page);
  expect(p.story.completed).toHaveLength(45);
  expect(p.story.evidence).toContain('awakened-card');
  expect(p.unlockedDecks).toContain('washington_ghost');
  expect(p.unlockedBoards).toContain('washington_final_table');

  // A rematch is an ordinary War table against the ghost, on his deck and board.
  await action(page, 'rematch-george').click();
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', 'washington_final_table');
  expect((await settings(page)).warOpponent).toBe('george_washington');
  // The free-play War table now offers both ghosts as opponents.
  const deal = page.locator('.dialog-backdrop:not([aria-hidden])');
  await expect(deal).toContainText('George Washington’s Ghost');
  await expect(deal).toContainText('Mary Ball Washington');
  await page.keyboard.press('Escape');
  await expect(page.locator('.dialog-backdrop:not([aria-hidden])')).toHaveCount(0);

  // Back on the map: the finished story offers the epilogue and rematches again.
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'NAVIGATE',
      to: 'MAIN_MENU',
    }),
  );
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="story-chapter"]`)).toHaveText('The Thirteenth Hand is complete');
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-finished]`)).toBeVisible();
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  await expect(page.locator(`${CURRENT} [data-journal-objective]`)).toContainText('The thirteenth hand is finished');
});
