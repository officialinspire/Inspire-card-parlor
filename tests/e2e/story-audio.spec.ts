import { expect, test, type Page } from '@playwright/test';
import { action, CURRENT, clickNav, enterParlor, expectScreen, seed } from './helpers';

/**
 * The story audio director in a real browser: the right track for each
 * moment, smooth crossfades with never more than one track left playing,
 * the player's own pick winning, pause respected; and the asset budget —
 * Story Mode loads only what is on screen and what comes next.
 */
test.use({ serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

type AudioState = { track: string; playing: boolean; voices: number };
const audioState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ICP__: { audio(): AudioState } }).__ICP__.audio());
const nowPlaying = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __ICP__: { store: { state: { nowPlaying: { track: string; source: string } | null } } };
        }
      ).__ICP__.store.state.nowPlaying,
  );

/** After a crossfade settles, exactly one track is sounding, and it is `id`. */
async function settlesOn(page: Page, id: string) {
  await expect.poll(async () => (await audioState(page)).track, { timeout: 10_000 }).toBe(id);
  // Crossfades take ~1.6 s; then the old track must be gone.
  await expect.poll(async () => (await audioState(page)).voices, { timeout: 8_000 }).toBe(1);
}

/** No moment ever has more than two tracks (the one fading out and the one fading in). */
async function watchOverlap(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __ICP__: { audio(): AudioState }; __maxVoices?: number };
    w.__maxVoices = 0;
    setInterval(() => (w.__maxVoices = Math.max(w.__maxVoices ?? 0, w.__ICP__.audio().voices)), 50);
  });
}
const maxVoices = (page: Page) => page.evaluate(() => (window as unknown as { __maxVoices?: number }).__maxVoices ?? 0);

async function finishAsWin(page: Page, levelId: string) {
  await page.evaluate((id) => {
    const icp = (
      window as unknown as {
        __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
      }
    ).__ICP__;
    icp.storyResult(id, 'win');
    icp.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
  }, levelId);
  await expectScreen(page, 'STORY_MODE');
}

test('music follows the story: menu → chapter → table → chapter, one track at a time', async ({ page }) => {
  await seed(page, { settings: { musicPaused: false, warSpeed: 'instant' } });
  await enterParlor(page); // the Enter button is the gesture that unlocks audio
  await watchOverlap(page);
  await settlesOn(page, 'parlor-menu');
  expect(await nowPlaying(page)).toEqual({ track: 'parlor-menu', source: 'player' });

  // The map keeps the player's own music.
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter="th-1"]`)).toBeVisible();
  await settlesOn(page, 'parlor-menu');

  // Into the antique shop: downtown Fredericksburg.
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await action(page, 'skip').click();
  await settlesOn(page, 'fxbg-saturday-walk');
  expect(await nowPlaying(page)).toEqual({ track: 'fxbg-saturday-walk', source: 'story' });

  // At the table: a quieter track.
  await page.locator(`${CURRENT} [data-level="th-1-1"]`).click();
  await action(page, 'play').click();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
  await settlesOn(page, 'silent-study-hours');

  // Back to the story, back to its music; back to the menu, back to the player's own.
  await finishAsWin(page, 'th-1-1');
  await action(page, 'ok').click();
  await expect(page.locator('[data-story-result="complete"]')).toBeVisible();
  await page.keyboard.press('Escape'); // dismissing the results returns to the chapter
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
  await expect(page.locator('.dialog-backdrop:not([aria-hidden])')).toHaveCount(0);
  await settlesOn(page, 'fxbg-saturday-walk');
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'MAIN_MENU');
  await settlesOn(page, 'parlor-menu');
  expect(await maxVoices(page)).toBeLessThanOrEqual(2);
});

test('the player’s own pick wins; pausing and switching off the story soundtrack are respected', async ({ page }) => {
  await seed(page, { settings: { musicPaused: false } });
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await action(page, 'skip').click();
  await settlesOn(page, 'fxbg-saturday-walk');

  // The music player in Story Mode shows what is really playing, and a pick overrides the story.
  await page.locator(`${CURRENT} [data-action="story-music"]`).click();
  const player = page.locator('[data-music-player]');
  await expect(player.locator('[data-now-playing]')).toHaveAttribute('data-now-track', 'fxbg-saturday-walk');
  await expect(player.locator('[data-now-playing]')).toHaveAttribute('data-now-source', 'story');
  const pick = player.locator('.mp-tracks [data-track]:not([data-track="fxbg-saturday-walk"])').first();
  const picked = (await pick.getAttribute('data-track'))!;
  await pick.click();
  await settlesOn(page, picked);
  expect(await nowPlaying(page)).toEqual({ track: picked, source: 'player' });
  await page.keyboard.press('Escape');
  // The pick holds while the player stays in Story Mode.
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await settlesOn(page, picked);

  // Pause stops everything, wherever the story goes.
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { musicPaused: true },
    }),
  );
  await expect.poll(async () => (await audioState(page)).voices, { timeout: 5000 }).toBe(0);

  // With the story soundtrack off, a fresh visit keeps the player's track.
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { musicPaused: false, storySoundtrack: false },
    }),
  );
  await clickNav(page, 'home', 'MAIN_MENU');
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await settlesOn(page, picked);
  expect((await nowPlaying(page))?.source).toBe('player');
});

test('Story Mode loads only what is shown and what comes next', async ({ page }) => {
  const story: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('/assets/story/')) story.push(u.pathname.replace(/^.*\/assets\/story\//, ''));
  });
  await enterParlor(page);
  // The menu decodes no story artwork (at most the small manifest).
  await page.waitForTimeout(800);
  expect(story.filter((p) => p.endsWith('.webp'))).toEqual([]);

  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter="th-1"] img.map-place`)).toBeVisible();
  await page.waitForTimeout(1500);
  const images = story.filter((p) => p.endsWith('.webp'));
  // A small budget: the open places' tiles, map icons, and Cheryl's portraits warmed for Chapter 1.
  expect(images.length, images.join('\n')).toBeLessThanOrEqual(24);
  // Map tiles are thumbnails, never the full paintings.
  for (const p of images.filter((x) => x.includes('location-'))) expect(p, p).toContain('/thumbs/');
  // Nothing from places not reached yet, or characters not met yet.
  for (const later of [
    'location-neon-art-shop',
    'location-jaks',
    'location-intelligence',
    'location-masonic',
    'location-kenmore',
    'location-sealed',
    'location-generals',
    'characters/dante',
    'characters/mrs-gray',
    'characters/steve',
    'characters/george',
    'characters/mary',
    'characters/sophia',
  ])
    expect(
      images.some((p) => p.includes(later)),
      later,
    ).toBe(false);
  // No atlas or source sheet is ever fetched: only cut sprites.
  expect(story.some((p) => p.endsWith('.png'))).toBe(false);
});

test('Low effects: no story particles, and everything still reads', async ({ page }) => {
  await seed(page, {
    settings: { lowEffects: true },
    profile: {
      schemaVersion: 3,
      story: {
        campaign: 'thirteenth-hand',
        version: 2,
        completed: [],
        rewarded: [],
        stamps: [],
        introsSeen: [],
        attempts: {},
        evidence: [],
      },
    },
  });
  await enterParlor(page);
  await expect(page.locator('html')).toHaveClass(/low-effects/);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  const stage = page.locator('.dialog-scene [data-scene]');
  for (let i = 0; i < 4; i++) await stage.click();
  await expect(stage.locator('[data-found="thirteenth-hand-card"]')).toContainText('Added to your journal');
  await page.waitForTimeout(400);
  await expect(page.locator('.vfx-layer [data-vfx]')).toHaveCount(0);
});

test('with effects on, a discovery plays its effect — and never over a card table', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  const stage = page.locator('.dialog-scene [data-scene]');
  for (let i = 0; i < 4; i++) await stage.click();
  await expect(page.locator('.vfx-layer [data-vfx="spectral"]')).toBeAttached();
  await action(page, 'skip').click();
  await page.locator(`${CURRENT} [data-level="th-1-2"]`).count(); // chapter view is up
  await page.locator(`${CURRENT} [data-level="th-1-1"]`).click();
  await action(page, 'play').click();
  await action(page, 'play').click();
  await expectScreen(page, 'GAMEPLAY');
  await page.waitForTimeout(1700);
  await expect(page.locator('.vfx-layer [data-vfx]')).toHaveCount(0);
});

/** Every cue the story and the tables asked for, in order (played or merged). */
async function listenCues(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __cues: { event: string; played: boolean }[] };
    w.__cues = [];
    addEventListener('icp:sound', (e) => {
      const d = (e as CustomEvent<{ event: string; played: boolean }>).detail;
      w.__cues.push({ event: d.event, played: d.played });
    });
  });
  return () => page.evaluate(() => (window as unknown as { __cues: { event: string; played: boolean }[] }).__cues);
}

test('story cues: four marks, one door; a discovery once; stepping back is silent', async ({ page }) => {
  const levels = (n: number, upTo = 5) => Array.from({ length: upTo }, (_, i) => `th-${n}-${i + 1}`);
  const done = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => levels(n)).concat(levels(8, 4));
  await seed(page, {
    settings: { musicPaused: true, reducedMotion: true },
    profile: {
      schemaVersion: 3,
      storyChapter: 7,
      story: {
        campaign: 'thirteenth-hand',
        version: 2,
        completed: done,
        rewarded: done.map((id) => `level:${id}`),
        stamps: [],
        introsSeen: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `th-${n}`),
        attempts: {},
        evidence: ['lodge-sketchbook-page', 'sophia-river-map', 'thirteenth-hand-dossier'],
      },
    },
  });
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  const cues = await listenCues(page);
  await page.locator(`${CURRENT} [data-story-next] [data-action="continue-story"]`).click();
  await action(page, 'play').click();
  const puzzle = page.locator('.dialog-suit-puzzle');
  for (const s of ['spades', 'diamonds', 'hearts', 'clubs']) await puzzle.locator(`[data-suit="${s}"]`).click();
  await puzzle.locator('[data-dialog-action="set"]').click();
  await expect(page.locator('.scene-puzzle-solved')).toBeVisible();
  const heard = (await cues()).filter((c) => c.played).map((c) => c.event);
  expect(heard.filter((e) => e === 'suit_set')).toHaveLength(4);
  expect(heard.filter((e) => e === 'puzzle_solved')).toHaveLength(1);
  await action(page, 'ok').click();
  await action(page, 'back').click(); // leave at the versus card

  // A replayed scene with a discovery: one evidence cue going forward, none stepping back.
  const before = (await cues()).length;
  await page.locator(`${CURRENT} [data-action="journal"]`).click();
  await page.locator(`${CURRENT} [data-tab="scenes"]`).click();
  const replay = page.locator(`${CURRENT} [data-replay="th-6-4:outro"]`);
  for (let i = 0; i < 12 && !(await replay.isVisible()); i++)
    await page.locator(`${CURRENT} [data-pager="next"]`).click();
  await replay.click();
  await page.locator('[data-scene-nav="next"]').click();
  await page.locator('[data-scene-nav="back"]').click();
  const replayed = (await cues())
    .slice(before)
    .filter((c) => c.played)
    .map((c) => c.event);
  expect(replayed.filter((e) => e === 'evidence')).toHaveLength(1);
});
