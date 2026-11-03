import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickInPager, enterParlor, seed } from './helpers';
import { layoutIssues } from './layout-checks';

/**
 * Every line of the revised Chapter 1–4 scenes fits on a small phone and a
 * phone on its side: arrivals, each challenge's opening (with its brief),
 * each challenge's closing scene and each departure. Lines are checked one
 * by one, so a long beat can't push the controls off screen or clip.
 */
test.describe.configure({ timeout: 300_000 });
test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'sizes are set by the test');
});

const CHAPTERS = [1, 2, 3, 4];
const levels = (n: number) => Array.from({ length: 5 }, (_, i) => `th-${n}-${i + 1}`);
const SIZES = [
  [320, 568],
  [667, 375],
] as const;

/** Pages through the journal until a tile shows (it lists every scene seen in four chapters, so it can run long). */
async function reveal(page: Page, selector: string) {
  const target = page.locator(`${CURRENT} ${selector}`);
  await page.locator(`${CURRENT} .pager-grid > *`).first().waitFor();
  for (let i = 0; i < 40 && !(await target.isVisible()); i++)
    await page.locator(`${CURRENT} [data-pager="next"]`).click();
  await target.click();
}

async function settle(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
  await page.waitForTimeout(120);
}

/** Steps through the open scene, checking the layout on every line. */
async function everyLine(page: Page, where: string) {
  const stage = page.locator('.dialog-scene [data-scene]');
  await expect(stage).toBeVisible();
  const lines = Number(await stage.getAttribute('data-lines'));
  expect(lines, where).toBeGreaterThan(0);
  for (let i = 0; i < lines; i++) {
    await settle(page);
    expect(await layoutIssues(page), `${where}, line ${i + 1}/${lines}`).toEqual([]);
    if (i < lines - 1) await page.locator('[data-scene-nav="next"]').click();
  }
}

for (const [w, h] of SIZES)
  for (const n of CHAPTERS)
    test(`Chapter ${n}: every scene line fits at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const done = CHAPTERS.flatMap(levels);
      await seed(page, {
        settings: { musicPaused: true },
        profile: {
          schemaVersion: 3,
          storyChapter: 4,
          story: {
            campaign: 'thirteenth-hand',
            version: 2,
            completed: done,
            rewarded: done.map((id) => `level:${id}`),
            stamps: [],
            introsSeen: CHAPTERS.map((n) => `th-${n}`),
            attempts: {},
            evidence: [],
          },
        },
      });
      await enterParlor(page);
      await page.addStyleTag({ content: '.toast-region { display: none !important; }' });
      await page.evaluate(() =>
        (window as unknown as { __ICP__: { navigate(to: string): void } }).__ICP__.navigate('STORY_MODE'),
      );
      {
        const ch = `th-${n}`;
        // Each challenge's opening scene, with its brief.
        await page.locator(`${CURRENT} [data-chapter="${ch}"]`).click();
        await expect(page.locator(`${CURRENT} [data-chapter-view="${ch}"]`)).toBeVisible();
        for (const id of levels(n)) {
          await clickInPager(page, `[data-level="${id}"]`);
          await everyLine(page, `${id} opening`);
          await action(page, 'cancel').click();
          await expect(page.locator('.dialog-scene')).toHaveCount(0);
        }
        // The arrival, every closing scene and the departure, replayed from the journal.
        await page.locator(`${CURRENT} [data-action="journal"]`).click();
        await page.locator(`${CURRENT} [data-tab="scenes"]`).click();
        const replays = [`${ch}:intro`, ...levels(n).map((id) => `${id}:outro`), `${ch}:outro`];
        for (const id of replays) {
          // Every Chapter 1–4 challenge has a closing scene, so every one is replayable.
          await reveal(page, `[data-replay="${id}"]`);
          await everyLine(page, id);
          await action(page, 'ok').click();
          await expect(page.locator('.dialog-scene')).toHaveCount(0);
        }
      }
    });
