import { expect, test, type Page } from '@playwright/test';
import { CURRENT, clickNav, enterParlor, expectNoOverflow, expectScreen, seed } from './helpers';

test.use({ serviceWorkers: 'block' });

type State = {
  screen: string;
  settings: Record<string, unknown>;
  profile: {
    unlockedAchievements: string[];
    achievementDates: Record<string, number>;
    unlockedDecks: string[];
    schemaVersion: number;
    journal: { counters: Record<string, number>; seen: Record<string, string[]> };
  };
};
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ICP__: { store: { state: State } } }).__ICP__.store.state);
const dispatch = (page: Page, action: unknown) =>
  page.evaluate(
    (a) => (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store.dispatch(a),
    action,
  );

test('music player: play/pause, next/previous, shuffle, repeat, playlists, volume and mute', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'SETTINGS');
  await page.locator(`${CURRENT} [data-tab="music"]`).click();
  const player = page.locator(`${CURRENT} [data-music-player]`);
  await expect(player.locator('[data-value="track-title"]')).toHaveText('Lamplight Shuffle');

  const toggle = player.locator('[data-action="music-toggle"]');
  await expect(toggle).toHaveAttribute('data-state', 'playing');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-state', 'paused');
  expect((await state(page)).settings.musicPaused).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-state', 'playing');

  await player.locator('[data-action="music-next"]').click();
  await expect(player.locator('[data-value="track-title"]')).toHaveText('Corner Café');
  await player.locator('[data-action="music-prev"]').click();
  await expect(player.locator('[data-value="track-title"]')).toHaveText('Lamplight Shuffle');

  const shuffle = player.locator('[data-action="music-shuffle"]');
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
  const repeat = player.locator('[data-action="music-repeat"]');
  await expect(repeat).toHaveAttribute('data-repeat', 'all');
  await repeat.click();
  await expect(repeat).toHaveAttribute('data-repeat', 'one');
  await repeat.click();
  await expect(repeat).toHaveAttribute('data-repeat', 'off');

  // A playlist category starts its own music.
  await player.locator('[data-category="woodland-ambience"]').click();
  await expect(player.locator('[data-category="woodland-ambience"]')).toHaveAttribute('aria-checked', 'true');
  await expect(player.locator('[data-value="track-title"]')).toHaveText(/Woodland Hush|Turtle Creek/);
  await expect(player.locator('.mp-tracks [data-track]')).toHaveCount(2);
  await player.locator('[data-track="turtle-creek"]').click();
  await expect(player.locator('[data-value="track-title"]')).toHaveText('Turtle Creek');

  const mute = player.locator('[data-action="music-mute"]');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  const volume = player.locator('input[type="range"]');
  await volume.fill('30');
  expect((await state(page)).settings).toMatchObject({ musicMuted: true, musicVolume: 0.3, musicRepeat: 'off' });
  await expectNoOverflow(page);
});

test('music keeps playing from the menus into a game, and a pause is remembered', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await page.locator(`${CURRENT} [data-action="next-track"]`).click();
  await expect(page.locator(`${CURRENT} [data-value="music"]`)).toHaveText('Corner Café');
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  expect((await state(page)).settings).toMatchObject({ musicTrack: 'corner-cafe', musicPaused: false });
  // The table's More panel opens the same player.
  await page.locator(`${CURRENT} [data-action="more"]`).click();
  await page.locator(`${CURRENT} [data-action="music-player"]`).click();
  const dialog = page.locator('.dialog-music');
  await expect(dialog.locator('[data-value="track-title"]')).toHaveText('Corner Café');
  await dialog.locator('[data-action="music-toggle"]').click();
  await page.locator('[data-dialog-action]').last().click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  expect((await state(page)).settings.musicPaused).toBe(true);
  await expect(page.locator(`${CURRENT} [data-action="music-toggle"]`)).toHaveAttribute('aria-label', 'Play music');
});

test('haptic feedback can be switched off', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'SETTINGS');
  const haptics = page.locator(`${CURRENT} [data-setting="haptics"] input`);
  await expect(haptics).toBeChecked();
  await page.locator(`${CURRENT} [data-setting="haptics"]`).click();
  expect((await state(page)).settings.haptics).toBe(false);
});

test('achievements: 150 with medals, rarity, progress and dates; secrets stay hidden', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'ACHIEVEMENTS');
  await expect(page.locator(`${CURRENT} [data-value="earned"]`)).toHaveText('1 / 150 earned'); // Doors Open
  const first = page.locator(`${CURRENT} .achievement-tile`).first();
  await expect(first).toHaveAttribute('data-achievement', 'first-visit');
  await expect(first).toHaveClass(/earned/);
  await expect(first.locator('svg.medal')).toBeVisible();
  await expect(first.locator('[data-earned]')).toContainText('Common');
  for (const tab of [
    'general',
    'klondike',
    'spider',
    'freecell',
    'war',
    'go-fish',
    'story',
    'collection',
    'exploration',
  ])
    await expect(page.locator(`${CURRENT} [data-tab="${tab}"]`)).toBeAttached();
  await page.locator(`${CURRENT} [data-tab="secrets"]`).click();
  const secret = page.locator(`${CURRENT} .achievement-tile`).first();
  await expect(secret).toHaveClass(/secret/);
  await expect(secret).toContainText('Secret');
  await page.locator(`${CURRENT} [data-tab="klondike"]`).click();
  await page.locator(`${CURRENT} [data-achievement="klondike-10"]`).click();
  await expect(page.locator('[data-achievement-detail="klondike-10"]')).toContainText('0 / 10');
  await expect(page.locator('[data-achievement-detail="klondike-10"] svg.medal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoOverflow(page);
});

test('an achievement earned at the table waits for the hand to end, then toasts', async ({ page }) => {
  await seed(page, { settings: { warSpeed: 'instant' } });
  await enterParlor(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __ICP__: { store: { dispatch(a: unknown): void } } }).__ICP__.store;
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION', 'GAMEPLAY'])
      s.dispatch({ type: 'NAVIGATE', to });
  });
  await expectScreen(page, 'GAMEPLAY');
  await page.locator('[data-dialog-action="deal"]').click();
  // Earn a secret mid-game: it unlocks now, but no toast interrupts play.
  for (let i = 0; i < 7; i++) await dispatch(page, { type: 'JOURNAL', update: { add: { 'logo.taps': 1 } } });
  await expect.poll(async () => (await state(page)).profile.unlockedAchievements).toContain('knock-knock');
  await page.waitForTimeout(800);
  await expect(page.locator('.toast-achievement')).toHaveCount(0);
  // Finish the game: the held toast appears when it ends.
  const toast = page.waitForSelector('.toast-achievement[data-achievement="knock-knock"] svg.medal', {
    timeout: 90_000,
  });
  await page.locator(`${CURRENT} [data-action="auto"]`).click();
  await toast;
  await expect(page.locator('.dialog-result')).toBeVisible({ timeout: 10_000 });
  const p = (await state(page)).profile;
  expect(p.achievementDates['knock-knock']).toBeGreaterThan(0);
  expect(p.unlockedAchievements.filter((id) => id === 'knock-knock')).toHaveLength(1);
});

test('the passport shows level, experience, credits, records, stamps and achievements', async ({ page }) => {
  await seed(page, {
    profile: {
      level: 6,
      credits: 999,
      stats: { klondike: { played: 9, won: 4, bestTimeMs: null, bestScore: null, currentStreak: 0, longestStreak: 2 } },
      story: { completed: [], rewarded: [], stamps: ['hometown'], introsSeen: [], attempts: {} },
      journal: { counters: { 'deck.inspire': 5 }, seen: {} },
      schemaVersion: 2,
    },
  });
  await enterParlor(page);
  await page.locator(`${CURRENT} [data-status="level"]`).click();
  await expectScreen(page, 'PASSPORT');
  const book = page.locator(`${CURRENT} .passport-book`);
  await expect(book.locator('.passport-seal')).toContainText('6');
  await expect(book.locator('[data-stat="credits"]')).toContainText('999');
  await expect(book.locator('[data-stat="played"]')).toContainText('9');
  await expect(book.locator('[data-stat="won"]')).toContainText('4');
  await expect(book.locator('[data-stat="favorite-game"]')).toContainText('Klondike');
  await expect(book.locator('[data-stat="favorite-deck"]')).toContainText('INSPIRE');
  await expect(book.locator('[data-value="xp"]')).toContainText('XP');
  const turn = page.locator(`${CURRENT} [data-turn="2"]`);
  if (await turn.isVisible()) await turn.click();
  await expect(book.locator('[data-stamp="hometown"]')).toHaveClass(/earned/);
  await expect(book.locator('[data-value="achievements"]')).toContainText('/ 150');
  await expectNoOverflow(page);
  expect((await state(page)).profile.journal.seen.screens).toContain('PASSPORT');
});

test('collection: real preview art, extras, and a card binder that turns pages and flips cards', async ({ page }) => {
  await enterParlor(page);
  await clickNav(page, 'COLLECTION');
  await expect(page.locator(`${CURRENT} [data-deck="classic"] [data-artist]`)).toContainText('Art by');
  await page.locator(`${CURRENT} [data-tab="gallery"]`).click();
  await expect(page.locator(`${CURRENT} [data-binder="classic"] [data-unlock="owned"]`)).toBeVisible();
  const pocket = page.locator(`${CURRENT} .binder-pocket`).first();
  await pocket.click();
  await expect(pocket).toHaveAttribute('data-flipped', 'true');
  await pocket.click();
  await expect(pocket).toHaveAttribute('data-flipped', 'false');
  await expect.poll(async () => (await state(page)).profile.journal.counters['binder.flips']).toBe(2);
  const next = page.locator(`${CURRENT} [data-pager="next"]`);
  if (await next.isVisible()) {
    await next.click();
    await expect(page.locator(`${CURRENT} .binder .pager-grid`)).toHaveClass(/page-in-right/);
  }
  await page.locator(`${CURRENT} select[data-gallery-deck]`).selectOption('freemasonry');
  await expect(page.locator(`${CURRENT} [data-binder="freemasonry"] [data-unlock="locked"]`)).toBeVisible();
  await expectNoOverflow(page);
});

test('an older save is upgraded safely: backed up, de-duplicated, and past progress earns its achievements', async ({
  page,
}) => {
  await seed(page, {
    profile: {
      credits: 120,
      unlockedDecks: ['classic', 'inspire', 'classic'],
      unlockedAchievements: ['first-win', 'first-win'],
      stats: { war: { played: 12, won: 10, bestTimeMs: null, bestScore: null, currentStreak: 0, longestStreak: 5 } },
    },
  });
  await enterParlor(page);
  const p = (await state(page)).profile;
  expect(p.schemaVersion).toBe(2);
  expect(p.unlockedDecks.filter((d) => d === 'classic')).toHaveLength(1);
  expect(p.unlockedAchievements.filter((a) => a === 'first-win')).toHaveLength(1);
  expect(p.unlockedAchievements).toEqual(expect.arrayContaining(['first-win', 'war-10', 'win-streak-5', 'wins-10']));
  // Earned before dates were kept: no date. Newly recognized ones: dated now.
  expect(p.achievementDates['first-win']).toBeUndefined();
  expect(p.achievementDates['war-10']).toBeGreaterThan(0);
  const backup = await page.evaluate(() => localStorage.getItem('icp:profile-backup-v1'));
  expect(backup).toContain('"credits":120');
  // One summary toast on the menu, not dozens.
  await expect(page.locator('.toast', { hasText: 'achievements earned' })).toBeVisible();
  // It all survives a reload, and nothing is granted twice.
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Enter Parlor' }).click();
  await expectScreen(page, 'MAIN_MENU');
  const again = (await state(page)).profile;
  expect(again.unlockedAchievements.length).toBe(new Set(again.unlockedAchievements).size);
  expect(again.achievementDates['war-10']).toBe(p.achievementDates['war-10']);
});
