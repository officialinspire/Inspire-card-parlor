import { h } from '@/utils/dom';
import { DECKS, getDeck, type DeckDefinition } from '@/decks/registry';
import { CHARACTERS } from '@/story/chapters';
import { isDeckUnlocked, unlockHint } from '@/progression/levels';
import { cardBack, cardFace, RANKS, SUITS } from '../Card';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const CollectionScreen: ScreenFactory = ({ store }) => {
  const profile = store.state.profile;
  const ownedDecks = DECKS.filter((d) => isDeckUnlocked(d.id, profile)).length;

  const inspect = async (deck: DeckDefinition) => {
    const unlocked = isDeckUnlocked(deck.id, profile);
    const equipped = store.state.selection.deckId === deck.id;
    const choice = await openDialog<'use' | 'close'>({
      title: deck.name,
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'item-detail' },
        h(
          'div',
          { class: 'deck-fan' },
          cardBack(deck),
          cardFace(deck, 'A', '♠'),
          cardFace(deck, 'K', '♥'),
          cardFace(deck, 'Q', '♦'),
        ),
        h(
          'div',
          { class: 'item-meta' },
          badge(deck.rarity, `badge-${deck.rarity}`),
          h('span', null, `Art by ${deck.artist}`),
        ),
        h('p', null, deck.description),
        unlocked ? null : h('p', { class: 'tile-lock' }, icon('lock'), unlockHint(deck)),
      ),
      dismissValue: 'close',
      actions:
        unlocked && !equipped
          ? [
              { label: 'Close', value: 'close', variant: 'ghost' },
              { label: 'Use this deck', value: 'use', icon: 'check' },
            ]
          : [{ label: equipped ? 'In use' : 'Close', value: 'close', variant: 'ghost' }],
    });
    if (choice === 'use') {
      store.dispatch({ type: 'SELECT_DECK', deckId: deck.id });
      notify(`Now playing with ${deck.name}.`, { kind: 'success' });
      t.select('decks');
    }
  };

  const t = tabs([
    {
      id: 'decks',
      label: `Decks ${ownedDecks}/${DECKS.length}`,
      render: () =>
        paginatorPanel({
          items: DECKS,
          minTileWidth: 150,
          minTileHeight: 200,
          maxTileHeight: 280,
          label: 'Decks',
          initialIndex: DECKS.findIndex((d) => d.id === store.state.selection.deckId),
          render: (d) => {
            const owned = isDeckUnlocked(d.id, profile);
            const equipped = store.state.selection.deckId === d.id;
            return h(
              'button',
              {
                type: 'button',
                class: `tile deck-tile rarity-${d.rarity}${owned ? '' : ' locked'}${equipped ? ' selected' : ''}`,
                'data-deck': d.id,
                onclick: () => void inspect(d),
              },
              equipped ? h('span', { class: 'tile-check' }, icon('check')) : null,
              h('span', { class: 'deck-preview' }, cardBack(d, 'preview-back solo')),
              h('span', { class: 'tile-title' }, d.name),
              owned
                ? badge(equipped ? 'In use' : d.rarity, equipped ? 'badge-accent' : `badge-${d.rarity}`)
                : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(d)),
            );
          },
        }),
    },
    {
      id: 'gallery',
      label: 'Card Gallery',
      render: () => {
        const deck = getDeck(store.state.selection.deckId);
        const cards = SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
        return paginatorPanel({
          items: cards,
          minTileWidth: 64,
          minTileHeight: 96,
          maxTileHeight: 130,
          gap: 10,
          label: `${deck.name} cards`,
          render: ({ rank, suit }) => h('div', { class: 'gallery-cell' }, cardFace(deck, rank, suit)),
        });
      },
    },
    {
      id: 'characters',
      label: 'Characters',
      render: () =>
        paginatorPanel({
          items: CHARACTERS,
          minTileWidth: 240,
          minTileHeight: 96,
          maxTileHeight: 130,
          label: 'Characters',
          render: (c) =>
            h(
              'div',
              { class: 'tile chapter-tile', 'data-character': c.id },
              h('span', { class: 'portrait', style: { background: c.color }, 'aria-hidden': 'true' }, c.name[0]!),
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
    el: screenFrame({ title: 'Card Collection', body: t.el }),
    unmount: t.destroy,
  };
};
