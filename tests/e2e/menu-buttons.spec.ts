import { expect, test } from '@playwright/test';
import { enterParlor, seed } from './helpers';

// Desktop window heights straddle both responsive breakpoints, including the report.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'explicit viewport matrix'));
for (const [width, height] of [
  [1086, 552],
  [1086, 600],
  [1440, 900],
  [1440, 540],
  [390, 844],
  [844, 390],
]) {
  test(`menu buttons stay in their grid while entering and hovering at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, { settings: { startupIntro: 'brief', musicPaused: true } });
    await enterParlor(page);
    // Replay only the tile animations, including their stagger: sample every frame
    // so the old card-dealing collision fails even when the menu eventually settles.
    const issues = await page.locator('.menu-grid').evaluate(async (grid) => {
      const buttons = [...grid.querySelectorAll<HTMLButtonElement>(':scope > button')];
      for (const b of buttons) for (const a of b.getAnimations()) a.cancel();
      for (const b of buttons) b.style.animation = 'none';
      void grid.getBoundingClientRect();
      for (const b of buttons) b.style.animation = '';
      const failures: string[] = [];
      const until = performance.now() + 1500;
      do {
        const rects = buttons.map((b) => b.getBoundingClientRect());
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]!;
          const b = buttons[i]!;
          // A six-pixel local entrance is safe; flying across another row is not.
          if (
            Math.abs(r.x - (grid.getBoundingClientRect().x + b.offsetLeft - (grid as HTMLElement).offsetLeft)) > 12 ||
            Math.abs(r.y - (grid.getBoundingClientRect().y + b.offsetTop - (grid as HTMLElement).offsetTop)) > 12
          )
            failures.push(`${b.textContent?.trim()}: left its grid position`);
          for (let j = i + 1; j < rects.length; j++) {
            const q = rects[j]!;
            if (
              Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 &&
              Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1
            )
              failures.push('Menu buttons overlap');
          }
        }
        await new Promise(requestAnimationFrame);
      } while (performance.now() < until);
      return [...new Set(failures)];
    });
    expect(issues).toEqual([]);
    const music = page.locator('.menu-grid [data-action="music-player"]');
    await music.hover();
    await expect(music).toHaveCSS('opacity', '1');
    await music.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    // Hover/focus on each destination must remain reachable after the animation.
    for (const button of await page.locator('.menu-grid > button').all()) {
      await button.hover();
      await expect(button).toHaveCSS('opacity', '1');
    }
  });
}
