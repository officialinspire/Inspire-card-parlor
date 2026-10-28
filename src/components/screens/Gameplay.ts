import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { getBoard } from '@/boards/registry';
import { getDeck } from '@/decks/registry';
import { getGame } from '@/games/registry';
import { CHAPTERS } from '@/story/chapters';
import { cardBack, cardFace } from '../Card';
import { backButton, button } from '../ui';
import type { ScreenFactory } from '../Screen';

/**
 * Table shell for every game: board surface, HUD and a placeholder layout.
 * Game modules will mount their rules engine into `.table-surface`.
 */
export const GameplayScreen: ScreenFactory = ({ store }) => {
  const { gameId, deckId, boardId, storyChapterId } = store.state.selection;
  const game = getGame(gameId);
  const deck = getDeck(deckId);
  const board = getBoard(boardId);
  const chapter = CHAPTERS.find((c) => c.id === storyChapterId);

  const stock = h('div', { class: 'table-stock' }, ...Array.from({ length: 4 }, () => cardBack(deck, 'stacked')));
  const fan = h(
    'div',
    { class: 'table-fan' },
    ...(['A', 'K', 'Q', 'J', '10'] as const).map((r, i) =>
      cardFace(deck, r, (['♠', '♥', '♣', '♦', '♠'] as const)[i]!, 'fanned'),
    ),
  );

  const el = h(
    'section',
    { class: 'table', style: { '--felt': board.felt, '--rim': board.rim } },
    h(
      'header',
      { class: 'table-hud' },
      backButton(),
      h(
        'div',
        { class: 'hud-title' },
        h('h1', { class: 'screen-title', tabindex: '-1' }, game?.name ?? 'Table'),
        h('p', { class: 'screen-subtitle' }, chapter ? `Story · ${chapter.title}` : `${deck.name} · ${board.name}`),
      ),
      h('div', { class: 'hud-stats' }, h('span', null, '⏱ 0:00'), h('span', null, '✦ 0')),
    ),
    h(
      'div',
      { class: 'table-surface' },
      stock,
      fan,
      h(
        'div',
        { class: 'table-placard' },
        h('h2', null, 'Table is set'),
        h(
          'p',
          null,
          `${game?.name ?? 'This game'} rules are on their way. The deck, table and HUD are ready for the dealer.`,
        ),
        h(
          'div',
          { class: 'placard-actions' },
          button('Change Table', () => navigate(AppState.BOARD_SELECTION), { variant: 'ghost' }),
          button('Main Menu', () => navigate(AppState.MAIN_MENU)),
        ),
      ),
    ),
  );
  return { el };
};
