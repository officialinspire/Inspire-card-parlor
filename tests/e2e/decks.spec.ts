import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickInPager, clickNav, enterParlor, expectScreen, screenState, seed } from './helpers';

const deckIds = async (page: Page) => {
  const seen = new Set<string>();
  await expect(page.locator(`${CURRENT} [data-deck]`).first()).toBeVisible();
  const first = page.locator(`${CURRENT} [data-pager="dot-0"]`);
  if (await first.isVisible()) await first.click();
  for (let i = 0; i < 12; i++) {
    for (const el of await page.locator(`${CURRENT} [data-deck]`).all())
      seen.add((await el.getAttribute('data-deck'))!);
    const next = page.locator(`${CURRENT} [data-pager="next"]`);
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await next.click();
  }
  return [...seen].sort();
};

async function setContent(page: Page, setting: 'matureContent' | 'placeholderArt') {
  if ((await screenState(page)) !== 'MAIN_MENU') await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="SETTINGS"]`).click();
  await expectScreen(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="content"]`).click();
  await page.locator(`${CURRENT} [data-setting="${setting}"]`).click();
}

test('collection lists the deck registry with mature decks hidden by default', async ({ page }) => {
  const matureRequests: string[] = [];
  page.on('request', (r) => r.url().includes('/assets/cards/mature/') && matureRequests.push(r.url()));
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  expect(await deckIds(page)).toEqual(['classic', 'inspire'].sort());
  expect(matureRequests).toEqual([]);
});

test('deck details show uploaded YummyHole artwork and attribution', async ({ page }) => {
  await seed(page, { profile: { unlockedDecks: ['classic', 'inspire', 'yummyhole_standard'] } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  // The chapter reward can be viewed after it is owned.
  await clickInPager(page, '[data-deck="yummyhole_standard"]');
  const pending = page.locator('[data-deck-detail="yummyhole_standard"]');
  await expect(pending).toContainText('OFFICIAL INSPIRE');
  await expect(pending).not.toContainText('Art coming soon');
  await expect(pending.locator('[data-preview="image"] img')).toHaveAttribute(
    'src',
    /yummyhole_standard\/preview\.png$/,
  );
  await page.keyboard.press('Escape');
  await expect(pending).toBeHidden();

  // A deck built from its uploaded sprite sheet: preview image and credit.
  await clickInPager(page, '[data-deck="inspire"]');
  const ready = page.locator('[data-deck-detail="inspire"]');
  await expect(ready).toContainText('OFFICIAL INSPIRE');
  await expect(ready).not.toContainText('Art coming soon');
  await expect(ready.locator('[data-preview="image"] img')).toHaveAttribute(
    'src',
    /assets\/cards\/inspire\/preview\.webp$/,
  );
  await page.keyboard.press('Escape');
});

test('card gallery renders all 52 faces of the selected deck', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  // The pager lays out after its first measurement; wait for page one.
  await expect(page.locator(`${CURRENT} .gallery-cell .card`).first()).toBeVisible();
  const codes = new Set<string>();
  for (let i = 0; i < 20; i++) {
    for (const el of await page.locator(`${CURRENT} .gallery-cell .card`).all())
      codes.add((await el.getAttribute('data-code'))!);
    const next = page.locator(`${CURRENT} [data-pager="next"]`);
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await next.click();
  }
  expect(codes.size).toBe(52);
});

test('the public edition has no adult-only content at all', async ({ page, request }) => {
  await seed(page, { profile: { level: 10 } });
  await enterParlor(page);
  await setContent(page, 'placeholderArt'); // opens Settings → Content
  await expect(page.locator(`${CURRENT} [data-edition="public"]`)).toContainText('not available in this edition');
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"]`)).toHaveCount(0);
  // The adult-only asset folder is not part of the default build (the preview server
  // answers unknown paths with the app page, so check the content).
  expect(await (await request.get('assets/cards/mature/yummyhole_after_dark/README.md')).text()).not.toContain(
    'artwork drop folder',
  );
  // Adult-only gameboards are not shipped either (the preview server answers with the app page).
  const board = await request.get('assets/backgrounds/mature/ismokeshop_counter/preview.webp');
  expect(board.headers()['content-type'] ?? '').not.toContain('image/webp');
  // Even a saved opt-in from elsewhere cannot switch it on.
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { matureContent: true, ageVerified: true },
    }),
  );
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="COLLECTION"]`).click();
  await expectScreen(page, 'COLLECTION');
  expect(await deckIds(page)).not.toContain('yummyhole_after_dark');
});

test('placeholder mode does not replace delivered YummyHole art', async ({ page }) => {
  await seed(page, {
    profile: { unlockedDecks: ['classic', 'inspire', 'yummyhole_standard'] },
    settings: { placeholderArt: true },
  });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  await page.locator(`${CURRENT} select[data-gallery-deck]`).selectOption('yummyhole_standard');
  const card = page.locator(`${CURRENT} .gallery-cell .card[data-code="AS"][data-theme^="yummyhole_standard"]`);
  await expect(card).toHaveAttribute('data-art', 'atlas');
  await expect(card.locator('.card-art-img')).toHaveCSS('background-size', '1300% 400%');
});
