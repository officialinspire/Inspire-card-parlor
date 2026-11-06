import { expect, test, type Page } from '@playwright/test';
import { clickNav, expectScreen, seed } from './helpers';

test.use({ serviceWorkers: 'block' });

const start = (page: Page) => page.getByRole('button', { name: 'Enter Parlor' });

const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test('the studio video plays alone and ordinary clicks still have sound after it ends', async ({ page }) => {
  await seed(page, {
    settings: {
      startupIntro: 'brief',
      reducedMotion: true,
      ambience: false,
      musicPaused: true,
      masterVolume: 0.5,
      sfxVolume: 0.6,
    },
  });
  await page.addInitScript(() => {
    const w = window as unknown as { sfxStarts: number; studioOverlap: number };
    w.sfxStarts = 0;
    w.studioOverlap = 0;
    const original = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      w.sfxStarts++;
      if (document.querySelector('[data-studio-intro]')) w.studioOverlap++;
      return original.call(this, when);
    };
  });
  const sounds = () => page.evaluate(() => (window as unknown as { sfxStarts: number }).sfxStarts);
  await page.goto('./');
  await start(page).click();
  const video = page.locator('[data-studio-intro] video');
  await expect(video).toHaveJSProperty('volume', 0.3);
  await expect(video).toHaveJSProperty('muted', false);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.1);
  expect(await sounds()).toBe(0);
  await expectScreen(page, 'MAIN_MENU');
  expect(await page.evaluate(() => (window as unknown as { studioOverlap: number }).studioOverlap)).toBe(0);
  const beforeClick = await sounds();
  await clickNav(page, 'GAMEBOARDS');
  await expect.poll(sounds).toBeGreaterThan(beforeClick);
});

test('hiding during a pending video play does not skip the intro', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief', sfxVolume: 0 } });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    const w = window as unknown as { rejectIntro?: (error: DOMException) => void };
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLVideoElement && !w.rejectIntro)
        return new Promise<void>((_resolve, reject) => (w.rejectIntro = reject));
      return original.call(this);
    };
  });
  await page.goto('./');
  await start(page).click();
  const video = page.locator('[data-studio-intro] video');
  await expect(video).toHaveJSProperty('muted', true);
  await setHidden(page, true);
  await page.evaluate(() =>
    (window as unknown as { rejectIntro: (error: DOMException) => void }).rejectIntro(
      new DOMException('Paused', 'AbortError'),
    ),
  );
  await expect(video).toBeVisible();
  await setHidden(page, false);
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Skip video' }).click();
  await expectScreen(page, 'MAIN_MENU');
});

test('a blocked menu recording retries on the next gesture and pauses with the tab', async ({ page }) => {
  await seed(page, { settings: { startupIntro: 'brief', ambience: false } });
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    const w = window as unknown as { recording?: HTMLAudioElement; recordingAttempts: number };
    w.recordingAttempts = 0;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && this.src.includes('inspire-card-parlor-menu-track')) {
        w.recording = this;
        if (++w.recordingAttempts === 1) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      }
      return original.call(this);
    };
  });
  const recording = () =>
    page.evaluate(() => {
      const w = window as unknown as { recording?: HTMLAudioElement; recordingAttempts: number };
      return { attempts: w.recordingAttempts, paused: w.recording?.paused, time: w.recording?.currentTime ?? 0 };
    });
  await page.goto('./');
  await start(page).click();
  await expect(page.locator('[data-studio-intro] video')).toBeVisible();
  expect((await recording()).attempts).toBe(0);
  await page.getByRole('button', { name: 'Skip video' }).click();
  await expectScreen(page, 'MAIN_MENU');
  await expect.poll(async () => (await recording()).attempts).toBe(1);
  await page.getByRole('heading', { level: 1 }).click();
  await expect.poll(async () => (await recording()).time).toBeGreaterThan(0.1);
  await setHidden(page, true);
  await expect.poll(async () => (await recording()).paused).toBe(true);
  const frozen = (await recording()).time;
  await setHidden(page, false);
  await expect.poll(async () => (await recording()).time).toBeGreaterThan(frozen + 0.1);
});
