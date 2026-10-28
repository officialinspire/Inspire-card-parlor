import { h } from '@/utils/dom';
import { BOARDS } from '@/boards/registry';
import { CHARACTERS } from '@/story/chapters';
import { DECKS, getDeck } from '@/decks/registry';
import { isBoardUnlocked, isDeckUnlocked, unlockHint } from '@/progression/levels';
import { cardBack } from '../Card';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const CollectionScreen: ScreenFactory = ({ store }) => {
  const profile = store.state.profile;
  const ownedDecks = DECKS.filter((d) => isDeckUnlocked(d.id, profile)).length;
  const ownedBoards = BOARDS.filter((b) => isBoardUnlocked(b.id, profile)).length;
  const currentDeck = getDeck(store.state.selection.deckId);

  const t = tabs([
    {
      id: 'decks',
      label: `Decks ${ownedDecks}/${DECKS.length}`,
      icon: '🃏',
      render: () =>
        paginatorPanel({
          items: DECKS,
          minTileWidth: 150,
          minTileHeight: 200,
          label: 'Decks',
          render: (d) => {
            const owned = isDeckUnlocked(d.id, profile);
            return h(
              'div',
              { class: `tile deck-tile rarity-${d.rarity}${owned ? '' : ' locked'}` },
              h('span', { class: 'deck-preview' }, cardBack(d, 'preview-back solo')),
              h('span', { class: 'tile-title' }, d.name),
              owned ? badge(d.rarity, `badge-${d.rarity}`) : h('span', { class: 'tile-lock' }, `🔒 ${unlockHint(d)}`),
            );
          },
        }),
    },
    {
      id: 'boards',
      label: `Tables ${ownedBoards}/${BOARDS.length}`,
      icon: '▦',
      render: () =>
        paginatorPanel({
          items: BOARDS,
          minTileWidth: 200,
          minTileHeight: 160,
          label: 'Tables',
          render: (b) => {
            const owned = isBoardUnlocked(b.id, profile);
            return h(
              'div',
              { class: `tile board-tile${owned ? '' : ' locked'}` },
              h(
                'span',
                { class: 'board-preview', style: { background: b.felt, borderColor: b.rim } },
                cardBack(currentDeck, 'mini'),
              ),
              h('span', { class: 'tile-title' }, b.name),
              h('span', { class: 'tile-sub' }, owned ? b.description : `🔒 ${unlockHint(b)}`),
            );
          },
        }),
    },
    {
      id: 'characters',
      label: 'Characters',
      icon: '☺',
      render: () =>
        paginatorPanel({
          items: CHARACTERS,
          minTileWidth: 240,
          minTileHeight: 100,
          label: 'Characters',
          render: (c) =>
            h(
              'div',
              { class: 'tile chapter-tile' },
              h(
                'span',
                { class: 'chapter-portrait', style: { background: c.color }, 'aria-hidden': 'true' },
                c.name[0]!,
              ),
              h(
                'span',
                { class: 'tile-body' },
                h('span', { class: 'tile-title' }, c.name),
                h('span', { class: 'tile-sub' }, c.role),
              ),
            ),
        }),
    },
  ]);

  return {
    el: screenFrame({ title: 'Collection', subtitle: 'Decks, tables & friends', body: t.el }),
    unmount: t.destroy,
  };
};
