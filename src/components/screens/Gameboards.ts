import { h } from '@/utils/dom';
import { BOARDS, type BoardDefinition } from '@/boards/registry';
import { getDeck, type DeckDefinition } from '@/decks/registry';
import { isBoardUnlocked, unlockHint } from '@/progression/levels';
import { cardBack, cardFace } from '../Card';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginator } from '../Paginator';
import { badge, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

/** Miniature table with a few cards from the given deck. */
export function boardPreview(board: BoardDefinition, deck: DeckDefinition, large = false): HTMLElement {
  return h(
    'span',
    {
      class: `board-preview${large ? ' large' : ''}`,
      style: { background: board.felt, borderColor: board.rim },
      'aria-hidden': 'true',
    },
    cardBack(deck, 'mini'),
    cardFace(deck, 'K', '♠', 'mini'),
    cardFace(deck, 'Q', '♥', 'mini'),
  );
}

export const GameboardsScreen: ScreenFactory = ({ store }) => {
  const owned = BOARDS.filter((b) => isBoardUnlocked(b.id, store.state.profile)).length;

  const inspect = async (board: BoardDefinition) => {
    const unlocked = isBoardUnlocked(board.id, store.state.profile);
    const equipped = store.state.selection.boardId === board.id;
    const choice = await openDialog<'use' | 'close'>({
      title: board.name,
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'item-detail' },
        boardPreview(board, getDeck(store.state.selection.deckId), true),
        h('p', null, board.description),
        unlocked ? null : h('p', { class: 'tile-lock' }, icon('lock'), unlockHint(board)),
      ),
      dismissValue: 'close',
      actions:
        unlocked && !equipped
          ? [
              { label: 'Close', value: 'close', variant: 'ghost' },
              { label: 'Use this board', value: 'use', icon: 'check' },
            ]
          : [{ label: equipped ? 'In use' : 'Close', value: 'close', variant: 'ghost' }],
    });
    if (choice === 'use') {
      store.dispatch({ type: 'SELECT_BOARD', boardId: board.id });
      notify(`${board.name} is now your table.`, { kind: 'success' });
      pager.refresh();
    }
  };

  const pager = paginator({
    items: BOARDS,
    minTileWidth: 200,
    minTileHeight: 170,
    maxTileHeight: 260,
    label: 'Gameboards',
    initialIndex: BOARDS.findIndex((b) => b.id === store.state.selection.boardId),
    render: (board) => {
      const unlocked = isBoardUnlocked(board.id, store.state.profile);
      const equipped = store.state.selection.boardId === board.id;
      return h(
        'button',
        {
          type: 'button',
          class: `tile board-tile${equipped ? ' selected' : ''}${unlocked ? '' : ' locked'}`,
          'data-board': board.id,
          onclick: () => void inspect(board),
        },
        equipped ? h('span', { class: 'tile-check' }, icon('check')) : null,
        boardPreview(board, getDeck(store.state.selection.deckId)),
        h('span', { class: 'tile-title' }, board.name),
        unlocked
          ? equipped
            ? badge('In use', 'badge-accent')
            : h('span', { class: 'tile-sub' }, board.description)
          : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(board)),
      );
    },
  });

  return {
    el: screenFrame({ title: 'Gameboards', subtitle: `${owned} of ${BOARDS.length} tables owned`, body: pager.el }),
    unmount: pager.destroy,
  };
};
