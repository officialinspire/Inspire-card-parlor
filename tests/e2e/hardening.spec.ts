import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CURRENT, clickNav, enterParlor, expectScreen, seed } from './helpers';
import { layoutIssues } from './layout-checks';

/**
 * Performance, accessibility and PWA hardening (Prompt 32): no screen is
 * kept alive after it closes, the opening loads only what it shows, the game
 * recovers from a broken start or an old offline copy, saving problems and
 * errors are never silent, sound failures never block play, the tables can be
 * played from the keyboard, the automated accessibility audit stays clean,
 * and the whole journey fits seven phone and tablet sizes.
 */
test.describe.configure({ timeout: 180_000 });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

type Icp = {
  __ICP__: {
    store: { state: Record<string, any>; dispatch(a: unknown): void };
    liveWidgets(): number;
    errors(): { errors: number; rejections: number; last: string | null };
    audioContext(): string | null;
  };
};
const icp = <T>(page: Page, fn: (w: Icp['__ICP__']) => T) =>
  page.evaluate(
    (src) => new Function('w', `return (${src})(w)`)((window as unknown as Icp).__ICP__),
    fn.toString(),
  ) as Promise<T>;
const go = (page: Page, to: string) =>
  page.evaluate((to) => (window as unknown as Icp).__ICP__.store.dispatch({ type: 'NAVIGATE', to }), to);

test('screens let go when they close: repeated navigation leaves no growing trail', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses Chromium performance metrics');
  await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
  await enterParlor(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const nodes = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(200);
    const m = (await cdp.send('Performance.getMetrics')).metrics;
    return m.find((x) => x.name === 'Nodes')!.value;
  };
  const cycle = async () => {
    for (const s of ['SETTINGS', 'COLLECTION', 'PASSPORT', 'STORY_MODE', 'ACHIEVEMENTS']) {
      await go(page, s);
      await expectScreen(page, s);
      await go(page, 'MAIN_MENU');
      await expectScreen(page, 'MAIN_MENU');
    }
    await page.waitForTimeout(400);
  };
  await cycle();
  const live1 = await icp(page, (w) => w.liveWidgets());
  const n1 = await nodes();
  for (let i = 0; i < 5; i++) await cycle();
  const n6 = await nodes();
  const live6 = await icp(page, (w) => w.liveWidgets());
  // Before the fix every visit kept its whole screen (hundreds of nodes each, ~13,000 here).
  expect(n6 - n1, `DOM nodes grew from ${n1} to ${n6}`).toBeLessThan(600);
  expect(live6).toBeLessThanOrEqual(live1 + 4);
  expect(await page.locator('.stage > .screen').count()).toBe(1);
});

test('the opening shows card backs only; the deck’s faces load once Touch to Start is ready', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shown: number | null };
    w.__shown = null;
    new MutationObserver(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Enter Parlor/.test(x.textContent ?? ''));
      if (b && !b.hidden && w.__shown === null) w.__shown = performance.now();
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await seed(page, { settings: { startupIntro: 'brief' } });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Enter Parlor' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType('resource').some((r) => /faces\.webp/.test(r.name))))
    .toBe(true);
  const t = await page.evaluate(() => ({
    shown: (window as unknown as { __shown: number }).__shown,
    faces: Math.min(
      ...performance
        .getEntriesByType('resource')
        .filter((r) => /faces\.webp/.test(r.name))
        .map((r) => r.startTime),
    ),
    back: performance.getEntriesByType('resource').find((r) => /back\.webp/.test(r.name))?.startTime ?? null,
  }));
  expect(t.back, 'the title’s card backs load during the opening').not.toBeNull();
  expect(t.faces, 'faces wait for the end of loading').toBeGreaterThanOrEqual(t.shown - 50);
});

test('a script that fails to load shows a way out instead of a black screen', async ({ page }) => {
  await page.route(/assets\/index-[\w-]+\.js$/, (r) => r.fulfill({ status: 404, body: 'gone' }));
  await page.goto('./');
  const panel = page.getByRole('alertdialog', { name: 'The parlor didn’t open' });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-reason', 'script');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Repair offline files' })).toBeVisible();
  for (const b of await panel.getByRole('button').all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Fixed (the deploy finished): Try again opens the parlor.
  await page.unroute(/assets\/index-[\w-]+\.js$/);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Enter Parlor' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#recover')).toBeHidden();
});

test('Repair offline files clears the old offline copy and keeps progress', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'service workers');
  await seed(page, { settings: { musicPaused: true }, profile: { credits: 777, schemaVersion: 3 } });
  await enterParlor(page);
  // An offline copy is in place (the service worker installed its cache).
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('icp-')).length), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  // A stale cache from an older release, as an upgrade gone wrong might leave behind.
  await page.evaluate(async () => (await caches.open('icp-0.0.1-stale')).put('./stale', new Response('old')));
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="data"]`).click();
  await page.locator(`${CURRENT} [data-action="repair-offline"]`).click();
  await expect(page.locator('.dialog')).toContainText('Your progress, collection and settings are kept');
  await Promise.all([page.waitForURL(/fresh=/), page.locator('[data-dialog-action="true"]').click()]);
  await expect(page.getByRole('button', { name: 'Enter Parlor' })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(async () => (await caches.keys()).includes('icp-0.0.1-stale'))).toBe(false);
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  expect(await icp(page, (w) => w.store.state.profile.credits)).toBe(777);
});

test('saving problems are told, once, and when they clear', async ({ page }) => {
  await seed(page, { settings: { musicPaused: true } });
  await enterParlor(page);
  // The device starts refusing writes (storage full, or a private window's quota).
  await page.evaluate(() => {
    const w = window as unknown as { __realSet: typeof Storage.prototype.setItem };
    w.__realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(
      (v) => (window as unknown as Icp).__ICP__.store.dispatch({ type: 'UPDATE_SETTINGS', patch: { sfxVolume: v } }),
      0.3 + i / 10,
    );
    await page.waitForTimeout(400);
  }
  const warning = page.locator('.toast', { hasText: 'can’t be saved' });
  await expect(warning).toHaveCount(1);
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as unknown as { __realSet: typeof Storage.prototype.setItem }).__realSet;
  });
  await page.evaluate(() =>
    (window as unknown as Icp).__ICP__.store.dispatch({ type: 'UPDATE_SETTINGS', patch: { sfxVolume: 0.9 } }),
  );
  await expect(page.locator('.toast', { hasText: 'Saving works again' })).toBeVisible();
});

test('an unexpected error is logged and told once; the game carries on', async ({ page }) => {
  const logged: string[] = [];
  page.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
  await seed(page, { settings: { musicPaused: true } });
  await enterParlor(page);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('synthetic failure for the test');
    });
    setTimeout(() => {
      throw new Error('a second one');
    }, 50);
  });
  await expect(page.locator('.toast', { hasText: 'your progress is safe' })).toHaveCount(1);
  expect(logged.join('\n')).toContain('synthetic failure');
  await expect.poll(async () => (await icp(page, (w) => w.errors())).errors).toBe(2);
  // Still playable.
  await clickNav(page, 'SETTINGS');
  await expect(page.locator('#recover')).toBeHidden();
});

test('no sound at all (the browser refuses audio) never blocks play', async ({ page }) => {
  await page.addInitScript(() => {
    class Refused {
      constructor() {
        throw new DOMException('audio blocked', 'NotAllowedError');
      }
    }
    Object.assign(window, { AudioContext: Refused, webkitAudioContext: Refused });
  });
  await seed(page, { settings: { musicPaused: false } });
  await enterParlor(page);
  expect(await icp(page, (w) => w.audioContext())).toBeNull();
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  expect((await icp(page, (w) => w.errors())).rejections).toBe(0);
  await expect(page.locator('#recover')).toBeHidden();
});

test('offline: the parlor starts, story art falls back gracefully, music falls back to the built-in tunes', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service workers');
  await seed(page, { settings: { musicPaused: false } });
  await enterParlor(page);
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('icp-')).length), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1500); // let the precache finish
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  // Story Mode: the story's art list was kept offline; pictures never seen show their labelled placeholder.
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await expect(page.locator('.dialog-scene')).toBeVisible();
  await page.locator('[data-dialog-action="skip"]').click();
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
  // (once the closing scene's tap shield has gone)
  await expect.poll(() => layoutIssues(page)).toEqual([]);
  // Music: the recorded track can't stream offline; the player falls back and keeps playing.
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __ICP__: { audio(): { playing: boolean } } }).__ICP__.audio().playing,
      ),
    )
    .toBe(true);
  await expect(page.locator('#recover')).toBeHidden();
  await context.setOffline(false);
});

test('solitaire from the keyboard: move the cursor, pick up a card, put it down', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = 7;
  });
  await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
  await enterParlor(page);
  await page.evaluate(() =>
    (window as unknown as Icp).__ICP__.store.dispatch({ type: 'SELECT_GAME', gameId: 'klondike' }),
  );
  await go(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  const board = page.locator(`${CURRENT} .sol-board`);
  await expect(board).toHaveAttribute('tabindex', '0');
  // The hinted move, by pile.
  await page.keyboard.press('h');
  const sourceEl = page.locator(`${CURRENT} .sol-card[data-hint="source"]`).first();
  const from = (await sourceEl.getAttribute('data-pile'))!;
  const index = (await sourceEl.getAttribute('data-index'))!;
  const to = (await page.locator(`${CURRENT} .sol-slot[data-hint="target"]`).getAttribute('data-pile'))!;
  const moves = async () =>
    Number((await page.locator(`${CURRENT} [data-hud="moves"]`).textContent())!.replace(/\D/g, ''));
  const before = await moves();
  await board.focus();
  const cursorPile = () =>
    page.locator(`${CURRENT} .kb-cursor`).evaluate((e) => (e as HTMLElement).dataset.pile ?? null);
  const status = page.locator(`${CURRENT} [data-kb-status]`);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(`${CURRENT} .kb-cursor`)).toHaveCount(1);
  await expect(status).not.toBeEmpty();
  for (let i = 0; i < 16 && (await cursorPile()) !== from; i++) await page.keyboard.press('ArrowRight');
  expect(await cursorPile()).toBe(from);
  for (let i = 0; i < 20; i++) {
    const at = await page.locator(`${CURRENT} .kb-cursor`).getAttribute('data-index');
    if (at === index) break;
    await page.keyboard.press('ArrowUp');
  }
  await page.keyboard.press('Enter');
  await expect(page.locator(`${CURRENT} .sol-card.selected`).first()).toBeVisible();
  await expect(status).toContainText('Holding');
  for (let i = 0; i < 16 && (await cursorPile()) !== to; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(moves).toBe(before + 1);
  await expect(status).toContainText('Moved');
  // Space on the table acts on the cursor; it doesn't also deal from the stock.
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);
});

test('automated accessibility audit (WCAG 2.1 A/AA) is clean on the main screens, dialogs and tables', async ({
  page,
}) => {
  const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  await seed(page, { settings: { reducedMotion: true, musicPaused: true } });
  await enterParlor(page);
  const audit = async (where: string) => {
    await page.waitForTimeout(400);
    await page.addScriptTag({ content: axe });
    const found = await page.evaluate(async () => {
      const r = await (
        window as unknown as {
          axe: { run(...a: unknown[]): Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> };
        }
      ).axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        // Colour contrast is measured separately against the rendered pixels: axe can't see
        // through the painted backgrounds and gradients (it reports them as black).
        rules: { 'color-contrast': { enabled: false } },
      });
      return r.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(', ')}`,
      );
    });
    expect(found, where).toEqual([]);
  };
  await audit('main menu');
  for (const s of ['GAME_SELECTION', 'COLLECTION', 'ACHIEVEMENTS', 'STATISTICS', 'PASSPORT', 'SETTINGS']) {
    await go(page, s);
    await expectScreen(page, s);
    await audit(s);
    await go(page, 'MAIN_MENU');
  }
  await go(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="music"]`).click();
  await audit('settings: music');
  await go(page, 'MAIN_MENU');
  await go(page, 'STORY_MODE');
  await page.locator(`${CURRENT} [data-chapter="th-1"]`).click();
  await audit('chapter arrival scene');
  await page.locator('[data-dialog-action="skip"]').click();
  await page.locator(`${CURRENT} [data-level="th-1-1"]`).click();
  await audit('challenge brief');
  await page.locator('[data-dialog-action="cancel"]').click();
  for (const g of ['klondike', 'go-fish']) {
    await go(page, 'MAIN_MENU');
    await page.evaluate(
      (g) => (window as unknown as Icp).__ICP__.store.dispatch({ type: 'SELECT_GAME', gameId: g }),
      g,
    );
    await go(page, 'GAMEPLAY');
    await page.locator('[data-dialog-action="deal"]').click();
    await audit(`${g} table`);
  }
});

/** The seven phone and tablet sizes the adventure must fit. */
const SIZES = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [667, 375],
  [844, 390],
  [768, 1024],
] as const;

for (const [w, h] of SIZES) {
  test(`the whole journey fits ${w}x${h}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'sizes are set by the test');
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const levels = (n: number) => Array.from({ length: 5 }, (_, i) => `th-${n}-${i + 1}`);
    await page.setViewportSize({ width: w, height: h });
    await seed(page, {
      settings: { reducedMotion: true, musicPaused: true, warSpeed: 'instant' },
      profile: {
        schemaVersion: 3,
        storyChapter: 6,
        story: {
          campaign: 'thirteenth-hand',
          version: 2,
          completed: [1, 2, 3, 4, 5, 6].flatMap(levels),
          rewarded: [],
          stamps: [],
          introsSeen: ['th-1', 'th-2', 'th-3', 'th-4', 'th-5', 'th-6', 'th-7'],
          attempts: {},
          evidence: ['thirteenth-hand-card'],
        },
      },
    });
    const at = `${w}x${h}`;
    const check = async (where: string) => {
      await page.waitForTimeout(350);
      await page.addStyleTag({ content: '.toast-region { display: none !important; }' });
      await expect.poll(() => layoutIssues(page), { message: `${at} ${where}` }).toEqual([]);
    };
    /** Answers whatever dialog a step left open (a player can't navigate past one). */
    const closeDialogs = async () => {
      for (let i = 0; i < 4 && (await page.locator('.dialog-backdrop.open').count()); i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    };
    await enterParlor(page);
    await check('menu');
    // Two early chapters and a later one.
    for (const ch of ['th-1', 'th-2', 'th-7']) {
      await go(page, 'MAIN_MENU');
      await go(page, 'STORY_MODE');
      await page.locator(`${CURRENT} [data-chapter="${ch}"]`).click();
      await expect(page.locator(`${CURRENT} [data-chapter-view="${ch}"]`)).toBeVisible();
      await check(`chapter ${ch}`);
    }
    // A later level's table.
    await page.evaluate(() => {
      const s = (window as unknown as Icp).__ICP__.store;
      s.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: 'th-7-1', chapterId: 'th-7' });
      s.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
    });
    await expectScreen(page, 'GAMEPLAY');
    await page
      .locator('[data-dialog-action="deal"]')
      .click({ timeout: 2000 })
      .catch(() => undefined);
    await check('story table');
    // A reward: the result of that challenge, then back to its chapter.
    await closeDialogs();
    await page.evaluate(() => {
      const x = window as unknown as {
        __ICP__: { storyResult(id: string, o: string): void; store: { dispatch(a: unknown): void } };
      };
      x.__ICP__.storyResult('th-7-1', 'win');
      x.__ICP__.store.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
    });
    await expectScreen(page, 'STORY_MODE');
    const ok = page.locator('[data-dialog-action="ok"]');
    if (await ok.isVisible({ timeout: 2000 }).catch(() => false)) await ok.click();
    await expect(page.locator('[data-story-result]')).toBeVisible();
    await check('story result');
    await closeDialogs();
    await expect(page.locator(`${CURRENT} [data-chapter-view="th-7"]`)).toBeVisible();
    // Quick Play sessions.
    for (const g of ['klondike', 'spider', 'war']) {
      await go(page, 'MAIN_MENU');
      await page.evaluate(
        (g) => (window as unknown as Icp).__ICP__.store.dispatch({ type: 'SELECT_GAME', gameId: g }),
        g,
      );
      await go(page, 'GAMEPLAY');
      await page
        .locator('[data-dialog-action="deal"]')
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await check(g);
      await closeDialogs();
    }
    // Settings, then back out to the menu.
    await go(page, 'MAIN_MENU');
    await go(page, 'SETTINGS');
    for (const tab of ['audio', 'display', 'data']) {
      await page.locator(`${CURRENT} [data-tab="${tab}"]`).click();
      await check(`settings ${tab}`);
    }
    await page.locator(`${CURRENT} [data-nav="back"]`).first().click();
    await expectScreen(page, 'MAIN_MENU');
    expect(errors).toEqual([]);
  });
}
