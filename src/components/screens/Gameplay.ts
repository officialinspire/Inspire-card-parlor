import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { goBack, navigate } from '@/core/store';
import { getBoard } from '@/boards/registry';
import { deckThemes, getDeck } from '@/decks';
import { getGame } from '@/games/registry';
import { CHAPTERS } from '@/story/chapters';
import { cardBack, cardFace } from '../Card';
import { confirmDialog } from '../Dialog';
import { button, navHeader } from '../ui';
import type { ScreenFactory } from '../Screen';

/**
 * Table shell for every game: board surface, HUD and a placeholder layout.
 * Game modules will mount their rules engine into `.table-surface`.
 */
export const GameplayScreen: ScreenFactory = ({ store }) => {
  const { gameId, deckId, boardId, storyChapterId } = store.state.selection;
  const game = getGame(gameId);
  const deck = getDeck(deckThemes.safeDeckId(deckId));
  const board = getBoard(boardId);
  const chapter = CHAPTERS.find((c) => c.id === storyChapterId);

  const leave = async (then: () => void) => {
    const ok = await confirmDialog({
      title: 'Leave the table?',
      message: 'This deal will be set aside. You can start a fresh one any time.',
      confirmLabel: 'Leave',
      cancelLabel: 'Keep playing',
    });
    if (ok) then();
  };

  const stock = h(
    'div',
    { class: 'table-stock' },
    ...Array.from({ length: 4 }, () => cardBack(deck, 'stacked', 'explicit')),
  );
  const fan = h(
    'div',
    { class: 'table-fan' },
    ...(['A', 'K', 'Q', 'J', '10'] as const).map((r, i) =>
      cardFace(deck, r, (['♠', '♥', '♣', '♦', '♠'] as const)[i]!, 'fanned', 'explicit'),
    ),
  );

  const el = h(
    'section',
    { class: 'table', style: { '--felt': board.felt, '--rim': board.rim } },
    h(
      'div',
      { class: 'table-hud' },
      navHeader({
        title: game?.name ?? 'Table',
        subtitle: chapter ? `Story · ${chapter.title}` : `${deck.name} · ${board.name}`,
        back: () => void leave(goBack),
        home: () => void leave(() => navigate(AppState.MAIN_MENU)),
        showCredits: false,
        actions: [h('span', { class: 'hud-stats' }, h('span', null, '0:00'), h('span', null, '0 pts'))],
      }),
    ),
    h(
      'div',
      { class: 'table-surface' },
      stock,
      fan,
      h(
        'div',
        { class: 'table-placard' },
        h('h2', null, 'The table is set'),
        h(
          'p',
          null,
          `${game?.name ?? 'This game'} rules are on their way. Your deck and board are ready for the dealer.`,
        ),
        h(
          'div',
          { class: 'placard-actions' },
          button('Change board', () => navigate(AppState.BOARD_SELECTION), {
            variant: 'ghost',
            attrs: { 'data-nav': AppState.BOARD_SELECTION },
          }),
          button('Main menu', () => navigate(AppState.MAIN_MENU), { attrs: { 'data-nav': AppState.MAIN_MENU } }),
        ),
      ),
    ),
  );
  return { el };
};
