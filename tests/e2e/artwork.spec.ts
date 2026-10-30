import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor } from './helpers';

/**
 * Release check of the original artwork, in a real browser: every image
 * decodes at its expected size, every card cell holds artwork (no blank or
 * missing cards), backs are whole upright cards, and cards on screen keep
 * their proportions.
 */
test.use({ serviceWorkers: 'block' });

const DECKS = [
  ['dantes_world', "Dante's World"],
  ['fredericksburg_downtown', 'Downtown Fredericksburg Collector'],
  ['eastern_woodlands', 'Eastern Woodlands'],
  ['fredericksburg', 'Fredericksburg Heritage'],
  ['spycraft', 'Spycraft'],
  ['inspire', 'BlackJak INSPIRE'],
  ['jak_gold', 'BlackJak Jak Gold'],
  ['classic', 'BlackJak Standard'],
] as const;

interface ImageInfo {
  ok: boolean;
  width: number;
  height: number;
}

/** Decodes an image in the page. */
const decode = (page: Page, path: string) =>
  page.evaluate(async (p): Promise<ImageInfo> => {
    try {
      const res = await fetch(p);
      if (!res.ok) return { ok: false, width: 0, height: 0 };
      const bmp = await createImageBitmap(await res.blob());
      return { ok: true, width: bmp.width, height: bmp.height };
    } catch {
      return { ok: false, width: 0, height: 0 };
    }
  }, path);

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'artwork files are the same on every layout');
});

test('every deck: 52 faces with artwork in every cell, a whole back, and a preview', async ({ page }) => {
  await page.goto('./');
  for (const [id, name] of DECKS) {
    await test.step(name, async () => {
      const base = `assets/cards/${id}`;
      const atlas = (await (await page.request.get(`${base}/atlas.json`)).json()) as {
        cell: { width: number; height: number };
        frames: Record<string, unknown>;
        layout: { columns: number; rows: number };
      };
      expect(Object.keys(atlas.frames)).toHaveLength(52);
      const faces = await decode(page, `${base}/faces.webp`);
      expect(faces.ok, `${id} faces decode`).toBe(true);
      expect(faces.width).toBe(atlas.cell.width * atlas.layout.columns);
      expect(faces.height).toBe(atlas.cell.height * atlas.layout.rows);

      // Every cell is covered by an opaque card with real detail (not blank, not missing).
      const cells = await page.evaluate(
        async ({ url, cell, cols, rows }) => {
          const bmp = await createImageBitmap(await (await fetch(url)).blob());
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(bmp, 0, 0);
          const out: { coverage: number; spread: number }[] = [];
          for (let r = 0; r < rows; r++)
            for (let k = 0; k < cols; k++) {
              const d = ctx.getImageData(k * cell.width, r * cell.height, cell.width, cell.height).data;
              let opaque = 0;
              let sum = 0;
              let sq = 0;
              let n = 0;
              for (let i = 0; i < d.length; i += 16) {
                if (d[i + 3]! > 200) opaque++;
                const v = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
                sum += v;
                sq += v * v;
                n++;
              }
              const mean = sum / n;
              out.push({ coverage: opaque / n, spread: Math.sqrt(sq / n - mean * mean) });
            }
          return out;
        },
        { url: `${base}/faces.webp`, cell: atlas.cell, cols: atlas.layout.columns, rows: atlas.layout.rows },
      );
      expect(cells).toHaveLength(52);
      cells.forEach((c, i) => {
        expect(c.coverage, `${id} cell ${i} is covered by a card`).toBeGreaterThan(0.6);
        expect(c.spread, `${id} cell ${i} has artwork`).toBeGreaterThan(12);
      });

      const back = await decode(page, `${base}/back.webp`);
      expect(back.ok, `${id} back decodes`).toBe(true);
      expect(back.width / back.height, `${id} back is a whole upright card`).toBeGreaterThan(0.55);
      expect(back.width / back.height).toBeLessThan(0.85);
      expect((await decode(page, `${base}/preview.webp`)).ok, `${id} preview decodes`).toBe(true);
    });
  }
});

test('menu paintings, logo, title graphic, icons and the three painted gameboards load', async ({ page }) => {
  await page.goto('./');
  const expectImage = async (path: string, min: [number, number]) => {
    const img = await decode(page, path);
    expect(img.ok, `${path} loads`).toBe(true);
    expect(img.width, path).toBeGreaterThanOrEqual(min[0]);
    expect(img.height, path).toBeGreaterThanOrEqual(min[1]);
    return img;
  };
  // Sunlit Rappahannock Riverfront / Fredericksburg Riverfront at Midnight, kept at 16:9.
  for (const scene of ['day', 'night']) {
    const img = await expectImage(`assets/backgrounds/menu/${scene}.webp`, [1600, 900]);
    expect(img.width / img.height).toBeCloseTo(1672 / 941, 2);
  }
  // Transparent title logo, and the title graphic used for the app icons.
  await expectImage('assets/branding/logo.webp', [900, 500]);
  for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'])
    await expectImage(`assets/icons/${icon}`, [180, 180]);
  await expectImage('assets/branding/social-card.jpg', [1200, 630]);
  // Emerald Felt, Picnic Tabletop, Rappahannock Woven Mat: full paintings and gallery thumbnails, 4:3.
  for (const board of ['backroom_card_table', 'picnic_table', 'rappahannock_riverside']) {
    const bg = await expectImage(`assets/backgrounds/${board}/background.webp`, [1400, 1000]);
    expect(bg.width / bg.height).toBeCloseTo(4 / 3, 1);
    await expectImage(`assets/backgrounds/${board}/preview.webp`, [400, 300]);
  }
});

test('cards on screen keep their proportions and show the real artwork', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  for (const [id, name] of DECKS) {
    await test.step(name, async () => {
      await page.locator(`${CURRENT} select[data-gallery-deck]`).selectOption(id);
      const card = page.locator(`${CURRENT} [data-binder="${id}"] .gallery-cell .card[data-code="KH"]`);
      await expect(card).toHaveAttribute('data-art', 'atlas');
      const img = card.locator('.card-art-img');
      // The art fills its frame with no distortion: the drawn box has the cell's own ratio.
      const atlas = (await (await page.request.get(`assets/cards/${id}/atlas.json`)).json()) as {
        cell: { width: number; height: number };
      };
      await expect
        .poll(() =>
          img.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return r.height ? r.width / r.height : 0;
          }),
        )
        .toBeCloseTo(atlas.cell.width / atlas.cell.height, 1);
      // Background-image really loaded.
      const loaded = await img.evaluate(async (el) => {
        const url = getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
        if (!url) return false;
        const i = new Image();
        i.src = url;
        await i.decode().catch(() => undefined);
        return i.naturalWidth > 0;
      });
      expect(loaded, `${id} card art image loads`).toBe(true);
    });
  }
});
