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
  expect(await deckIds(page)).toEqual(
    [
      'classic',
      'dantes_world',
      'eastern_woodlands',
      'fredericksburg',
      'fredericksburg_downtown',
      'freemasonry',
      'inspire',
      'jak_gold',
      'spycraft',
      'yummyhole_standard',
    ].sort(),
  );
  expect(matureRequests).toEqual([]);
});

test('deck details show attribution status and fallback cards', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  // A deck whose artwork has not been uploaded yet.
  await clickInPager(page, '[data-deck="freemasonry"]');
  const pending = page.locator('[data-deck-detail="freemasonry"]');
  await expect(pending).toContainText('Artist credit coming with the artwork');
  await expect(pending).toContainText('Art coming soon');
  await expect(pending.locator('.card[data-art="fallback"]')).toHaveCount(4);
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

test('placeholder artwork renders cards from the sprite-sheet template', async ({ page }) => {
  await enterParlor(page);
  await setContent(page, 'placeholderArt');
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="COLLECTION"]`).click();
  await expectScreen(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  // The template stands in only for decks whose artwork is still pending.
  await page.locator(`${CURRENT} select[data-gallery-deck]`).selectOption('freemasonry');

  // Scope to the new deck's card so the previous deck's card can't be read mid re-render.
  const card = page.locator(`${CURRENT} .gallery-cell .card[data-code="AS"][data-theme^="freemasonry"]`);
  await expect(card).toHaveAttribute('data-art', 'atlas');
  const style = await card.locator('.card-art-img').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { image: cs.backgroundImage, position: cs.backgroundPosition, size: cs.backgroundSize };
  });
  expect(style.image).toContain('/assets/cards/_placeholder/faces.svg');
  expect(style.position).toBe('0% 0%');
  expect(style.size).toBe('1300% 500%');

  // The sheet really loads.
  const loaded = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth);
        img.onerror = () => resolve(0);
        img.src = 'assets/cards/_placeholder/faces.svg';
      }),
  );
  expect(loaded).toBe(1560);
});
