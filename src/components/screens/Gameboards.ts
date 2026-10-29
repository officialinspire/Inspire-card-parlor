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
import { badge, button, screenFrame } from '../ui';
import { toggle } from '../controls';
import { live } from '../live';
import { artistCredit } from './Collection';
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
  // Painted boards first, then the ones still waiting for their artwork.
  const boards = [...allBoards()].sort(
    (a, b) => Number(b.assets.status === 'ready') - Number(a.assets.status === 'ready'),
  );
  const owned = boards.filter((b) => isBoardUnlocked(b.id, store.state.profile)).length;
  const deck = () => getDeck(deckThemes.safeDeckId(store.state.selection.deckId));

  /** The board choice is part of the saved selection, so it is remembered between visits. */
  const select = (board: BoardDefinition) => {
    store.dispatch({ type: 'SELECT_BOARD', boardId: board.id });
    notify(`${board.name} is now your table.`, { kind: 'success' });
    pager.refresh();
  };

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
          board.assets.status === 'pending' ? badge('Art coming soon', 'badge-soft') : badge('Painted', 'badge-done'),
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
    if (choice === 'use') select(board);
  };

  const pager = paginator({
    items: boards,
    minTileWidth: 200,
    minTileHeight: 200,
    maxTileHeight: 280,
    label: 'Gameboards',
    initialIndex: Math.max(
      0,
      boards.findIndex((b) => b.id === store.state.selection.boardId),
    ),
    render: (board) => {
      const unlocked = isBoardUnlocked(board.id, store.state.profile);
      const equipped = store.state.selection.boardId === board.id;
      const action = !unlocked
        ? h('span', { class: 'tile-lock', 'data-unlock': 'locked' }, icon('lock'), unlockHint(board))
        : equipped
          ? h('span', { class: 'board-selected', 'data-unlock': 'selected' }, icon('check'), 'Selected')
          : button('Select', () => select(board), {
              size: 'sm',
              variant: 'secondary',
              class: 'board-select',
              attrs: { 'data-select-board': board.id, 'aria-label': `Select ${board.name}` },
            });
      return h(
        'div',
        {
          class: `tile board-tile${equipped ? ' selected' : ''}${unlocked ? '' : ' locked'}`,
          'data-board': board.id,
        },
        h(
          'button',
          {
            type: 'button',
            class: 'tile-main board-open',
            'aria-label': `${board.name} — details`,
            onclick: () => void inspect(board),
          },
          boardPreview(board, deck()),
          h('span', { class: 'tile-title' }, board.name),
          h(
            'span',
            { class: 'board-tile-meta' },
            h('span', { class: 'board-ambience' }, AMBIENT_LABEL[board.ambient] ?? board.ambient),
            board.assets.status === 'pending' ? h('span', { class: 'board-pending' }, 'Art coming soon') : null,
          ),
        ),
        h('div', { class: 'board-tile-foot' }, action),
      );
    },
  });

  const ambience = live(
    h('div', { class: 'board-ambience-toggle' }),
    (s) => s.settings.ambientAnimations,
    (el, on) => {
      const t = toggle(
        'Ambience',
        on,
        (v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { ambientAnimations: v } }),
        'Gentle motion on the table: breeze, river shimmer, lamplit dust',
      );
      t.dataset.setting = 'ambientAnimations';
      el.replaceChildren(t);
    },
  );

  return {
    el: screenFrame({
      title: 'Gameboards',
      subtitle: `${owned} of ${boards.length} tables owned`,
      body: h('div', { class: 'stack' }, ambience, pager.el),
    }),
    unmount: pager.destroy,
  };
};
