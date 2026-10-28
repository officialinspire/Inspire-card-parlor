import { expect, test, type Page } from '@playwright/test';
import {
  CURRENT,
  clickInPager,
  clickNav,
  enterParlor,
  expectScreen,
  revealInPager,
  screenState,
  seed,
} from './helpers';

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
  await clickInPager(page, '[data-deck="inspire"]');
  const detail = page.locator('[data-deck-detail="inspire"]');
  await expect(detail).toContainText('Artist credit coming with the artwork');
  await expect(detail).toContainText('Art coming soon');
  await expect(detail.locator('.card[data-art="fallback"]')).toHaveCount(4);
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

test('mature decks need confirmation, stay out of ordinary previews, and can be switched off', async ({ page }) => {
  await seed(page, { profile: { level: 10 } });
  await enterParlor(page);

  // Cancelling keeps them hidden.
  await setContent(page, 'matureContent');
  await expect(page.getByRole('alertdialog')).toContainText('18');
  await page.locator('[data-dialog-action="false"]').click();
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"] input`)).not.toBeChecked();

  // Confirming adds the deck, shown with a neutral cover in the catalog.
  await page.locator(`${CURRENT} [data-setting="matureContent"]`).click();
  await page.locator('[data-dialog-action="true"]').click();
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"] input`)).toBeChecked();
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="COLLECTION"]`).click();
  await expectScreen(page, 'COLLECTION');
  expect(await deckIds(page)).toContain('yummyhole_after_dark');
  const tile = await revealInPager(page, '[data-deck="yummyhole_after_dark"]');
  await expect(tile.locator('.card')).toHaveAttribute('data-cover', 'true');
  await expect(tile).toContainText('18+');

  // The explicit detail view shows the deck; choose it.
  await tile.click();
  await expect(page.locator('[data-deck-detail="yummyhole_after_dark"] .card[data-cover]')).toHaveCount(0);
  await page.locator('[data-dialog-action="use"]').click();

  // The main menu is an ordinary preview: neutral cover, not the deck's art.
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('Yummyhole After Dark');
  await expect(page.locator(`${CURRENT} [data-status="deck"] .card`)).toHaveAttribute('data-cover', 'true');

  // Switching off hides the deck again and resets the selection.
  await setContent(page, 'matureContent');
  await expect(page.locator(`${CURRENT} [data-setting="matureContent"] input`)).not.toBeChecked();
  await clickNav(page, 'home', 'MAIN_MENU');
  await expect(page.locator(`${CURRENT} [data-value="deck"]`)).toHaveText('Classic');
});

test('placeholder artwork renders cards from the sprite-sheet template', async ({ page }) => {
  await enterParlor(page);
  await setContent(page, 'placeholderArt');
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="COLLECTION"]`).click();
  await expectScreen(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();

  const card = page.locator(`${CURRENT} .gallery-cell .card[data-code="AS"]`);
  await expect(card).toHaveAttribute('data-art', 'atlas');
  const style = await card.evaluate((el) => {
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
