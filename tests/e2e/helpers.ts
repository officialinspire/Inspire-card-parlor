import { expect, type Page } from '@playwright/test';

export const CURRENT = '.screen:not([aria-hidden])';

export const screenState = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ICP__: { store: { state: { screen: string } } } }).__ICP__.store.state.screen,
  );

export async function expectScreen(page: Page, state: string): Promise<void> {
  await expect.poll(() => screenState(page)).toBe(state);
  await expect(page.locator(`${CURRENT}[data-state="${state}"]`)).toBeVisible();
  // Wait for the slide transition to finish so layout checks see final positions.
  await page.waitForFunction(() => {
    const screens = document.querySelectorAll('.screen');
    const cur = document.querySelector<HTMLElement>('.screen:not([aria-hidden])');
    if (screens.length !== 1 || !cur) return false;
    const cs = getComputedStyle(cur);
    return cs.transform === 'none' && cs.opacity === '1';
  });
}

/** Pages through the current screen's paginator until `selector` is visible, then clicks it. */
export async function clickInPager(page: Page, selector: string): Promise<void> {
  const target = page.locator(`${CURRENT} ${selector}`);
  const first = page.locator(`${CURRENT} [data-pager="dot-0"]`);
  if (!(await target.isVisible()) && (await first.isVisible())) await first.click();
  for (let i = 0; i < 10 && !(await target.isVisible()); i++) {
    await page.locator(`${CURRENT} [data-pager="next"]`).click();
  }
  await target.click();
}

/** Pages through Quick Play until the game's Play button is on screen, then presses it. */
export async function playGame(page: Page, gameId: string): Promise<void> {
  await clickInPager(page, `[data-play="${gameId}"]`);
  await expectScreen(page, 'DECK_SELECTION');
}

/** Seed saved data before the app boots (e.g. a higher level to unlock decks). */
export async function seed(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(`icp:${k}`, JSON.stringify(v));
  }, data);
}

export async function enterParlor(page: Page): Promise<void> {
  await page.goto('./');
  const enter = page.getByRole('button', { name: 'Enter Parlor' });
  await expect(enter).toBeVisible({ timeout: 10_000 });
  await enter.click();
  await expectScreen(page, 'MAIN_MENU');
}

export const nav = (page: Page, target: string) => page.locator(`${CURRENT} [data-nav="${target}"]`).first();

export async function clickNav(page: Page, target: string, expected = target): Promise<void> {
  await nav(page, target).click();
  await expectScreen(page, expected);
}

/** Asserts nothing on the current screen spills outside the viewport and the page itself cannot scroll. */
export async function expectNoOverflow(page: Page, selector = `${CURRENT} button, ${CURRENT} a`): Promise<void> {
  const result = await page.evaluate((sel) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const outside = [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.offsetParent !== null && !el.closest('.pager-grid, .tabs-strip'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1))
      .map(({ el }) => el.textContent?.trim() || el.getAttribute('aria-label') || el.className);
    const scrollable = document.documentElement.scrollHeight > vh + 1 || document.documentElement.scrollWidth > vw + 1;
    return { outside, scrollable };
  }, selector);
  expect(result.outside, 'controls outside the viewport').toEqual([]);
  expect(result.scrollable, 'page scrolls').toBe(false);
}
