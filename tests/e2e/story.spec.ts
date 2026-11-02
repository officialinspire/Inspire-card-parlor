import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickInPager, clickNav, enterParlor, expectNoOverflow, expectScreen, seed } from './helpers';

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: 'block' });

type Profile = {
  credits: number;
  unlockedDecks: string[];
  unlockedBoards: string[];
  story: { completed: string[]; rewarded: string[]; stamps: string[]; evidence: string[]; introsSeen: string[] };
};
const profile = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ICP__: { store: { state: { profile: Profile } } } }).__ICP__.store.state.profile,
  );

const chapterLevels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `th-${n}-${i + 1}`);
const allLevels = () => [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => chapterLevels(n));
/** Story progress as this build saves it. */
const story = (over: Record<string, unknown>) => ({
  campaign: 'thirteenth-hand',
  version: 1,
  completed: [],
  rewarded: [],
  stamps: [],
  introsSeen: [],
  attempts: {},
  evidence: [],
  ...over,
});
const tile = (page: Page, chapter: string) => page.locator(`${CURRENT} [data-chapter="${chapter}"]`);
const view = (page: Page) => page.locator(`${CURRENT} [data-story-view]`).getAttribute('data-story-view');

async function openStory(page: Page) {
  await clickNav(page, 'STORY_MODE');
  await expect(tile(page, 'th-1')).toBeVisible();
}

/** Opens a chapter from the map (skipping its intro if shown). */
async function openChapter(page: Page, chapter: string) {
  await tile(page, chapter).click();
  const skip = action(page, 'skip');
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="${chapter}"]`)).toBeVisible();
}

/** Starts a challenge: its scene, then the versus card, then the table. */
async function playLevel(page: Page, chapter: string, level: string) {
  await openChapter(page, chapter);
  await clickInPager(page, `[data-level="${level}"]`);
  await expect(page.locator('.dialog-scene [data-objective]')).toBeVisible();
  await action(page, 'play').click();
  await expect(page.locator(`[data-versus="${level}"]`)).toBeVisible();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
}

/** War challenges: auto-play the verified deal at full speed, then go back to the story. */
async function autoWar(page: Page) {
  const deal = action(page, 'deal');
  if (await deal.isVisible({ timeout: 1500 }).catch(() => false)) await deal.click();
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  const result = page.locator('.dialog-result');
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result.locator('[data-result]')).toHaveAttribute('data-result', 'win');
  await action(page, 'menu').click(); // "Story map"
  await expectScreen(page, 'STORY_MODE');
}

/** Records a finished story game through the real results path, then returns to Story Mode. */
async function finish(page: Page, levelId: string, outcome: 'win' | 'loss') {
  await page.evaluate(
    ({ levelId, outcome }) => {
      const icp = (
        window as unknown as {
          __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
        }
      ).__ICP__;
      icp.storyResult(levelId, outcome);
      icp.store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
      icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
    },
    { levelId, outcome },
  );
  await expectScreen(page, 'STORY_MODE');
}

test('the map: only Chapter 1 is open; the next place is locked; the rest undiscovered', async ({ page }) => {
  await enterParlor(page);
  await openStory(page);
  expect(await view(page)).toBe('map');
  await expect(tile(page, 'th-1')).toHaveAttribute('data-state', 'available');
  await expect(tile(page, 'th-1')).toHaveAttribute('aria-current', 'step');
  await expect(tile(page, 'th-1')).toHaveAccessibleName(/Chapter 1: Cheryl’s Antique Shop/);
  await expect(tile(page, 'th-1')).toHaveAccessibleDescription(/antique shop/i);
  await expect(tile(page, 'th-2')).toHaveAttribute('data-state', 'locked');
  for (const n of [3, 4, 5, 6, 7, 8, 9]) {
    await expect(tile(page, `th-${n}`)).toHaveAttribute('data-state', 'undiscovered');
    await expect(tile(page, `th-${n}`)).toHaveAccessibleName(/Undiscovered location/);
  }
  // Locked and undiscovered places explain themselves instead of opening.
  await tile(page, 'th-2').click();
  await expect(page.locator('.toast', { hasText: 'Finish Chapter 1' })).toBeVisible();
  await tile(page, 'th-5').click();
  await expect(page.locator('.toast', { hasText: 'Keep following the clues' })).toBeVisible();
  expect(await view(page)).toBe('map');
  await expectNoOverflow(page);
});

test('a challenge from intro to reward; rewards persist and are paid only once', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await openStory(page);
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(0);

  // First visit plays the chapter's arrival scene, which can be skipped; it reveals the card.
  await tile(page, 'th-1').click();
  await expect(page.locator('.dialog-scene')).toContainText('The Card Without a Suit');
  await action(page, 'skip').click();
  await expect.poll(async () => (await profile(page)).story.evidence).toContain('thirteenth-hand-card');
  await expect(page.locator(`${CURRENT} [data-level="th-1-1"]`)).toHaveAttribute('aria-label', /Start/);
  await expect(page.locator(`${CURRENT} [data-level="th-1-2"]`)).toHaveClass(/locked/);
  await page.locator(`${CURRENT} [data-action="chapter-intro"]`).click(); // replay the arrival on demand
  await action(page, 'skip').click();

  // Scene → versus → table.
  await page.locator(`${CURRENT} [data-level="th-1-1"]`).click();
  await expect(page.locator('.dialog-scene [data-objective]')).toContainText('Win War against Cheryl');
  await expect(page.locator('.dialog-scene [data-rewards]')).toContainText('credits');
  await action(page, 'play').click();
  const vs = page.locator('[data-versus="th-1-1"]');
  await expect(vs).toBeVisible();
  await expect(vs.locator('[data-opponent="cheryl"]')).toContainText('Cheryl');
  await expect(vs.locator('[data-game="war"]')).toHaveText('War');
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board', 'cheryls_antique_shop');
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toContainText('Price Check');
  const before = (await profile(page)).credits;
  await autoWar(page);

  // The challenge's closing scene reveals evidence, then the results.
  await expect(page.locator('.scene-outro [data-found="estate-sale-receipt"]')).toBeVisible();
  await action(page, 'ok').click();
  const result = page.locator('[data-story-result="complete"]');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-reward="credits"]')).toBeVisible();
  await expect(result.locator('[data-reward="evidence"]')).toContainText('Estate-sale receipt');
  // Continue Story goes straight on to the next challenge's scene; "Not now" returns to the chapter.
  await action(page, 'continue').click();
  await expect(page.locator('.dialog-scene')).toContainText('Sorting the Box');
  await action(page, 'cancel').click();
  await expect(page.locator(`${CURRENT} [data-level="th-1-1"]`)).toHaveClass(/done/);
  await expect(page.locator(`${CURRENT} [data-level="th-1-1"] [data-challenge-state]`)).toHaveText('Replay');
  await expect(page.locator(`${CURRENT} [data-level="th-1-2"]`)).not.toHaveClass(/locked/);
  const after = await profile(page);
  expect(after.story.completed).toContain('th-1-1');
  expect(after.story.evidence).toContain('estate-sale-receipt');
  expect(after.credits).toBeGreaterThan(before);

  // Survives a reload.
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  const reloaded = await profile(page);
  expect(reloaded.story.completed).toContain('th-1-1');
  expect(reloaded.story.rewarded).toContain('level:th-1-1');
  expect(reloaded.story.evidence).toEqual(after.story.evidence);

  // Replaying pays nothing more (the War itself still pays its usual game credits).
  await openStory(page);
  await playLevel(page, 'th-1', 'th-1-1');
  const replayStart = (await profile(page)).credits;
  await autoWar(page);
  await expect(page.locator('[data-story-result="complete"]')).toContainText('already collected');
  await action(page, 'map').click();
  expect(await view(page)).toBe('map');
  const replayEnd = (await profile(page)).credits;
  expect(replayEnd - replayStart).toBeLessThanOrEqual(30); // only the normal War win, no story reward
});

test('finishing a chapter stamps the passport, grants its rewards and opens the next place', async ({ page }) => {
  await seed(page, {
    settings: { warSpeed: 'instant' },
    profile: {
      // Everything but Chapter 2's War finale (th-2-5) is done.
      story: story({
        version: 2,
        completed: [...chapterLevels(1), ...chapterLevels(2, 4)],
        rewarded: [...chapterLevels(1), ...chapterLevels(2, 4)].map((id) => `level:${id}`).concat('chapter:th-1'),
        stamps: ['th-antique-shop'],
        introsSeen: ['th-1', 'th-2'],
      }),
      storyChapter: 1,
      schemaVersion: 3,
    },
  });
  await enterParlor(page);
  await openStory(page);
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(1);
  await expect(page.locator(`${CURRENT} [data-stamp="th-antique-shop"] img`)).toHaveAttribute(
    'data-story-sprite',
    'passport-stamps/antique-clock-key',
  );
  await expect(tile(page, 'th-1')).toHaveAttribute('data-state', 'completed');
  await expect(tile(page, 'th-3')).toHaveAttribute('data-state', 'locked');
  await playLevel(page, 'th-2', 'th-2-5');
  await autoWar(page);
  await action(page, 'ok').click(); // closing scene
  await expect(page.locator('[data-story-result="complete"]')).toContainText('passport stamped');
  await action(page, 'continue').click();
  const done = page.locator('[data-chapter-complete="th-2"]');
  await expect(done).toBeVisible();
  await expect(done).toContainText('Eastern Woodlands deck');
  await expect(done).toContainText('Passport stamp');
  await expect(done.locator('img[data-story-sprite="passport-stamps/heron-river"]')).toBeAttached();
  await action(page, 'ok').click();
  // The demo ends: Chapter 3 is previewed, not offered as playable.
  await expect(page.locator('[data-adventure-continues="th-3"]')).toBeVisible();
  await action(page, 'map').click();
  const p = await profile(page);
  expect(p.story.stamps).toEqual(['th-antique-shop', 'th-river-station']);
  expect(p.unlockedDecks).toContain('eastern_woodlands');
  expect(p.unlockedBoards).toContain('rappahannock_riverside');
  // Back on the map: two stamps, Chapter 3 a preview, nothing beyond it revealed.
  expect(await view(page)).toBe('map');
  await expect(page.locator(`${CURRENT} .stamp.earned`)).toHaveCount(2);
  await expect(tile(page, 'th-2')).toHaveAttribute('data-state', 'completed');
  await expect(tile(page, 'th-3')).toHaveAttribute('data-state', 'preview');
  await expect(tile(page, 'th-4')).toHaveAttribute('data-state', 'undiscovered');
});

test('the dialogue engine: tap or keys to advance, back, narration apart from speech, skip', async ({ page }) => {
  await enterParlor(page);
  await openStory(page);
  await tile(page, 'th-1').click();
  const stage = page.locator('.dialog-scene [data-scene]');
  await expect(stage).toHaveAttribute('data-line', '0');
  const lines = Number(await stage.getAttribute('data-lines'));
  expect(lines).toBeGreaterThan(3);
  // Line 1 is narration: parchment, no portrait, no speaker.
  await expect(stage.locator('.scene-beat')).toHaveClass(/is-narration/);
  await expect(stage.locator('[data-portrait]')).toHaveCount(0);
  // Tap to advance: Cheryl speaks, with her portrait and nameplate.
  await stage.click();
  await expect(stage).toHaveAttribute('data-line', '1');
  await expect(stage.locator('.scene-beat')).toHaveClass(/is-speech/);
  await expect(stage.locator('[data-speaker-name]')).toHaveText('Cheryl');
  await expect(stage.locator('[data-portrait="cheryl"] img')).toHaveAttribute('data-story-sprite', /^cheryl\//);
  // Keyboard: → advances, ← goes back.
  await stage.focus();
  await page.keyboard.press('ArrowRight');
  await expect(stage).toHaveAttribute('data-line', '2');
  await page.keyboard.press('ArrowLeft');
  await expect(stage).toHaveAttribute('data-line', '1');
  await page.locator('[data-scene-nav="next"]').click();
  await page.locator('[data-scene-nav="next"]').click();
  await page.locator('[data-scene-nav="next"]').click();
  await expect(stage).toHaveAttribute('data-line', '4');
  // The discovery beat shows what was found.
  await expect(stage.locator('[data-found="thirteenth-hand-card"]')).toContainText('Added to your journal');
  // No beat is ever the player's: every speaker is a character or the narrator.
  const speakers = await page.evaluate(async () => {
    const out: string[] = [];
    const s = document.querySelector<HTMLElement>('.dialog-scene [data-scene]')!;
    for (let i = 0; i < Number(s.dataset.lines); i++) {
      out.push(s.querySelector<HTMLElement>('[data-speaker]')!.dataset.speaker!);
      s.click();
      await new Promise((r) => setTimeout(r, 30));
    }
    return out;
  });
  expect(new Set(speakers)).toEqual(new Set(['narrator', 'cheryl']));
  await action(page, 'skip').click();
  await expect(page.locator('.dialog-scene')).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
});

test('journal: objective, clues to inspect, chapter summaries, scene replay; back steps through views', async ({
  page,
}) => {
  await seed(page, {
    profile: {
      story: story({
        completed: chapterLevels(1),
        rewarded: chapterLevels(1).map((id) => `level:${id}`),
        stamps: ['th-antique-shop'],
        introsSeen: ['th-1'],
        evidence: ['thirteenth-hand-card', 'estate-sale-receipt', 'ledger-of-twelve', 'river-postcard'],
      }),
      storyChapter: 1,
      schemaVersion: 3,
    },
  });
  await enterParlor(page);
  await openStory(page);
  await openChapter(page, 'th-2');
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  expect(await view(page)).toBe('journal');
  await expect(page.locator(`${CURRENT} [data-journal-objective]`)).toContainText('Field Notes');
  await expect(page.locator(`${CURRENT} [data-clue-count]`)).toHaveText('4 clues found');
  await expectNoOverflow(page);
  // Inspect a clue: its artwork large, its text as real text.
  await clickInPager(page, '[data-clue="ledger-of-twelve"]');
  const detail = page.locator('[data-clue-detail="ledger-of-twelve"]');
  await expect(detail).toContainText('the thirteenth line is blank');
  await expect(detail).toContainText('Key clue');
  await expect(detail.locator('img')).toHaveAttribute('data-story-sprite', 'mystery-parlor/leather-journal');
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  // Chapter summaries: solved chapters say what they added; open ones are in progress.
  await page.locator(`${CURRENT} [data-tab="chapters"]`).click();
  await expect(page.locator(`${CURRENT} [data-journal-chapter="th-1"]`)).toContainText('Lot 13');
  await expect(page.locator(`${CURRENT} [data-journal-chapter="th-2"]`)).toContainText('In progress');
  // Scenes already seen can be replayed.
  await page.locator(`${CURRENT} [data-tab="scenes"]`).click();
  await clickInPager(page, '[data-replay="th-1:intro"]');
  await expect(page.locator('.scene-replay [data-scene]')).toBeVisible();
  await action(page, 'ok').click();
  // Back: journal → chapter → map → menu (header Back and Escape alike).
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-2"]`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => view(page)).toBe('map');
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'MAIN_MENU');
});

test('results: a defeat offers retry, chapter or map and never traps; a win continues the story', async ({ page }) => {
  await seed(page, {
    profile: { story: story({ introsSeen: ['th-1'] }), schemaVersion: 3 },
  });
  await enterParlor(page);
  await finish(page, 'th-1-1', 'loss');
  const lost = page.locator('[data-story-result="retry"]');
  await expect(lost).toBeVisible();
  await expect(page.locator('.dialog-story-result')).toHaveClass(/result-loss/);
  await expect(action(page, 'retry')).toBeVisible();
  await expect(action(page, 'map')).toBeVisible();
  // Escape leaves it, to the chapter.
  await page.keyboard.press('Escape');
  await expect(lost).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
  // Retry goes straight to the versus card (no scene again).
  await finish(page, 'th-1-1', 'loss');
  await action(page, 'retry').click();
  await expect(page.locator('[data-versus="th-1-1"]')).toBeVisible();
  await action(page, 'back').click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
  // A win: Map from the results goes to the map.
  await finish(page, 'th-1-1', 'win');
  await action(page, 'ok').click(); // closing scene
  await expect(page.locator('.dialog-story-result')).toHaveClass(/result-win/);
  await action(page, 'map').click();
  expect(await view(page)).toBe('map');
  const p = await profile(page);
  expect(p.story.completed).toEqual(['th-1-1']);
});

test('story artwork that fails to load never blocks play', async ({ page }) => {
  await page.route('**/assets/story/**', (r) => r.abort());
  await enterParlor(page);
  await openStory(page);
  await expect(page.locator(`${CURRENT} [data-chapter]`)).toHaveCount(9);
  await openChapter(page, 'th-1');
  await page.locator(`${CURRENT} [data-level="th-1-1"]`).click();
  await expect(page.locator('.dialog-scene [data-scene]')).toBeVisible();
  await action(page, 'play').click();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
});

test('every challenge launches with its own game, deck and table, and seeded deals repeat exactly', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone-portrait', 'one layout is enough to launch all 45');
  await seed(page, { profile: { story: story({ completed: allLevels() }), storyChapter: 9, schemaVersion: 3 } });
  await enterParlor(page);
  const levels = await page.evaluate(
    () =>
      (
        window as unknown as {
          __ICP__: { story: { id: string; game: string; deck: string; board: string; seeded: boolean }[] };
        }
      ).__ICP__.story,
  );
  expect(levels).toHaveLength(45);
  const launch = async (id: string) => {
    await page.evaluate((levelId) => {
      const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
      s.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
      s.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
      s.dispatch({ type: 'SELECT_STORY_LEVEL', levelId, chapterId: levelId.replace(/-\d$/, '') });
      s.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
    }, id);
    await expectScreen(page, 'GAMEPLAY');
    const fresh = action(page, 'new');
    if (await fresh.isVisible({ timeout: 800 }).catch(() => false)) await fresh.click();
    await expect(action(page, 'deal')).toHaveCount(0); // no options dialog in story
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
  await playLevel(page, 'th-1', 'th-1-1');
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  await expect(action(page, 'deal')).toBeVisible();
  await action(page, 'deal').click();
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toHaveText('BlackJak Standard · Backroom Card Table');
});

test('story screens fit every layout without scrolling', async ({ page }) => {
  await seed(page, {
    profile: {
      story: story({ completed: [...chapterLevels(1), ...chapterLevels(2)], evidence: ['thirteenth-hand-card'] }),
      schemaVersion: 3,
    },
  });
  await enterParlor(page);
  await openStory(page);
  await expectNoOverflow(page);
  await tile(page, 'th-2').click();
  await action(page, 'skip').click();
  await expectNoOverflow(page);
  await clickInPager(page, '[data-level="th-2-2"]');
  for (const dialog of ['.dialog-scene', '.dialog-versus']) {
    const d = page.locator(dialog);
    await expect(d).toBeVisible();
    const box = (await d.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.y + box.height, dialog).toBeLessThanOrEqual(vp.height + 1);
    await expect(action(page, 'play')).toBeInViewport();
    await action(page, 'play').click();
    if (dialog === '.dialog-versus') break;
  }
  await expectScreen(page, 'GAMEPLAY');
  await clickNav(page, 'home', 'MAIN_MENU');
  await openStory(page);
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  await expectNoOverflow(page);
});
