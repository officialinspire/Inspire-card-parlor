import { expect, test } from '@playwright/test';
import { enterParlor, expectScreen } from './helpers';

test('downloaded visual library decodes offline at the Pages project path', async ({ page, context }) => {
  test.setTimeout(120000);
  await enterParlor(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    (window as any).__ICP__.store.dispatch({ type: 'NAVIGATE', to: 'SETTINGS' });
  });
  await expectScreen(page, 'SETTINGS');
  await page.getByRole('tab', { name: 'Data', exact: true }).click();
  await page.locator('[data-action="download-visuals"]').click();
  await expect(page.locator('[data-offline-visual-status]')).toContainText('All visuals saved', { timeout: 90000 });
  const manifest = await page.evaluate(async () => (await fetch('./visual-cache.json')).json());
  expect(manifest.files.length).toBeGreaterThan(600);
  expect(manifest.files.some((p: string) => p.includes('/mature/'))).toBe(false);
  // Clear HTTP memory cache: reload and prove the worker supplies every visual/data file.
  await context.setOffline(true);
  await enterParlor(page);
  const failures = await page.evaluate(async (files: string[]) => {
    const failed: string[] = [];
    // Fetch sequentially to keep this a small-memory phone check, too.
    for (const file of files) {
      const response = await fetch(file);
      if (!response.ok) failed.push(file);
    }
    for (const file of [
      './assets/cards/jak_gold/faces.webp',
      './assets/backgrounds/mrs_gray_safehouse/background.webp',
      './assets/story/characters/cheryl/portrait-greet.webp',
    ]) {
      try {
        const img = new Image();
        img.src = file;
        await img.decode();
        if (!img.naturalWidth) failed.push(file);
      } catch {
        failed.push(file);
      }
    }
    return failed;
  }, manifest.files);
  expect(failures).toEqual([]);
  await context.setOffline(false);
  // A second download reuses saved files and still verifies the whole pack.
  await page.evaluate(() => (window as any).__ICP__.store.dispatch({ type: 'NAVIGATE', to: 'SETTINGS' }));
  await expectScreen(page, 'SETTINGS');
  await page.getByRole('tab', { name: 'Data', exact: true }).click();
  await page.locator('[data-action="download-visuals"]').click();
  await expect(page.locator('[data-offline-visual-status]')).toContainText('All visuals saved');
});
