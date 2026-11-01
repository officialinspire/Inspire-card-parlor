import { expect, test } from '@playwright/test';

/**
 * The story sprites load and decode in a real browser (phone and desktop),
 * from the built site, through the same relative paths the game uses.
 */
test.use({ serviceWorkers: 'block' });
test.beforeEach(({}, info) => {
  test.skip(!['desktop', 'phone-portrait'].includes(info.project.name), 'one desktop and one phone layout');
});

interface Sprite {
  id: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
}
interface Sheet {
  id: string;
  group: string;
  sprites: Sprite[];
  board?: { background: string; preview: string };
}

test('every story sprite, thumbnail and board image decodes at its recorded size', async ({ page }) => {
  await page.goto('./');
  const manifest = (await (await page.request.get('assets/story/manifest.json')).json()) as { sheets: Sheet[] };
  const sprites = manifest.sheets.flatMap((s) => s.sprites);
  expect(sprites.length).toBeGreaterThanOrEqual(279);
  const result = await page.evaluate(
    async ({ list, boards }) => {
      const load = (src: string) =>
        new Promise<[number, number]>((resolve) => {
          const img = new Image();
          img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
          img.onerror = () => resolve([0, 0]);
          img.src = src;
        });
      const bad: string[] = [];
      for (const s of list) {
        const [w, h] = await load(s.src);
        if (w !== s.width || h !== s.height) bad.push(`${s.id}: ${w}x${h}`);
        const [tw] = await load(s.thumb);
        if (!tw) bad.push(`${s.id} thumb`);
      }
      for (const b of boards) for (const src of [b.background, b.preview]) if (!(await load(src))[0]) bad.push(src);
      return bad;
    },
    { list: sprites, boards: manifest.sheets.flatMap((s) => (s.board ? [s.board] : [])) },
  );
  expect(result).toEqual([]);
});

test('sprites keep their transparency and proportions when shown on a page', async ({ page }) => {
  await page.goto('./');
  const manifest = (await (await page.request.get('assets/story/manifest.json')).json()) as { sheets: Sheet[] };
  const pick = [
    'cheryl/portrait-greet',
    'george-washington/full-signature',
    'parlor-ui/arrow-skip',
    'thirteenth-hand-vfx/spectral-ring',
    'passport-stamps/heron-river',
  ];
  const sprites = manifest.sheets.flatMap((s) => s.sprites).filter((s) => pick.includes(s.id));
  expect(sprites).toHaveLength(pick.length);
  const out = await page.evaluate(async (list) => {
    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;inset:0;display:flex;flex-wrap:wrap;align-items:flex-start;gap:4px;background:#f0f;z-index:99999';
    document.body.append(host);
    const res: { id: string; ratio: number; expected: number; corner: number }[] = [];
    for (const s of list) {
      const img = document.createElement('img');
      img.src = s.src;
      img.width = s.width;
      img.height = s.height;
      img.style.cssText = 'max-width:45vw;height:auto';
      host.append(img);
      await img.decode();
      const r = img.getBoundingClientRect();
      // Corner pixel alpha (sprites are trimmed artwork on transparency).
      const c = document.createElement('canvas');
      c.width = s.width;
      c.height = s.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      res.push({
        id: s.id,
        ratio: r.width / r.height,
        expected: s.width / s.height,
        corner: ctx.getImageData(0, 0, 1, 1).data[3]!,
      });
    }
    return res;
  }, sprites);
  for (const r of out) {
    expect(r.ratio, r.id).toBeCloseTo(r.expected, 1);
    expect(r.corner, `${r.id} has a transparent background`).toBeLessThan(40);
  }
});
