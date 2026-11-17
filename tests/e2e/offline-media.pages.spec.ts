import { expect, test } from '@playwright/test';
import { enterParlor, expectScreen } from './helpers';

/**
 * An installed phone with no connection: every music track and the studio
 * intro video come from the offline pack, play, and seek (byte ranges served
 * by the worker), after the page's HTTP memory cache is gone.
 */
test('the offline pack plays every music track and the intro video with no connection', async ({ page, context }) => {
  test.setTimeout(180000);
  await enterParlor(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    // The intro video is precached when the worker installs, before any download.
    const names = await caches.keys();
    const media = names.find((n) => n.startsWith('icp-media-'));
    if (!media) throw new Error('no media cache');
    const intro = new URL('./assets/video/inspiresoftwareintro.mp4', location.href).href;
    if (!(await (await caches.open(media)).match(intro))) throw new Error('intro video not precached');
    window.dispatchEvent(new Event('appinstalled'));
  });
  // Installing downloads the whole pack: visuals, music and video.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const key of await caches.keys())
            if (await (await caches.open(key)).match(new URL('./visuals-ready', location.href).href)) return true;
          return false;
        }),
      { timeout: 150000 },
    )
    .toBe(true);
  const manifest = await page.evaluate(async () => (await fetch('./visual-cache.json')).json());
  const media: string[] = manifest.files.filter((f: string) => /\.(mp3|m4a|mp4)$/.test(f));
  expect(media.filter((f) => f.includes('/music/')).length).toBe(10);
  expect(media).toContain('./assets/video/inspiresoftwareintro.mp4');

  await context.setOffline(true);
  await enterParlor(page);

  const report = await page.evaluate(
    async ({ files, all, sizes }: { files: string[]; all: string[]; sizes: number[] }) => {
      const failed: string[] = [];
      for (const file of files) {
        const size = sizes[all.indexOf(file)]!;
        // Byte ranges, exactly as media players ask for them.
        const head = await fetch(file, { headers: { Range: 'bytes=0-1023' } });
        if (head.status !== 206 || (await head.arrayBuffer()).byteLength !== 1024) failed.push(`${file}: range`);
        const tail = await fetch(file, { headers: { Range: `bytes=${size - 10}-` } });
        if (tail.headers.get('content-range') !== `bytes ${size - 10}-${size - 1}/${size}`)
          failed.push(`${file}: tail`);
        // Real playback through a media element, then a seek to near the end.
        const el = document.createElement(file.endsWith('.mp4') ? 'video' : 'audio');
        el.muted = true;
        el.preload = 'auto';
        el.src = file;
        const played = await new Promise<string>((resolve) => {
          const timer = setTimeout(() => resolve('timeout'), 15000);
          el.addEventListener('error', () => resolve(`error ${el.error?.code}`), { once: true });
          el.addEventListener('timeupdate', function check() {
            if (el.currentTime < 0.2) return;
            el.removeEventListener('timeupdate', check);
            el.currentTime = Math.max(0, el.duration - 1.5);
            el.addEventListener('seeked', () => (clearTimeout(timer), resolve('ok')), { once: true });
          });
          void el.play().catch((e: Error) => resolve(`play ${e.name}`));
        });
        el.pause();
        el.removeAttribute('src');
        el.load();
        if (played !== 'ok') failed.push(`${file}: ${played}`);
      }
      return failed;
    },
    { files: media, all: manifest.files, sizes: manifest.sizes },
  );
  expect(report).toEqual([]);

  // The game itself, offline: Touch to Start plays the studio video, then the menu's music.
  await page.evaluate(() => {
    localStorage.removeItem('icp:intro-seen');
    sessionStorage.clear();
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __media: HTMLMediaElement[] };
    w.__media = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      w.__media.push(this);
      return play.call(this);
    };
  });
  await page.goto('./');
  const enter = page.getByRole('button', { name: 'Enter Parlor' });
  const skip = page.locator('[data-action="skip-intro"]');
  await expect(enter.or(skip).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
  if (await skip.isVisible()) await skip.click().catch(() => undefined);
  await enter.click();
  const video = page.locator('[data-studio-intro] video');
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 10000 })
    .toBeGreaterThan(0.2);
  await page.locator('[data-action="skip-studio-intro"]').click();
  await expectScreen(page, 'MAIN_MENU');
  // The music player's recording (crossOrigin media through Web Audio) plays from the pack.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          ((window as unknown as { __media?: HTMLMediaElement[] }).__media ?? []).some(
            (el) => el.src.includes('/assets/music/') && !el.paused && el.currentTime > 0.3,
          ),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await context.setOffline(false);
});
