import { test, expect } from '@playwright/test';
import { CURRENT, enterParlor, expectScreen, seed, tableAction, action } from './helpers';

test('deck changes apply immediately in both modes and persist across reload and game switches', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  test.skip(!['phone-portrait', 'desktop'].includes(info.project.name));
  await seed(page, {
    selection: { deckId: 'inspire', byGame: { freecell: { deckId: 'classic', boardId: 'backroom_card_table' } } },
    profile: { unlockedDecks: ['classic', 'inspire', 'jak_gold', 'dante_v2'] },
  });
  await enterParlor(page);
  const launch = async (story: boolean) => {
    await page.evaluate((story) => {
      const s = (window as any).__ICP__.store;
      s.dispatch({ type: 'NAVIGATE', to: 'MAIN_MENU' });
      if (story) {
        s.dispatch({ type: 'NAVIGATE', to: 'STORY_MODE' });
        s.dispatch({ type: 'SELECT_STORY_LEVEL', levelId: 'th-1-2', chapterId: 'th-1' });
      } else {
        s.dispatch({ type: 'SELECT_GAME', gameId: 'freecell' });
        for (const to of ['GAME_SELECTION', 'DECK_SELECTION', 'BOARD_SELECTION']) s.dispatch({ type: 'NAVIGATE', to });
      }
      s.dispatch({ type: 'NAVIGATE', to: 'GAMEPLAY' });
    }, story);
    await expectScreen(page, 'GAMEPLAY');
    if (await action(page, 'resume').isVisible()) await action(page, 'resume').click();
  };
  const deckIs = async (id: string) => {
    await expect(page.locator(`${CURRENT} .card-face`).first()).toHaveAttribute('data-theme', `${id}@standard`);
    await expect(page.locator(`${CURRENT} .card-face`).first()).toHaveAttribute('data-art', 'atlas');
    await expect(page.locator(`${CURRENT} .card-face:not([data-theme="${id}@standard"])`)).toHaveCount(0);
  };
  await launch(false);
  await deckIs('inspire'); // Old per-game memory must not restore Classic.
  await tableAction(page, 'game-settings');
  await page.locator('[data-pick-deck="dante_v2"]').click();
  await action(page, 'close').click();
  await deckIs('dante_v2');
  await launch(true);
  await deckIs('dante_v2'); // Chapter deck does not override the selected deck.
  await tableAction(page, 'game-settings');
  await page.locator('[data-pick-deck="jak_gold"]').click();
  await action(page, 'close').click();
  await deckIs('jak_gold');
  await page.waitForTimeout(400);
  await enterParlor(page);
  await launch(false);
  await deckIs('jak_gold');
});

test('all uploaded deck sheets and PNG fallbacks fully decode with exact 52-cell dimensions', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('./');
  const issues = await page.evaluate(async () => {
    const ids = [
      'classic',
      'inspire',
      'jak_gold',
      'dantes_world',
      'fredericksburg',
      'fredericksburg_downtown',
      'eastern_woodlands',
      'spycraft',
      'freemasonry',
      'washington_ghost',
      'dante_v2',
      'cannabis_nugs',
      'yummyhole_standard',
    ];
    const issues: string[] = [];
    for (const id of ids)
      for (const format of [
        'webp',
        ...(['dante_v2', 'cannabis_nugs', 'yummyhole_standard'].includes(id) ? ['png'] : []),
      ]) {
        const src = `assets/cards/${id}/faces.${format}`;
        try {
          const image = new Image();
          image.src = new URL(src, document.baseURI).href;
          await image.decode();
          if (image.naturalWidth % 13 || image.naturalHeight % 4) issues.push(src + ': uneven cells');
        } catch {
          issues.push(src + ': decode failed');
        }
      }
    return issues;
  });
  expect(issues).toEqual([]);
});
