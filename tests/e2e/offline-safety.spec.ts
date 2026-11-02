import { expect, test } from '@playwright/test';
import { enterParlor, seed, expectScreen } from './helpers';

test('activation and repair preserve another game cache and saved progress', async ({ page }) => {
  await page.goto('./manifest.webmanifest');
  await page.evaluate(async () => {
    await (await caches.open('blackjak-v1')).put('./sentinel', new Response('keep'));
    await (await caches.open('icp-0.0.1-stale')).put('./old', new Response('old'));
  });
  await seed(page, { profile: { credits: 777, schemaVersion: 3 }, settings: { musicPaused: true } });
  await enterParlor(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
  expect(await page.evaluate(() => caches.has('blackjak-v1'))).toBe(true);
  expect(await page.evaluate(() => caches.has('icp-0.0.1-stale'))).toBe(false);
  await expect(page.getByRole('alertdialog', { name: 'Update available' })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __icpRepair(): void }).__icpRepair());
  await page.waitForURL(/fresh=/);
  await enterParlor(page);
  expect(await page.evaluate(() => caches.has('blackjak-v1'))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('icp:profile')!).credits)).toBe(777);
});

test('an update offers Later or Reload and preserves progress across reload', async ({ page }) => {
  await enterParlor(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Return with a controlling worker, as an existing player would.
  await enterParlor(page);
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  const dialog = page.getByRole('alertdialog', { name: 'Update available' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Later', exact: true }).click();
  await expectScreen(page, 'MAIN_MENU');
  await enterParlor(page);
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await expect(dialog).toBeVisible();
  // Change progress immediately before reloading, exercising the pagehide flush.
  await page.evaluate(() => {
    (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch({
      type: 'UPDATE_PROFILE',
      patch: { credits: 888 },
    });
  });
  await Promise.all([page.waitForEvent('load'), dialog.getByRole('button', { name: 'Reload', exact: true }).click()]);
  await expect(page.getByRole('button', { name: 'Enter Parlor' })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('icp:profile')!).credits)).toBe(888);
});
