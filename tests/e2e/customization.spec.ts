import { deflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickInPager, clickNav, enterParlor, expectScreen, playGame, revealInPager, seed } from './helpers';

test.describe.configure({ timeout: 90_000 });
// The app's offline service worker would answer image requests itself, bypassing the
// simulated uploads below, so this spec runs without it.
test.use({ serviceWorkers: 'block' });

/** Minimal solid-colour PNG, so the test serves real PNG "uploads" without committing any art. */
function png(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).fill(Buffer.from([r, g, b]))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Simulates artwork uploaded with an artwork.json manifest (served by the test, not committed). */
async function uploadArtwork(page: Page) {
  await page.route('**/assets/artwork.json', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        decks: {
          classic: {
            status: 'ready',
            artist: { name: 'Route Artist', url: 'https://example.com/artist' },
            faces: {
              type: 'atlas',
              image: { path: 'faces', formats: ['png'] },
              grid: { columns: 13, rows: 5, backCell: { column: 0, row: 4 } },
            },
            back: { atlasFrame: 'back' },
            preview: { path: 'preview', formats: ['png'] },
            variants: [
              {
                id: 'gilded',
                name: 'Gilded Test',
                description: 'Test artwork',
                artist: { name: 'Route Artist' },
                rarity: 'epic',
                unlock: { type: 'credits', value: 100 },
                assets: { status: 'ready', back: { path: 'gilded-back', formats: ['png'] } },
              },
            ],
          },
        },
        boards: { backroom_card_table: { status: 'ready', artist: { name: 'Board Artist' } } },
      }),
    }),
  );
  const image = (body: Buffer) => ({ contentType: 'image/png', body });
  // A 13×5 sheet of 120×168 cells, like the placeholder template.
  await page.route('**/assets/cards/classic/faces.png', (r) => r.fulfill(image(png(1560, 840, [240, 236, 226]))));
  await page.route('**/assets/cards/classic/preview.png', (r) => r.fulfill(image(png(480, 320, [220, 210, 190]))));
  await page.route('**/assets/cards/classic/gilded-back.png', (r) => r.fulfill(image(png(120, 168, [201, 162, 39]))));
  await page.route('**/assets/backgrounds/backroom_card_table/*.png', (r) =>
    r.fulfill(image(png(160, 90, [32, 74, 51]))),
  );
}

async function openKlondike(page: Page) {
  await clickNav(page, 'GAME_SELECTION');
  await playGame(page, 'klondike');
  await clickNav(page, 'BOARD_SELECTION');
  await clickNav(page, 'GAMEPLAY');
  const deal = page.locator('[data-dialog-action="deal"]');
  const resume = page.locator('[data-dialog-action="resume"]');
  await expect(deal.or(resume)).toBeVisible();
  if (await resume.isVisible()) await resume.click();
  else await deal.click();
  await expect(page.locator(`${CURRENT} .sol-card`).first()).toBeVisible();
}

const moves = async (page: Page) =>
  Number((await page.locator(`${CURRENT} [data-hud="moves"]`).textContent())!.replace(/\D/g, ''));

test('favorites, filters and collection completion', async ({ page }) => {
  await seed(page, { profile: { level: 5 } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  const completion = Number(await page.locator(`${CURRENT} [data-completion]`).getAttribute('data-completion'));
  expect(completion).toBeGreaterThan(0);
  expect(completion).toBeLessThan(100);
  await expect(page.locator(`${CURRENT} [data-completion]`)).toContainText(`${completion}% complete`);

  // Star Jak Gold, then filter to favorites.
  const jak = await revealInPager(page, '[data-deck="jak_gold"]');
  await jak.locator('[data-favorite]').click();
  await expect(jak.locator('[data-favorite]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('radio', { name: 'Favorites' }).click();
  await expect(page.locator(`${CURRENT} [data-deck]`)).toHaveCount(1);
  await expect(page.locator(`${CURRENT} [data-deck="jak_gold"]`)).toBeVisible();

  // Owned filter hides locked decks.
  await page.getByRole('radio', { name: 'Owned' }).click();
  await expect(page.locator(`${CURRENT} [data-deck="freemasonry"]`)).toHaveCount(0);

  // Favorites persist.
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  await clickNav(page, 'COLLECTION');
  await page.getByRole('radio', { name: 'Favorites' }).click();
  await expect(page.locator(`${CURRENT} [data-deck="jak_gold"]`)).toBeVisible();
});

test('deck details: artist, unlock status, gallery of any deck', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await (await revealInPager(page, '[data-deck="freemasonry"]')).locator('.tile-main').click();
  const detail = page.locator('[data-deck-detail="freemasonry"]');
  await expect(detail.locator('[data-artist]')).toContainText('Artist credit coming with the artwork');
  await expect(detail.locator('[data-unlock="locked"]')).toContainText('Reach level 12');
  await page.locator('[data-dialog-action="gallery"]').click();
  await expect(page.locator(`${CURRENT} [data-gallery-deck]`)).toHaveValue('freemasonry');
  await expect(page.locator(`${CURRENT} .gallery-cell .card`).first()).toBeVisible();
});

test('card back is chosen independently of the deck', async ({ page }) => {
  await seed(page, { profile: { level: 5 } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="backs"]`).click();
  await (await revealInPager(page, '[data-back="jak_gold"]')).click();
  await expect(page.locator(`${CURRENT} [data-back="jak_gold"]`)).toHaveAttribute('aria-pressed', 'true');
  await clickNav(page, 'home', 'MAIN_MENU');
  await openKlondike(page);
  // Faces from the Classic deck, backs from Jak Gold.
  await expect(page.locator(`${CURRENT} .sol-card.card-face`).first()).toHaveAttribute('data-theme', /^classic@/);
  await expect(page.locator(`${CURRENT} .sol-card.card-back`).first()).toHaveAttribute('data-theme', /^jak_gold@/);
});

test('changing board, deck or back mid-game keeps the game exactly as it was', async ({ page }) => {
  await seed(page, { profile: { level: 6 }, settings: { reducedMotion: false } });
  await page.addInitScript(() => ((window as unknown as { __ICP_TEST_SEED__: number }).__ICP_TEST_SEED__ = 7));
  await enterParlor(page);
  await openKlondike(page);
  await page.locator(`${CURRENT} .sol-card[data-pile="stock"]`).last().click();
  await expect.poll(() => moves(page)).toBe(1);
  const layout = () =>
    page
      .locator(`${CURRENT} .sol-card`)
      .evaluateAll((els) =>
        els.map((e) => `${e.getAttribute('data-pile')}:${e.getAttribute('data-code') ?? 'down'}`).join(),
      );
  const before = await layout();
  const table = page.locator(`${CURRENT}.table`);
  await expect(table).toHaveAttribute('data-board', 'backroom_card_table');

  await page.locator(`${CURRENT} [data-action="game-settings"]`).click();
  await page.locator('[data-pick-board="woodland_clearing"]').click();
  await expect(table).toHaveAttribute('data-board', 'woodland_clearing');
  await expect(page.locator(`${CURRENT} [data-ambient="leaves"]`)).toBeAttached();
  await page.locator('[data-pick-deck="inspire"]').click();
  await page.locator('[data-pick-back="jak_gold"]').click();
  await page.keyboard.press('Escape');

  await expect(page.locator(`${CURRENT} .sol-card.card-face`).first()).toHaveAttribute('data-theme', /^inspire@/);
  await expect(page.locator(`${CURRENT} .sol-card.card-back`).first()).toHaveAttribute('data-theme', /^jak_gold@/);
  expect(await moves(page)).toBe(1);
  expect(await layout()).toBe(before);
  await expect(page.locator(`${CURRENT} .screen-subtitle`)).toHaveText('INSPIRE · Woodland Clearing');
});

test('ambient layers and high contrast are optional', async ({ page }) => {
  await seed(page, { settings: { reducedMotion: false } });
  await enterParlor(page);
  await openKlondike(page);
  const table = page.locator(`${CURRENT}.table`);
  await expect(page.locator(`${CURRENT} [data-ambient="dust"]`)).toBeAttached();
  await page.locator(`${CURRENT} [data-action="game-settings"]`).click();
  await page.locator('[data-customizer] [data-setting="ambientAnimations"]').click();
  await expect(page.locator(`${CURRENT} .ambient`)).toHaveCount(0);
  await page.locator('[data-customizer] [data-setting="highContrastTable"]').click();
  await expect(table).toHaveClass(/high-contrast/);
  await page.keyboard.press('Escape');
  // Reduced motion also switches ambient animation off.
  await page.locator(`${CURRENT} [data-action="game-settings"]`).click();
  await page.locator('[data-customizer] [data-setting="ambientAnimations"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator(`${CURRENT} .ambient`)).toHaveCount(1);
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { reducedMotion: true },
    }),
  );
  await expect(page.locator(`${CURRENT} .ambient`)).toHaveCount(0);
});

test('all nine gameboards with credits, unlocks and ambient previews', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'GAMEBOARDS');
  const ids = new Set<string>();
  const first = page.locator(`${CURRENT} [data-pager="dot-0"]`);
  if (await first.isVisible()) await first.click();
  for (let i = 0; i < 10; i++) {
    for (const el of await page.locator(`${CURRENT} [data-board]`).all())
      ids.add((await el.getAttribute('data-board'))!);
    const next = page.locator(`${CURRENT} [data-pager="next"]`);
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await next.click();
  }
  expect(ids.size).toBe(9);
  await clickInPager(page, '[data-board="masonic_study"]');
  const detail = page.locator('[data-board-detail="masonic_study"]');
  await expect(detail.locator('[data-unlock="locked"]')).toContainText('Reach level 12');
  await expect(detail.locator('[data-artist]')).toBeVisible();
  await expect(detail.locator('[data-ambient="candle"]')).toBeAttached();
});

test('uploaded artwork: atlas faces keep their proportions, previews, credits, collectible art and board images', async ({
  page,
}) => {
  await uploadArtwork(page);
  await seed(page, { profile: { credits: 250 } });
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');

  // Gallery cards come from the sprite sheet, letterboxed to the frame's own ratio.
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  const card = page.locator(`${CURRENT} .gallery-cell .card[data-code="AS"]`);
  await expect(card).toHaveAttribute('data-art', 'atlas');
  // Poll: the gallery grid may still be laying out on its first frame.
  await expect
    .poll(() =>
      card.locator('.card-art-img').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.height ? Math.round((r.width / r.height) * 100) / 100 : 0;
      }),
    )
    .toBeCloseTo(120 / 168, 1);

  // Detail: preview image, linked artist credit, and collectible artwork bought with credits.
  await page.locator(`${CURRENT} [data-tab="decks"]`).click();
  await (await revealInPager(page, '[data-deck="classic"]')).locator('.tile-main').click();
  const detail = page.locator('[data-deck-detail="classic"]');
  await expect(detail.locator('[data-preview="image"] img')).toBeVisible();
  await expect(detail.locator('[data-artist] a')).toHaveAttribute('href', 'https://example.com/artist');
  await detail.locator('[data-variant-buy="gilded"]').click();
  await page.locator('[data-dialog-action="true"]').click();
  await expect(detail.locator('[data-variant-use="gilded"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(`${CURRENT} .pill-credits`)).toContainText('150');

  // The new back is now collectible as a card back.
  await page.locator(`${CURRENT} [data-tab="backs"]`).click();
  await (await revealInPager(page, '[data-back="classic@gilded"]')).click();

  // Credits list shows the uploaded credits.
  await clickNav(page, 'home', 'MAIN_MENU');
  await page.locator(`${CURRENT} .menu-grid [data-nav="SETTINGS"]`).click();
  await page.locator(`${CURRENT} [data-tab="data"]`).click();
  await page.locator(`${CURRENT} [data-action="credits"]`).click();
  await expect(page.locator('[data-credits]')).toContainText('Art by Route Artist');
  await expect(page.locator('[data-credits]')).toContainText('Art by Board Artist');
  await page.keyboard.press('Escape');

  // At the table: the uploaded board image and the collected back.
  await clickNav(page, 'home', 'MAIN_MENU');
  await openKlondike(page);
  await expect(page.locator(`${CURRENT}.table`)).toHaveAttribute('data-board-art', 'image');
  const back = page.locator(`${CURRENT} .sol-card.card-back`).first();
  await expect(back).toHaveAttribute('data-theme', /classic@gilded/);
  await expect(back).toHaveAttribute('data-art', 'image');
});
