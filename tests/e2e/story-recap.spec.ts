import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickInPager, clickNav, enterParlor, seed } from './helpers';

/**
 * Where you left off: the map's Continue, the journal's recap, clue readings
 * that link only to clues already found, Replay versus a first play, and the
 * door puzzle's clues one tap away (with its hints and "Not now" intact).
 */
test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'small-phone', 'desktop'].includes(info.project.name), 'phones and one desktop');
});

const levels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `th-${n}-${i + 1}`);
const chapters = (upTo: number) => Array.from({ length: upTo }, (_, i) => i + 1);
/** Clues in the order the story hands them out (src/story/evidence.ts). */
const CLUES = [
  'thirteenth-hand-card',
  'estate-sale-receipt',
  'ledger-of-twelve',
  'river-postcard',
  'field-journal-page',
  'club-mark',
  'sophia-river-map',
  'returned-envelope',
  'commission-form',
  'monster-card',
  'heart-mark',
  'cardistry-receipt',
  'redacted-reply',
  'diamond-mark',
  'thirteenth-hand-dossier',
  'spade-mark',
  'lodge-sketchbook-page',
  'ledger-impression',
  'mary-letter',
  'kenmore-iron-key',
  'neon-tunnel-map',
];
const save = (completed: string[], introsSeen: string[], evidence: string[]) => ({
  settings: { musicPaused: true, warSpeed: 'instant', reducedMotion: true },
  profile: {
    schemaVersion: 3,
    storyChapter: 0,
    story: {
      campaign: 'thirteenth-hand',
      version: 2,
      completed,
      rewarded: completed.map((id) => `level:${id}`),
      stamps: [],
      introsSeen,
      attempts: {},
      evidence,
    },
  },
});
/** The story's own records: what has been paid, found and stamped. */
const story = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __ICP__: {
            store: { state: { profile: { story: { rewarded: string[]; evidence: string[]; stamps: string[] } } } };
          };
        }
      ).__ICP__.store.state.profile.story,
  );

test('a fresh save: the map names the first challenge, and Continue opens its brief', async ({ page }) => {
  await seed(page, { settings: { musicPaused: true, reducedMotion: true } });
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  const next = page.locator(`${CURRENT} [data-story-next]`);
  await expect(next).toHaveAttribute('data-story-next', 'th-1-1');
  await expect(next).toContainText('Win War against Cheryl');
  await expect(next).toContainText(/Earns .*credits/);
  await next.locator('[data-action="continue-story"]').click();
  // The arrival plays first (unseen), then the challenge's own brief.
  await action(page, 'skip').click();
  await expect(page.locator('.dialog-scene [data-objective]')).toContainText('Win War against Cheryl');
  // A clue still to be found is not named before it is earned.
  const rewards = page.locator('.dialog-scene [data-rewards]');
  await expect(rewards.locator('[data-unseen]')).toHaveText('A new clue');
  await expect(rewards).not.toContainText('Estate-sale receipt');
  await expect(action(page, 'play')).toHaveText(/Ready/);
});

test('the journal recaps a middle chapter: last clue, open question, next action', async ({ page }) => {
  const done = [...chapters(3).flatMap((n) => levels(n)), ...levels(4, 2)];
  await seed(page, save(done, ['th-1', 'th-2', 'th-3', 'th-4'], CLUES.slice(0, 12)));
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  const recap = page.locator(`${CURRENT} [data-recap]`);
  await expect(recap.locator('[data-recap-clue="cardistry-receipt"]')).toBeVisible();
  if (await recap.locator('[data-recap-question]').isVisible())
    await expect(recap.locator('[data-recap-question]')).toContainText('Whose office has no name on the door?');
  await expect(recap.locator('[data-recap-next="challenge"]')).toContainText('Chapter 4');
  // The last clue opens in the clue viewer, with its reading and links to clues already found only.
  await recap.locator('[data-recap-clue] button').click();
  const viewer = page.locator('.dialog-clue');
  await expect(viewer.locator('[data-clue-reading]')).toContainText('office with no name');
  await expect(viewer.locator('[data-related-clue="commission-form"]')).toBeVisible();
  await viewer.locator('[data-related-clue="commission-form"]').click();
  await expect(page.locator('[data-clue-detail="commission-form"]')).toBeVisible();
  for (let i = 0; i < 2; i++) await page.keyboard.press('Escape');
  // Continue goes to the next challenge's brief.
  await recap.locator('[data-action="continue-story"]').click();
  await expect(page.locator('.dialog-scene [data-objective]')).toBeVisible();
  await action(page, 'cancel').click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-4"]`)).toBeVisible();
});

test('a finished challenge is a Replay: it says so, and pays nothing again', async ({ page }) => {
  const done = [...chapters(1).flatMap((n) => levels(n)), ...levels(2, 2)];
  await seed(page, save(done, ['th-1', 'th-2'], CLUES.slice(0, 6)));
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-2"]`).click();
  await clickInPager(page, '[data-level="th-2-1"]');
  await expect(page.locator('.dialog-scene [data-replay-note]')).toBeVisible();
  await expect(action(page, 'play')).toHaveText(/Replay/);
  await action(page, 'cancel').click();
  // Win it again through the real results path: no story rewards, no new clue, no stamp.
  // (Any won game still earns the table's ordinary payout, as in Quick Play.)
  const before = await story(page);
  await page.evaluate(() => {
    const icp = (
      window as unknown as {
        __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
      }
    ).__ICP__;
    icp.storyResult('th-2-1', 'win');
    icp.store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
  });
  await expect(page.locator('[data-story-result="complete"]')).toBeVisible();
  await expect(page.locator('[data-story-result] [data-rewards]')).toHaveCount(0);
  const after = await story(page);
  expect(after.rewarded).toEqual(before.rewarded);
  expect(after.evidence).toEqual(before.evidence);
  expect(after.stamps).toEqual(before.stamps);
});

test('the four-suit door offers the clues already found, and keeps its hints and Not now', async ({ page }) => {
  const done = [...chapters(7).flatMap((n) => levels(n)), ...levels(8, 4)];
  await seed(
    page,
    save(
      done,
      chapters(8).map((n) => `th-${n}`),
      CLUES,
    ),
  );
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-story-next] [data-action="continue-story"]`).click();
  await action(page, 'play').click();
  const puzzle = page.locator('.dialog-suit-puzzle');
  await expect(puzzle).toBeVisible();
  const clues = puzzle.locator('[data-suit-clues] [data-suit-clue]');
  await expect(clues).toHaveCount(3);
  await puzzle.locator('[data-suit-clue="lodge-sketchbook-page"]').click();
  await expect(page.locator('[data-clue-detail="lodge-sketchbook-page"]')).toContainText(/spade, diamond, heart, club/);
  await page.locator('.dialog-clue [data-dialog-action]').last().click();
  // Back at the door, which is unchanged: a wrong order earns the first hint, and "Not now" leaves.
  for (const s of ['spades', 'diamonds', 'clubs', 'hearts']) await puzzle.locator(`[data-suit="${s}"]`).click();
  await puzzle.locator('[data-dialog-action="set"]').click();
  await expect(page.locator('.scene-puzzle-hint')).toContainText('does not move');
  await action(page, 'cancel').click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-8"]`)).toBeVisible();
});
