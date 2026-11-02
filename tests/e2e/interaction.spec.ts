import { expect, test, type Locator, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectScreen, playGame, seed } from './helpers';

/**
 * Card-table interaction (Prompt 31): touch and mouse reach the same moves,
 * a shaky tap is still a tap, interrupted drags always snap home, drops aim
 * with the card as well as the finger, rapid input never jams the table,
 * opponents react with their own faces, CPU turns always finish, and a
 * story challenge returns to its own chapter however it is left.
 */
test.describe.configure({ timeout: 120_000 });
test.beforeEach(({}, info) => {
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name), 'one phone and one desktop');
});

async function open(page: Page, gameId: string, settings: Record<string, unknown> = {}, dealSeed = 7) {
  await page.addInitScript((s) => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = s;
  }, dealSeed);
  await seed(page, { settings: { reducedMotion: true, ...settings } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, gameId);
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  if (gameId !== 'freecell') await page.locator('[data-dialog-action="deal"]').click();
  // The closing dialog shields the table for a moment (so its last tap can't land on a card).
  await expect
    .poll(() =>
      page.evaluate((cur) => {
        const b = document.querySelector(`${cur} .sol-board`)?.getBoundingClientRect();
        if (!b) return false;
        return !!document.elementFromPoint(b.left + b.width / 2, b.top + b.height * 0.6)?.closest('.sol-board');
      }, CURRENT),
    )
    .toBe(true);
}

const moves = async (page: Page) =>
  Number((await page.locator(`${CURRENT} [data-hud="moves"]`).textContent())!.replace(/\D/g, ''));

/** A point on a card: its middle, or near the top of a card buried in a column. */
async function grip(l: Locator, dx?: number) {
  const b = (await l.boundingBox())!;
  return { x: b.x + (dx ?? b.width / 2), y: b.y + Math.min(b.height / 2, 14) };
}

/** Synthetic touch pointer events (the real pointer path, with pointerType "touch"). */
async function finger(page: Page, type: string, x: number, y: number) {
  await page.evaluate(
    ([type, x, y, cur]) => {
      const board = document.querySelector(`${cur} .sol-board`)!;
      const target = type === 'pointerdown' ? document.elementFromPoint(x as number, y as number)! : board;
      target.dispatchEvent(
        new PointerEvent(type as string, {
          bubbles: true,
          cancelable: true,
          clientX: x as number,
          clientY: y as number,
          pointerId: 41,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        }),
      );
    },
    [type, x, y, CURRENT] as const,
  );
}

async function touchDrag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }, end = 'pointerup') {
  await finger(page, 'pointerdown', a.x, a.y);
  for (let i = 1; i <= 8; i++)
    await finger(page, 'pointermove', a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  await finger(page, end, b.x, b.y);
}

/** The hinted move: its source card and target (a pile's top card, or the empty slot). */
async function hinted(page: Page) {
  await page.locator(`${CURRENT} [data-action="hint"]`).click();
  const sourceEl = page.locator(`${CURRENT} .sol-card[data-hint="source"]`).first();
  if (!(await sourceEl.count())) return null;
  const pile = (await page.locator(`${CURRENT} .sol-slot[data-hint="target"]`).getAttribute('data-pile'))!;
  const cards = page.locator(`${CURRENT} .sol-card[data-pile="${pile}"]`);
  const target = (await cards.count()) ? cards.last() : page.locator(`${CURRENT} .sol-slot[data-pile="${pile}"]`);
  const key = await sourceEl.getAttribute('data-key');
  return { source: page.locator(`${CURRENT} .sol-card[data-key="${key}"]`), target, pile };
}

/** Sounds the table asked for, in order (every request, played or merged). */
async function listenSounds(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sounds: string[] };
    w.__sounds = [];
    addEventListener('icp:sound', (e) => w.__sounds.push((e as CustomEvent<{ event: string }>).detail.event));
  });
  return () => page.evaluate(() => (window as unknown as { __sounds: string[] }).__sounds);
}

const stuck = (page: Page) => page.locator(`${CURRENT} .sol-card.dragging`).count();

test('touch and mouse reach the same moves; the legal landing spot lights up while carrying', async ({ page }) => {
  await open(page, 'klondike');
  let h = (await hinted(page))!;
  expect(h).not.toBeNull();
  const before = await moves(page);
  // Touch: carry it, check the drop highlight on the way, then let go.
  const a = await grip(h.source);
  const b = await grip(h.target);
  await finger(page, 'pointerdown', a.x, a.y);
  for (let i = 1; i <= 8; i++)
    await finger(page, 'pointermove', a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
  await expect(page.locator(`${CURRENT} [data-drop]`).first()).toBeAttached();
  await finger(page, 'pointerup', b.x, b.y);
  await expect.poll(() => moves(page)).toBe(before + 1);
  await expect(page.locator(`${CURRENT} [data-drop]`)).toHaveCount(0);
  // Undo, then the same move with the mouse.
  await page.keyboard.press('u');
  await expect.poll(() => moves(page)).toBe(before + 2);
  h = (await hinted(page))!;
  const m1 = await grip(h.source);
  const m2 = await grip(h.target);
  await page.mouse.move(m1.x, m1.y);
  await page.mouse.down();
  await page.mouse.move(m2.x, m2.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => moves(page)).toBe(before + 3);
  expect(await stuck(page)).toBe(0);
});

test('a shaky tap is still a tap; a press that wanders off is not a stray tap', async ({ page }) => {
  await open(page, 'klondike');
  const sounds = await listenSounds(page);
  const card = page.locator(`${CURRENT} .sol-card.pickable`).last();
  const p = await grip(card);
  // A finger that drifts 8 px while tapping still selects the card.
  await finger(page, 'pointerdown', p.x, p.y);
  await finger(page, 'pointermove', p.x + 6, p.y + 5);
  await finger(page, 'pointerup', p.x + 6, p.y + 5);
  await expect(page.locator(`${CURRENT} .sol-card.selected`).first()).toBeVisible();
  await page.waitForTimeout(450); // (sooner would be a double tap, which sends the card on)
  await page.locator(`${CURRENT} .sol-card.selected`).first().click(); // deselect
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);
  // A press on a face-down card that slides away: nothing happens at all.
  const down = page.locator(`${CURRENT} .sol-card.card-back[data-pile^="tableau"]`).first();
  const q = await grip(down);
  const n = await moves(page);
  await touchDrag(page, q, { x: q.x + 60, y: q.y + 80 });
  expect(await moves(page)).toBe(n);
  await expect(page.locator(`${CURRENT} .sol-card.selected`)).toHaveCount(0);
  expect(await sounds()).not.toContain('invalid_move');
});

test('a cancelled, interrupted or paused drag snaps home, and the board keeps working', async ({ page }) => {
  await open(page, 'klondike');
  const card = page.locator(`${CURRENT} .sol-card.pickable`).last();
  const home = await card.evaluate((e) => (e as HTMLElement).style.transform);
  const p = await grip(card);
  const n = await moves(page);
  // The system cancels the touch (an incoming call, a scroll gesture): no move.
  await touchDrag(page, p, { x: p.x - 50, y: p.y - 120 }, 'pointercancel');
  expect(await stuck(page)).toBe(0);
  expect(await moves(page)).toBe(n);
  await expect.poll(() => card.evaluate((e) => (e as HTMLElement).style.transform)).toBe(home);
  // Capture lost mid-drag.
  await finger(page, 'pointerdown', p.x, p.y);
  await finger(page, 'pointermove', p.x + 30, p.y + 30);
  await page.evaluate((cur) => {
    document
      .querySelector(`${cur} .sol-board`)!
      .dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 41 }));
  }, CURRENT);
  expect(await stuck(page)).toBe(0);
  // Pausing while carrying a card: it goes home; resume and play on.
  await finger(page, 'pointerdown', p.x, p.y);
  await finger(page, 'pointermove', p.x + 30, p.y + 30);
  await page.keyboard.press('p');
  await expect(page.locator(`${CURRENT} .sol-pause`)).toBeVisible();
  await finger(page, 'pointerup', p.x + 200, p.y + 30); // released after the pause: ignored
  expect(await stuck(page)).toBe(0);
  await page.keyboard.press('p');
  await expect(page.locator(`${CURRENT} .sol-pause`)).toBeHidden();
  expect(await moves(page)).toBe(n);
  const h = (await hinted(page))!;
  await h.source.click();
  await h.target.click({ force: true });
  await expect.poll(() => moves(page)).toBe(n + 1);
});

test('drops aim with the card too; open felt is a quiet snap home; right-click never lifts a card', async ({
  page,
}) => {
  await open(page, 'klondike');
  const sounds = await listenSounds(page);
  const h = (await hinted(page))!;
  const n = await moves(page);
  // Open felt (the gap in the top row): back home, no error sound.
  const gap = page.locator(`${CURRENT} .sol-slot[data-pile="waste"]`);
  const g = (await gap.boundingBox())!;
  const s = await grip(h.source);
  await touchDrag(page, s, { x: g.x + g.width * 1.6, y: g.y + g.height / 2 });
  expect(await moves(page)).toBe(n);
  expect(await sounds()).not.toContain('invalid_move');
  // Held by its left edge and let go with the finger just short of the target column:
  // the card itself is over the target, so it lands there.
  const src = await grip(h.source, 3);
  const t = (await h.target.boundingBox())!;
  const gapPx = await page.evaluate((cur) => {
    const cards = [...document.querySelectorAll<HTMLElement>(`${cur} .sol-slot-tableau`)].map((e) =>
      e.getBoundingClientRect(),
    );
    return cards.length > 1 ? cards[1]!.left - cards[0]!.right : 6;
  }, CURRENT);
  await touchDrag(page, src, { x: t.x - Math.max(2, gapPx - 1), y: t.y + 14 });
  await expect.poll(() => moves(page)).toBe(n + 1);
  // Right mouse button: nothing lifts.
  const card = page.locator(`${CURRENT} .sol-card.pickable`).last();
  const c = await grip(card);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(c.x + 40, c.y + 60, { steps: 4 });
  expect(await stuck(page)).toBe(0);
  await page.mouse.up({ button: 'right' });
  expect(await moves(page)).toBe(n + 1);
});

test('rapid input on every solitaire never jams the table', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const gameId of ['klondike', 'spider', 'freecell']) {
    await open(page, gameId);
    const box = (await page.locator(`${CURRENT} .sol-board`).boundingBox())!;
    // Forty quick taps and flicks all over the table, mouse and touch mixed.
    for (let i = 0; i < 40; i++) {
      const x = box.x + (((i * 37) % 100) / 100) * box.width;
      const y = box.y + (((i * 53) % 100) / 100) * box.height;
      if (i % 3 === 0) await touchDrag(page, { x, y }, { x: x + 25, y: y + 40 });
      else await page.mouse.click(x, y, { delay: 5 });
    }
    expect(await stuck(page)).toBe(0);
    // Still answers: a hinted move (or the stock) goes through.
    const sel = page.locator(`${CURRENT} .sol-card.selected`).first();
    if (await sel.count()) await sel.click();
    const n = await moves(page);
    const h = await hinted(page);
    if (h) {
      await h.source.click();
      await h.target.click({ force: true });
      await expect.poll(() => moves(page)).toBeGreaterThan(n);
    }
  }
  expect(errors).toEqual([]);
});

test('War: the opponent reacts with their own expressions, and auto play always reaches the result', async ({
  page,
}) => {
  await seed(page, { settings: { warSpeed: 'fast' } });
  await enterParlor(page);
  // Story art loads with Story Mode; then a story War against a character with an expression sheet.
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  await page.evaluate(() => {
    const icp = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__;
    icp.store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: 'th-1-1', chapterId: 'th-1' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
  });
  await expectScreen(page, 'GAMEPLAY');
  const face = page.locator(`${CURRENT} .war-who [data-avatar="cheryl"]`);
  await expect(face).toHaveAttribute('data-mood', 'talk'); // her greeting
  if ((await face.getAttribute('data-art')) === 'story')
    await expect(face.locator('img')).toHaveAttribute('src', /portrait-talk/);
  await expect(face).toHaveAttribute('data-mood', 'neutral', { timeout: 6000 });
  if ((await face.getAttribute('data-art')) === 'story')
    await expect(face.locator('img')).toHaveAttribute('src', /portrait-neutral/);
  // Moods seen over the game are only the table's set.
  await page.evaluate((cur) => {
    const w = window as unknown as { __moods: Set<string> };
    w.__moods = new Set();
    const el = document.querySelector(`${cur} .war-who [data-avatar]`)!;
    new MutationObserver(() => w.__moods.add((el as HTMLElement).dataset.mood ?? '')).observe(el, {
      attributes: true,
      attributeFilter: ['data-mood'],
    });
  }, CURRENT);
  await page.locator(`${CURRENT} [data-action="speed"]`).click(); // fast → instant
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  await expect(page.locator('.dialog-result')).toBeVisible({ timeout: 60_000 });
  const moods = await page.evaluate(() => [...(window as unknown as { __moods: Set<string> }).__moods]);
  for (const m of moods) expect(['neutral', 'talk', 'think', 'surprise', 'win', 'lose']).toContain(m);
  // At the end the face shows the result (she lost → 'lose'; she won → 'win').
  await expect(face).toHaveAttribute('data-mood', /win|lose|surprise/);
});

test('Go Fish: CPUs think before asking, and every CPU turn hands the table back', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = 11;
  });
  await seed(page, { settings: { goFishOpponents: 3, cardAnimationSpeed: 'fast' } });
  await enterParlor(page);
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'go-fish');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT} .gofish .gf-opp`).first()).toBeVisible();
  // Every face change anywhere on the table, recorded as it happens.
  await page.evaluate((cur) => {
    const w = window as unknown as { __moods: string[] };
    w.__moods = [];
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (el.closest('.gf-opp')) w.__moods.push(el.dataset.mood ?? '');
      }
    }).observe(document.querySelector(`${cur} .gofish`)!, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-mood'],
    });
  }, CURRENT);
  // A double tap on a card opens one request dialog, not two.
  // (Two clicks on the card itself, back to back, before the dialog can cover it.)
  await page
    .locator(`${CURRENT} .gf-hand .gf-card`)
    .first()
    .evaluate((b) => {
      (b as HTMLElement).click();
      (b as HTMLElement).click();
    });
  await expect(page.locator('.dialog-ask')).toHaveCount(1);
  await page.waitForTimeout(300);
  await expect(page.locator('.dialog-ask')).toHaveCount(1);
  // Keep asking. Once a CPU has thought and played, the table must come back to the player.
  const state = () =>
    page.evaluate((cur) => {
      const ask = document.querySelector<HTMLButtonElement>(`${cur} .gf-actions [data-action="ask"]`);
      return {
        mine: !!ask && !ask.disabled,
        dialog: document.querySelectorAll('.dialog-ask:not(.closing)').length > 0,
        over: document.querySelectorAll('.dialog-result').length > 0,
        thought: (window as unknown as { __moods: string[] }).__moods.includes('think'),
      };
    }, CURRENT);
  let handedBack = false;
  for (let i = 0; i < 120 && !handedBack; i++) {
    const s = await state();
    if (s.over) break;
    if (s.thought && s.mine && !s.dialog) handedBack = true;
    else if (s.dialog)
      await page
        .locator('[data-dialog-action="ask"]')
        .click({ timeout: 2000 })
        .catch(() => undefined);
    else if (s.mine)
      await page
        .locator(`${CURRENT} .gf-actions [data-action="ask"]`)
        .click()
        .catch(() => undefined);
    await page.waitForTimeout(400);
  }
  const moods = await page.evaluate(() => (window as unknown as { __moods: string[] }).__moods);
  expect(moods).toContain('think');
  expect(moods).toContain('talk');
  expect(handedBack || (await state()).over).toBe(true);
});

test('a story challenge left part-way returns to its chapter, with that challenge in view', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  await page.evaluate(() => {
    const icp = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__;
    icp.store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: 'th-1-1', chapterId: 'th-1' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
  });
  await expectScreen(page, 'GAMEPLAY');
  // Back out of the table before playing a round: Story Mode opens on the challenge's chapter.
  await page
    .locator('[data-dialog-action="deal"]')
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-chapter-view="th-1"]`)).toBeVisible();
  await expect(page.locator(`${CURRENT} [data-level="th-1-1"]`)).toBeVisible();
  // Once used, the next visit to Story Mode starts on the map as usual.
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await page.locator(`${CURRENT} [data-nav="back"]`).click();
  await expectScreen(page, 'MAIN_MENU');
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
  // Leaving the table with Home goes to the menu; Story Mode then opens on its map.
  await page.evaluate(() => {
    const icp = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__;
    icp.store.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: 'th-1-1', chapterId: 'th-1' });
    icp.store.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
  });
  await expectScreen(page, 'GAMEPLAY');
  // The table from before is still saved: carry on with it.
  await page.locator('[data-dialog-action="resume"]').click();
  await clickNav(page, 'home', 'MAIN_MENU');
  await clickNav(page, 'STORY_MODE');
  await expect(page.locator(`${CURRENT} [data-story-view="map"]`)).toBeVisible();
});
