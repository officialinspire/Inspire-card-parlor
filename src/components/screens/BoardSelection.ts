import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { BOARDS } from '@/boards/registry';
import { deckThemes, getDeck } from '@/decks';
import { getGame } from '@/games/registry';
import { isBoardUnlocked, unlockHint } from '@/progression/levels';
import { audio } from '@/audio';
import { track } from '@/analytics/analytics';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginator } from '../Paginator';
import { button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';
import { SETUP_STEPS } from './GameSelection';
import { boardPreview } from './Gameboards';

export const BoardSelectionScreen: ScreenFactory = ({ store }) => {
  const game = getGame(store.state.selection.gameId);
  const deck = getDeck(deckThemes.safeDeckId(store.state.selection.deckId));
  const pager = paginator({
    items: BOARDS,
    minTileWidth: 200,
    minTileHeight: 170,
    maxTileHeight: 260,
    label: 'Gameboards',
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
          'data-board': board.id,
          onclick: () => {
            if (!unlocked)
              return void notify(`${board.name}: ${unlockHint(board)} to unlock.`, { kind: 'warning', icon: 'lock' });
            audio.play('tap');
            store.dispatch({ type: 'SELECT_BOARD', boardId: board.id });
            pager.refresh();
          },
        },
        selected ? h('span', { class: 'tile-check' }, icon('check')) : null,
        boardPreview(board, deck),
        h('span', { class: 'tile-title' }, board.name),
        h(
          'span',
          { class: 'tile-sub' },
          unlocked ? board.description : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(board)),
        ),
      );
    },
  });

  return {
    el: screenFrame({
      title: game ? game.name : 'Choose a Board',
      steps: { current: 3, total: 3, labels: SETUP_STEPS },
      body: pager.el,
      footer: button(
        'Deal Cards',
        () => {
          store.dispatch({ type: 'START_GAME' });
          track('game_start', {
            gameId: store.state.selection.gameId,
            deckId: deck.id,
            boardId: store.state.selection.boardId,
          });
          navigate(AppState.GAMEPLAY);
        },
        { sfx: 'shuffle', icon: 'play', attrs: { 'data-nav': AppState.GAMEPLAY } },
      ),
    }),
    unmount: pager.destroy,
  };
};
