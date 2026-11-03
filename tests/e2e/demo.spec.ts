import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickNav, enterParlor, expectScreen, revealInPager, seed } from './helpers';

/**
 * The opening of the story, end to end: Chapter 1 (Cheryl's Antique Shop) →
 * Chapter 2 (Sophia's River Station) → Chapter 3 opens on the map. (The rest
 * of the campaign is covered in campaign.spec.ts.)
 *
 * Every challenge is started through the real story flow — scene, versus
 * card, table — and checked for its board, deck and opponent. The two War
 * challenges are played for real (their verified deals always win); the
 * others are finished through the normal results path (`__ICP__.storyResult`),
 * as a test cannot solve a solitaire deal by hand.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(
    !['phone-portrait', 'phone-landscape', 'small-phone', 'desktop'].includes(info.project.name),
    'the demo flow on mobile layouts and one desktop',
  );
});

type Profile = {
  credits: number;
  xp: number;
  unlockedDecks: string[];
  unlockedBoards: string[];
  story: { completed: string[]; rewarded: string[]; stamps: string[]; evidence: string[] };
};
const profile = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ICP__: { store: { state: { profile: Profile } } } }).__ICP__.store.state.profile,
  );

const CHAPTERS = {
  'th-1': {
    host: 'cheryl',
    board: 'cheryls_antique_shop',
    deck: 'fredericksburg',
    levels: [
      { id: 'th-1-1', game: 'war', opponent: 'cheryl' },
      { id: 'th-1-2', game: 'klondike' },
      { id: 'th-1-3', game: 'go-fish', opponent: 'cheryl' },
      { id: 'th-1-4', game: 'freecell' },
      { id: 'th-1-5', game: 'spider' },
    ],
  },
  'th-2': {
    host: 'sophia',
    board: 'rappahannock_riverside',
    deck: 'eastern_woodlands',
    levels: [
      { id: 'th-2-1', game: 'go-fish', opponent: 'sophia' },
      { id: 'th-2-2', game: 'klondike' },
      { id: 'th-2-3', game: 'freecell' },
      { id: 'th-2-4', game: 'spider' },
      { id: 'th-2-5', game: 'war', opponent: 'sophia' },
    ],
  },
} as const;

/** Finishes the challenge at the table and returns to Story Mode. */
async function finishAtTable(page: Page, level: { id: string; game: string }) {
  if (level.game === 'war') {
    const deal = action(page, 'deal');
    if (await deal.isVisible({ timeout: 1000 }).catch(() => false)) await deal.click();
    await page.locator(`${CURRENT} [data-action="auto"]`).click();
    const result = page.locator('.dialog-result');
    await expect(result).toBeVisible({ timeout: 90_000 });
    await expect(result.locator('[data-result]')).toHaveAttribute('data-result', 'win');
    await expect(action(page, 'menu')).toHaveText(/Continue story/);
    await action(page, 'menu').click();
  } else {
    await page.evaluate((id) => {
      const icp = (
        window as unknown as {
          __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
        }
      ).__ICP__;
      icp.storyResult(id, 'win');
      icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
    }, level.id);
  }
  await expectScreen(page, 'STORY_MODE');
}

/** The scene → versus → table for one challenge, already opened. */
async function playChallenge(page: Page, chapter: keyof typeof CHAPTERS, index: number) {
  const ch = CHAPTERS[chapter];
  const level = ch.levels[index]!;
  // The challenge's scene: the host speaks, with their own portrait; the objective is clear.
  const scene = page.locator('.dialog-scene');
  await expect(scene.locator('[data-objective]')).toBeVisible();
  // Either the host speaks or narration opens the scene (between beats both may briefly show).
  await expect(scene.locator(`[data-portrait="${ch.host}"]`).or(scene.locator('.is-narration')).first()).toBeVisible();
  await action(page, 'play').click();
  // The versus card names the opponent (or a solo challenge) and the game.
  const vs = page.locator(`[data-versus="${level.id}"]`);
  await expect(vs).toBeVisible();
  await expect(vs.locator(`[data-game="${level.game}"]`)).toBeVisible();
  if ('opponent' in level) await expect(vs.locator(`[data-opponent="${level.opponent}"] img`)).toBeVisible();
  await action(page, 'play').click();
  // The table: the chapter's board and deck.
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', ch.board);
  await expect(page.locator(`${CURRENT} .card[data-theme^="${ch.deck}@"]`).first()).toBeAttached();
  await finishAtTable(page, level);
  // Back in the story: the closing scene (if any), then the results.
  const outro = page.locator('.scene-outro');
  if (await outro.isVisible({ timeout: 2000 }).catch(() => false)) await action(page, 'ok').click();
  const result = page.locator('[data-story-result="complete"]');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-reward="credits"]').first()).toBeVisible();
  await expect(result.locator('[data-reward="xp"]').first()).toBeVisible();
  // Saved after every challenge.
  expect((await profile(page)).story.completed).toContain(level.id);
  await action(page, 'continue').click();
}

async function playChapter(page: Page, chapter: keyof typeof CHAPTERS) {
  await page.locator(`${CURRENT} [data-chapter="${chapter}"]`).click();
  // The arrival scene (first visit) can be read through or skipped; here it is read to its end.
  const stage = page.locator('.dialog-scene [data-scene]');
  if (await stage.isVisible({ timeout: 1500 }).catch(() => false)) {
    const lines = Number(await stage.getAttribute('data-lines'));
    for (let i = 1; i < lines; i++) await stage.click();
    await expect(stage).toHaveAttribute('data-line', String(lines - 1));
    await action(page, 'ok').click();
  }
  await expect(page.locator(`${CURRENT} [data-chapter-view="${chapter}"]`)).toBeVisible();
  await page.locator(`${CURRENT} [data-level="${chapter}-1"]`).click();
  for (let i = 0; i < 5; i++) await playChallenge(page, chapter, i);
  // Chapter complete: its closing scene with the passport stamp.
  const done = page.locator(`[data-chapter-complete="${chapter}"]`);
  await expect(done).toBeVisible();
  await expect(done.locator('img[data-story-sprite^="passport-stamps/"]')).toBeAttached();
  await action(page, 'ok').click();
}

test('the opening: Chapter 1 → Chapter 2 → Chapter 3 opens', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant', musicPaused: true } });
  await enterParlor(page);
  // Main menu → Story Mode: only the antique shop is open.
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter="th-1"]`)).toHaveAttribute('data-state', 'available');
  await expect(page.locator(`${CURRENT} [data-chapter="th-2"]`)).toHaveAttribute('data-state', 'locked');

  // ---- Chapter 1: Cheryl's Antique Shop ----
  await playChapter(page, 'th-1');
  let p = await profile(page);
  expect(p.story.stamps).toEqual(['th-antique-shop']);
  expect(p.story.evidence).toEqual(
    expect.arrayContaining(['thirteenth-hand-card', 'estate-sale-receipt', 'ledger-of-twelve', 'river-postcard']),
  );
  expect(p.unlockedBoards).toContain('cheryls_antique_shop');
  // The map reveals the river station.
  await expect(page.locator(`${CURRENT} [data-chapter="th-1"]`)).toHaveAttribute('data-state', 'completed');
  await expect(page.locator(`${CURRENT} [data-chapter="th-2"]`)).toHaveAttribute('data-state', 'available');
  await expect(page.locator(`${CURRENT} [data-chapter="th-2"]`)).toHaveAccessibleName(/Rappahannock River Station/);

  // ---- Chapter 2: Sophia's Rappahannock River Station ----
  // Optional field notes are there to read.
  await page.locator(`${CURRENT} [data-chapter="th-2"]`).click();
  await action(page, 'skip').click();
  await page.locator(`${CURRENT} [data-action="field-notes"]`).click();
  await expect(page.locator('[data-info-card="great-blue-heron"]')).toContainText('largest heron in North America');
  await expect(page.locator('[data-info-card="eastern-woodlands-deck"]')).toContainText('visual theme');
  await action(page, 'undefined').click();
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await playChapter(page, 'th-2');

  // ---- Chapter 3 opens: a real chapter now, not a preview ----
  await expect(page.locator('[data-adventure-continues]')).toHaveCount(0);
  p = await profile(page);
  expect(p.story.stamps).toEqual(['th-antique-shop', 'th-river-station']);
  expect(p.story.evidence).toEqual(
    expect.arrayContaining(['field-journal-page', 'club-mark', 'sophia-river-map', 'returned-envelope']),
  );
  expect(p.unlockedDecks).toContain('eastern_woodlands');
  expect(p.story.completed).toHaveLength(10);
  expect(new Set(p.story.rewarded).size).toBe(p.story.rewarded.length);
  // Dante's shop is open; only the next place is shown (locked); nothing past it is revealed.
  await expect(page.locator(`${CURRENT} [data-chapter="th-3"]`)).toHaveAttribute('data-state', 'available');
  await expect(page.locator(`${CURRENT} [data-chapter="th-3"]`)).toHaveAccessibleName(/iSMOKESHOP/);
  await expect(page.locator(`${CURRENT} [data-chapter="th-4"]`)).toHaveAttribute('data-state', 'locked');
  await expect(page.locator(`${CURRENT} [data-chapter="th-5"]`)).toHaveAttribute('data-state', 'undiscovered');
  // Opening it plays Dante's arrival scene, then shows its five challenges.
  await page.locator(`${CURRENT} [data-chapter="th-3"]`).click();
  // It opens with narration; Dante speaks on the next line.
  await expect(page.locator('.dialog-scene .is-narration')).toBeVisible();
  await page.locator('.dialog-scene [data-scene]').click();
  await expect(page.locator('.dialog-scene [data-portrait="dante"]')).toBeVisible();
  await action(page, 'skip').click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-3"]`)).toBeVisible();
  await expect(page.locator(`${CURRENT} [data-level="th-3-1"] [data-challenge-state]`)).toHaveText('Start');
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="story-chapter"]`)).toHaveText('Chapter 3 · Neon Commission');
  await expect(page.locator(`${CURRENT} [data-value="story-progress"]`)).toHaveText('10/45 challenges · 2/9 stamps');

  // Resume after a reload: everything kept, nothing paid twice.
  const before = await profile(page);
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  const after = await profile(page);
  expect(after.story).toEqual(before.story);
  expect(after.credits).toBe(before.credits);
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} .stamp.earned img`)).toHaveCount(2);
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  await expect(page.locator(`${CURRENT} [data-journal-objective]`)).toContainText('Chapter 3 · Monster Sketches');
  await expect(page.locator(`${CURRENT} [data-clue-count]`)).toHaveText('8 clues found');
});

test('resumes at the latest valid progress: the current challenge is ready on the map and chapter', async ({
  page,
}) => {
  await seed(page, {
    profile: {
      schemaVersion: 3,
      story: {
        campaign: 'thirteenth-hand',
        version: 2,
        completed: ['th-1-1', 'th-1-2', 'th-1-3', 'th-1-4', 'th-1-5', 'th-2-1', 'th-2-2'],
        rewarded: [],
        stamps: ['th-antique-shop'],
        introsSeen: ['th-1', 'th-2'],
        attempts: {},
        evidence: ['thirteenth-hand-card'],
      },
      storyChapter: 1,
    },
  });
  await enterParlor(page);
  await expect(page.locator(`${CURRENT} [data-value="story-chapter"]`)).toHaveText('Chapter 2 · The Heron’s Bend');
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter="th-2"]`)).toHaveAttribute('aria-current', 'step');
  await page.locator(`${CURRENT} [data-chapter="th-2"]`).click();
  await expect(page.locator(`${CURRENT} [data-level="th-2-3"] [data-challenge-state]`)).toHaveText('Start');
  await expect(await revealInPager(page, '[data-level="th-2-4"]')).toHaveClass(/locked/);
});
