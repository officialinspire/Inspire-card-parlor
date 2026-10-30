import { expect, test } from '@playwright/test';
import { CURRENT, enterParlor, expectScreen } from './helpers';

/** The installable app: manifest, icons, service worker and offline play. */
test.beforeEach(({}, info) => {
  test.skip(!['desktop', 'phone-portrait'].includes(info.project.name), 'one desktop and one phone layout');
});

test('the manifest is installable and its icons load', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = (await (await request.get(href!)).json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({ name: 'INSPIRE CARD PARLOR', short_name: 'Card Parlor', start_url: './' });
  expect(['fullscreen', 'standalone']).toContain(manifest.display);
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
});

test('after one visit the parlor opens and plays offline, keeping saved progress', async ({ page, context }) => {
  await enterParlor(page);
  // Wait until the service worker controls the page and has precached the release.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
  const version = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(String(e.data));
        navigator.serviceWorker.controller!.postMessage('version', [ch.port2]);
      }),
  );
  expect(version).toMatch(/^icp-\d+\.\d+\.\d+-[0-9a-f]{10}$/);
  await expect
    .poll(() => page.evaluate(async (v) => (await (await caches.open(v)).keys()).length, version))
    .toBeGreaterThan(10);
  // Progress made online (saved by the app itself) must still be there offline.
  await page.evaluate(() =>
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_PROFILE',
      patch: { credits: 777 },
    }),
  );
  await page.waitForTimeout(400);

  await context.setOffline(true);
  await enterParlor(page);
  await expect(page.locator(`${CURRENT} .pill-credits, ${CURRENT} [aria-label="Credits"]`).first()).toContainText(
    '777',
  );
  // A game with the default deck, from the cache.
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'klondike' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  await expect(page.locator(`${CURRENT} .card[data-art="atlas"]`).first()).toBeVisible();
  await context.setOffline(false);
});

test('search and social metadata: title, description, canonical, Open Graph, Twitter and structured data', async ({
  page,
  request,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/INSPIRE CARD PARLOR/);
  const meta = (sel: string) => page.locator(sel).first().getAttribute('content');
  expect((await meta('meta[name="description"]'))!.length).toBeGreaterThan(80);
  const canonical = 'https://officialinspire.github.io/Inspire-card-parlor/';
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  expect(await meta('meta[property="og:url"]')).toBe(canonical);
  expect(await meta('meta[property="og:title"]')).toContain('INSPIRE CARD PARLOR');
  const image = (await meta('meta[property="og:image"]'))!;
  expect(image).toBe(`${canonical}assets/branding/social-card.jpg`);
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await meta('meta[name="twitter:image"]')).toBe(image);
  // The social image ships with the build (checked here at its local path).
  expect((await request.get('assets/branding/social-card.jpg')).ok()).toBe(true);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!) as Record<
    string,
    unknown
  >;
  expect(ld).toMatchObject({ '@type': 'VideoGame', name: 'INSPIRE CARD PARLOR', url: canonical });
});
