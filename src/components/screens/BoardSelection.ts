import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { BOARDS } from '@/boards/registry';
import { getDeck } from '@/decks/registry';
import { getGame } from '@/games/registry';
import { isBoardUnlocked, unlockHint } from '@/progression/levels';
import { audio } from '@/audio';
import { track } from '@/analytics/analytics';
import { cardBack } from '../Card';
import { paginator } from '../Paginator';
import { button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const BoardSelectionScreen: ScreenFactory = ({ store }) => {
  const game = getGame(store.state.selection.gameId);
  const deck = getDeck(store.state.selection.deckId);
  const pager = paginator({
    items: BOARDS,
    minTileWidth: 200,
    minTileHeight: 170,
    label: 'Boards',
    initialIndex: BOARDS.findIndex((b) => b.id === store.state.selection.boardId),
    render: (board) => {
      const unlocked = isBoardUnlocked(board.id, store.state.profile);
      const selected = store.state.selection.boardId === board.id;
      return h(
        'button',
        {
          type: 'button',
          class: `tile board-tile${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`,
          'aria-pressed': String(selected),
          'aria-disabled': String(!unlocked),
          onclick: () => {
            if (!unlocked) return audio.play('error');
            audio.play('tap');
            store.dispatch({ type: 'SELECT_BOARD', boardId: board.id });
            pager.refresh();
          },
        },
        h(
          'span',
          { class: 'board-preview', style: { background: board.felt, borderColor: board.rim } },
          cardBack(deck, 'mini'),
          cardBack(deck, 'mini'),
          cardBack(deck, 'mini'),
        ),
        h('span', { class: 'tile-title' }, board.name),
        h('span', { class: 'tile-sub' }, unlocked ? board.description : `🔒 ${unlockHint(board)}`),
      );
    },
  });

  return {
    el: screenFrame({
      title: 'Choose a Table',
      subtitle: game ? `${game.name} · Step 3 of 3` : 'Step 3 of 3',
      body: pager.el,
      footer: button(
        'Deal Cards',
        () => {
          track('game_start', { ...store.state.selection });
          navigate(AppState.GAMEPLAY);
        },
        { sfx: 'shuffle' },
      ),
    }),
    unmount: pager.destroy,
  };
};
