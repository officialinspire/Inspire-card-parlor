import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, enterParlor, expectScreen, seed } from './helpers';
import { layoutIssues } from './layout-checks';

/**
 * Responsive layout and typography (Prompt 28), on every phone, tablet and
 * desktop project: no screen or story dialog overflows, cuts text, hides or
 * covers a control, or slips outside the viewport; dialogs keep focus and
 * catch stray taps; the menu survives turning the phone.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
test.beforeEach(({}, info) => {
  test.skip(['mature-edition', 'github-pages'].includes(info.project.name), 'same layout as desktop');
});

const levels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `th-${n}-${i + 1}`);
/** Mid-campaign: chapters 1–7 done, Chapter 8 at its door, Chapter 3's arrival not yet seen. */
const midCampaign = {
  settings: { musicPaused: true, warSpeed: 'instant' },
  profile: {
    schemaVersion: 3,
    level: 14,
    credits: 2400,
    storyChapter: 7,
    story: {
      campaign: 'thirteenth-hand',
      version: 2,
      completed: [...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => levels(n)), ...levels(8, 4)],
      rewarded: [],
      stamps: ['th-antique-shop', 'th-river-station', 'th-neon-monster', 'th-cards-camera', 'th-dossier'],
      introsSeen: ['th-1', 'th-2', 'th-4', 'th-5', 'th-6', 'th-7', 'th-8'],
      attempts: {},
      evidence: ['thirteenth-hand-card', 'ledger-of-twelve', 'club-mark', 'heart-mark', 'diamond-mark', 'spade-mark'],
    },
  },
};

const go = (page: Page, path: string[]) =>
  page.evaluate((path) => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    for (const to of path) s.dispatch({ type: 'NAVIGATE', to });
  }, path);

/** Lets a screen or dialog settle (transitions are off with reduced motion; fonts and pagers may still lay out). */
const settle = (page: Page) => page.waitForTimeout(350);

async function expectClean(page: Page, where: string, noPageScroll = false) {
  await settle(page);
  expect(await layoutIssues(page, { noPageScroll }), where).toEqual([]);
}

const SCREENS: [string, string[]][] = [
  ['main menu', []],
  ['card games', ['GAME_SELECTION']],
  ['deck selection', ['GAME_SELECTION', 'DECK_SELECTION']],
  ['board selection', ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION']],
  ['collection', ['COLLECTION']],
  ['gameboards', ['GAMEBOARDS']],
  ['passport', ['PASSPORT']],
  ['achievements', ['ACHIEVEMENTS']],
  ['statistics', ['STATISTICS']],
  ['story map', ['STORY_MODE']],
];

test('every screen fits: no overflow, no clipped text, every control reachable and uncovered', async ({ page }) => {
  await seed(page, midCampaign);
  await enterParlor(page);
  await page.addStyleTag({ content: '.toast-region { display: none !important; }' });
  for (const [where, path] of SCREENS) {
    await go(page, path);
    await expectClean(page, where, true);
  }
  await go(page, ['SETTINGS']);
  for (const tab of ['audio', 'music', 'display', 'gameplay', 'content', 'data']) {
    const t = page.locator(`${CURRENT} [data-tab="${tab}"]`);
    if (!(await t.count())) continue;
    await t.click();
    await expectClean(page, `settings: ${tab}`, true);
  }
  // Story: a chapter's challenges and every journal tab.
  await go(page, ['STORY_MODE']);
  await page.locator(`${CURRENT} [data-chapter="th-2"]`).click();
  await expectClean(page, 'chapter view', true);
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  for (const tab of ['clues', 'chapters', 'scenes']) {
    const t = page.locator(`${CURRENT} [data-tab="${tab}"]`);
    if (await t.count()) await t.click();
    await expectClean(page, `journal: ${tab}`, true);
  }
  // A chapter summary reads in full in its own dialog.
  await page.locator(`${CURRENT} [data-tab="chapters"]`).click();
  await page.locator(`${CURRENT} [data-journal-chapter="th-1"]`).click();
  await expect(page.locator('[data-summary-detail="th-1"]')).toContainText('Lot 13');
  await expectClean(page, 'journal: chapter summary');
});

test('story dialogs fit: every scene line, the brief, versus, results, the door, the ending', async ({ page }) => {
  await seed(page, midCampaign);
  await enterParlor(page);
  await page.addStyleTag({ content: '.toast-region { display: none !important; }' });
  await go(page, ['STORY_MODE']);
  // Chapter 3's arrival: check every line, and that the controls never move between lines.
  await page.locator(`${CURRENT} [data-chapter="th-3"]`).click();
  const stage = page.locator('.dialog-scene [data-scene]');
  const lines = Number(await stage.getAttribute('data-lines'));
  const next = page.locator('[data-scene-nav="next"]');
  // Wait for the dialog's entrance (a short tilt into place) to finish before measuring.
  await page.waitForFunction(() => {
    const d = document.querySelector('.dialog-backdrop:not([aria-hidden]) .dialog');
    return !!d && getComputedStyle(d).transform === 'none';
  });
  let at: number | null = null;
  for (let i = 0; i < lines; i++) {
    await expectClean(page, `chapter 3 arrival, line ${i + 1}`);
    // The portrait never sits over the line it speaks.
    const over = await page.evaluate(() => {
      const p = document.querySelector('.dialog-scene .scene-portrait')?.getBoundingClientRect();
      const t = document.querySelector('.dialog-scene .scene-text')?.getBoundingClientRect();
      if (!p || !t) return 0;
      return (
        Math.max(0, Math.min(p.right, t.right) - Math.max(p.left, t.left)) *
        Math.max(0, Math.min(p.bottom, t.bottom) - Math.max(p.top, t.top))
      );
    });
    expect(over, `portrait over text on line ${i + 1}`).toBe(0);
    const y = (await next.boundingBox())!.y;
    if (at === null) at = y;
    expect(Math.abs(y - at), `Next moved on line ${i + 1}`).toBeLessThanOrEqual(1);
    if (i < lines - 1) await next.click();
  }
  await action(page, 'ok').click();
  // The challenge brief, then the versus card.
  await page.locator(`${CURRENT} [data-level="th-3-1"]`).click();
  await expectClean(page, 'challenge brief');
  await action(page, 'play').click();
  await expect(page.locator('[data-versus="th-3-1"]')).toBeVisible();
  await expectClean(page, 'versus card');
  await action(page, 'back').click();
  // Results after a loss.
  await page.evaluate(() => {
    const icp = (
      window as unknown as {
        __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
      }
    ).__ICP__;
    icp.storyResult('th-3-1', 'loss');
    icp.store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
  });
  await expect(page.locator('[data-story-result="retry"]')).toBeVisible();
  await expectClean(page, 'results (loss)');
  await action(page, 'map').click();
  // The Chapter 8 door.
  await page.locator(`${CURRENT} [data-chapter="th-8"]`).click();
  for (let k = 0; k < 5 && !(await page.locator(`${CURRENT} [data-level="th-8-5"]`).isVisible()); k++)
    await page.locator(`${CURRENT} [data-pager="next"]`).click();
  await page.locator(`${CURRENT} [data-level="th-8-5"]`).click();
  await action(page, 'play').click();
  await expect(page.locator('.dialog-suit-puzzle')).toBeVisible();
  await expectClean(page, 'the four-suit door');
  await page.keyboard.press('Escape');
  // The finale's results, the chapter's closing panel, the epilogue and the rematches.
  await page.evaluate(() => {
    const icp = (
      window as unknown as {
        __ICP__: {
          storyResult(id: string, o: string): void;
          store: { state: { profile: { story: object } }; dispatch(a: unknown): void };
        };
      }
    ).__ICP__;
    const all: string[] = [];
    for (let c = 1; c <= 9; c++) for (let l = 1; l <= 5; l++) if (!(c === 9 && l === 5)) all.push(`th-${c}-${l}`);
    const story = icp.store.state.profile.story;
    icp.store.dispatch({
      type: 'UPDATE_PROFILE',
      patch: { story: { ...story, completed: all, introsSeen: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `th-${n}`) } },
    });
    icp.storyResult('th-9-5', 'win');
    icp.store.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
  });
  await expect(page.locator('.scene-outro')).toBeVisible();
  await expectClean(page, 'finale closing scene');
  await action(page, 'ok').click();
  await expect(page.locator('[data-story-result="complete"]')).toBeVisible();
  await expectClean(page, 'results (finale)');
  await action(page, 'continue').click();
  await expect(page.locator('[data-chapter-complete="th-9"]')).toBeVisible();
  await expectClean(page, 'chapter complete');
  await action(page, 'ok').click();
  await expect(page.locator('.scene-epilogue')).toBeVisible();
  await expectClean(page, 'epilogue');
  await action(page, 'ok').click();
  await expect(page.locator('[data-rematches]')).toBeVisible();
  await expectClean(page, 'ghost rematches');
});

test('dialogs keep focus inside, give it back on close, and catch a stray second tap', async ({ page }) => {
  await seed(page, midCampaign);
  await enterParlor(page);
  await go(page, ['STORY_MODE']);
  const opener = page.locator(`${CURRENT} [data-chapter="th-3"]`);
  // The map redraws once its artwork arrives: focus a tile only after that, or the tile is replaced.
  await expect(opener.locator('img[data-story-sprite]').first()).toBeVisible();
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('.dialog-backdrop:not([aria-hidden]) .dialog');
  await expect(dialog).toBeVisible();
  // Tab and Shift+Tab never leave the open dialog.
  for (const key of [...Array(12).fill('Tab'), ...Array(6).fill('Shift+Tab')]) {
    await page.keyboard.press(key);
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('.dialog-backdrop:not([aria-hidden])')),
      `focus after ${key}`,
    ).toBe(true);
  }
  // Closing with Escape returns focus to where it was.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.closest('.screen:not([aria-hidden])') !== null)).toBe(true);
  // A second tap right after a dialog closes lands on the shield, not on the screen beneath.
  await page.locator(`${CURRENT} [data-action="chapter-intro"]`).click();
  const skip = action(page, 'skip');
  const box = (await skip.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.className ?? '', [x, y]);
  expect(under).toContain('dialog-shield');
  await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  await expect(page.locator('.dialog-backdrop:not([aria-hidden])')).toHaveCount(0);
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-3"]`)).toBeVisible();
});

test('turning the phone: the menu re-lays out in both orientations with nothing cut or hidden', async ({
  page,
}, info) => {
  test.skip(!['phone-portrait', 'small-phone', 'phone-landscape'].includes(info.project.name), 'phones only');
  await enterParlor(page);
  await page.addStyleTag({ content: '.toast-region { display: none !important; }' });
  const size = page.viewportSize()!;
  for (const vp of [size, { width: size.height, height: size.width }, size]) {
    await page.setViewportSize(vp);
    await expectScreen(page, 'MAIN_MENU');
    await expectClean(page, `menu at ${vp.width}x${vp.height}`, true);
    const landscape = vp.width > vp.height;
    const { panel, stage } = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(`.screen:not([aria-hidden]) ${s}`)!.getBoundingClientRect();
      return { panel: r('.menu-panel'), stage: r('.menu-stage') };
    });
    // Portrait: the painting above the menu; landscape: beside it.
    if (landscape) expect(panel.right, 'panel beside the painting').toBeLessThanOrEqual(stage.left + 12);
    else expect(panel.top, 'panel below the painting').toBeGreaterThanOrEqual(stage.top);
    // Every tile label shows whole.
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.screen:not([aria-hidden]) .menu-tile-label')]
        .filter((l) => l.scrollWidth > l.clientWidth + 1)
        .map((l) => l.textContent),
    );
    expect(cut, `cut labels at ${vp.width}x${vp.height}`).toEqual([]);
  }
});
