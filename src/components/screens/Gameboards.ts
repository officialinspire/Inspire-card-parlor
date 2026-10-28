import { h } from '@/utils/dom';
import { allBoards, type BoardDefinition } from '@/boards/registry';
import { boardSwatch } from '@/boards/BoardRenderer';
import { deckThemes, getDeck } from '@/decks';
import type { DeckDefinition } from '@/decks/types';
import { isBoardUnlocked, unlockHint } from '@/progression/levels';
import { cardBack, cardFace } from '../Card';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginator } from '../Paginator';
import { badge, screenFrame } from '../ui';
import { artistCredit, artistLine } from './Collection';
import type { ScreenFactory } from '../Screen';

const AMBIENT_LABEL: Record<string, string> = {
  none: 'Still',
  breeze: 'Breeze',
  dust: 'Lamplit dust',
  steam: 'Coffee steam',
  river: 'River shimmer',
  leaves: 'Falling leaves',
  sparkle: 'Casino sparkle',
  paint: 'Drifting paint',
  rain: 'Rain on the glass',
  candle: 'Candlelight',
};

/** Board with a few sample cards on it (checks cards read well against the surface). */
export function boardPreview(board: BoardDefinition, deck: DeckDefinition, large = false): HTMLElement {
  const sw = boardSwatch(board, { ambient: large, className: large ? 'large' : '' });
  sw.append(cardBack(deck, 'mini'), cardFace(deck, 'K', '♠', 'mini'), cardFace(deck, 'Q', '♥', 'mini'));
  sw.style.setProperty('--board-ink', board.ink);
  return sw;
}

export const GameboardsScreen: ScreenFactory = ({ store }) => {
  const boards = allBoards();
  const owned = boards.filter((b) => isBoardUnlocked(b.id, store.state.profile)).length;
  const deck = () => getDeck(deckThemes.safeDeckId(store.state.selection.deckId));

  const inspect = async (board: BoardDefinition) => {
    const unlocked = isBoardUnlocked(board.id, store.state.profile);
    const equipped = store.state.selection.boardId === board.id;
    const choice = await openDialog<'use' | 'close'>({
      title: board.name,
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'item-detail', 'data-board-detail': board.id },
        boardPreview(board, deck(), true),
        h(
          'div',
          { class: 'item-meta' },
          badge(board.rarity, `badge-${board.rarity}`),
          board.assets.status === 'pending' ? badge('Art coming soon', 'badge-soft') : null,
          badge(AMBIENT_LABEL[board.ambient] ?? board.ambient, 'badge-soft'),
        ),
        artistCredit(board.artist),
        h('p', null, board.description),
        unlocked
          ? h('p', { class: 'unlock-status owned', 'data-unlock': 'owned' }, icon('check'), 'In your collection')
          : h('p', { class: 'unlock-status', 'data-unlock': 'locked' }, icon('lock'), `Unlock: ${unlockHint(board)}`),
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
    items: boards,
    minTileWidth: 200,
    minTileHeight: 180,
    maxTileHeight: 260,
    label: 'Gameboards',
    initialIndex: Math.max(
      0,
      boards.findIndex((b) => b.id === store.state.selection.boardId),
    ),
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
        boardPreview(board, deck()),
        h('span', { class: 'tile-title' }, board.name),
        h('span', { class: 'tile-artist' }, artistLine(board.artist)),
        unlocked
          ? equipped
            ? badge('In use', 'badge-accent')
            : badge(board.rarity, `badge-${board.rarity}`)
          : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(board)),
      );
    },
  });

  return {
    el: screenFrame({ title: 'Gameboards', subtitle: `${owned} of ${boards.length} tables owned`, body: pager.el }),
    unmount: pager.destroy,
  };
};
