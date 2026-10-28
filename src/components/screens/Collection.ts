import { h } from '@/utils/dom';
import { deckThemes, getDeck } from '@/decks';
import type { DeckDefinition } from '@/decks/types';
import { CHARACTERS } from '@/story/chapters';
import { isDeckUnlocked, unlockHint, isUnlocked } from '@/progression/levels';
import { audio } from '@/audio';
import { cardBack, cardFace, RANK_LABELS, SUITS } from '../Card';
import { openDialog } from '../Dialog';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const artistLine = (deck: DeckDefinition) =>
  deck.artist.name ? `Art by ${deck.artist.name}` : 'Artist credit coming with the artwork';

export const deckBadges = (deck: DeckDefinition) => [
  badge(deck.rarity, `badge-${deck.rarity}`),
  deck.contentRating === 'mature' ? badge('18+', 'badge-mature') : null,
  deck.assets.status === 'pending' ? badge('Art coming soon', 'badge-soft') : null,
];

export const CollectionScreen: ScreenFactory = ({ store }) => {
  const profile = store.state.profile;
  const decks = deckThemes.list();
  const ownedDecks = decks.filter((d) => isDeckUnlocked(d.id, profile)).length;

  /** Alternate-art picker; only shown for decks that have variants. */
  const variantPicker = (deck: DeckDefinition) => {
    const variants = deckThemes.variants(deck.id);
    if (!variants.length) return null;
    const current = store.state.selection.artVariants[deck.id] ?? null;
    const options = [{ id: null as string | null, name: 'Standard', unlocked: true }].concat(
      variants.map((v) => ({ id: v.id as string | null, name: v.name, unlocked: isUnlocked(v, profile, []) })),
    );
    const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Artwork' });
    const render = (selected: string | null) =>
      group.replaceChildren(
        ...options.map((o) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(o.id === selected),
              class: o.id === selected ? 'active' : '',
              disabled: !o.unlocked,
              'data-variant': o.id ?? 'standard',
              onclick: () => {
                audio.play('tap');
                store.dispatch({ type: 'SELECT_ART_VARIANT', deckId: deck.id, variantId: o.id });
                render(o.id);
              },
            },
            o.unlocked ? null : icon('lock'),
            o.name,
          ),
        ),
      );
    render(current);
    return h('div', { class: 'control control-segmented' }, h('span', { class: 'control-label' }, 'Artwork'), group);
  };

  const inspect = async (deck: DeckDefinition) => {
    const unlocked = isDeckUnlocked(deck.id, profile);
    const equipped = store.state.selection.deckId === deck.id;
    const choice = await openDialog<'use' | 'close'>({
      title: deck.name,
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'item-detail', 'data-deck-detail': deck.id },
        h(
          'div',
          { class: 'deck-fan' },
          cardBack(deck, '', 'explicit'),
          cardFace(deck, 'A', '♠', '', 'explicit'),
          cardFace(deck, 'K', '♥', '', 'explicit'),
          cardFace(deck, 'Q', '♦', '', 'explicit'),
        ),
        h('div', { class: 'item-meta' }, ...deckBadges(deck), h('span', { class: 'artist' }, artistLine(deck))),
        h('p', null, deck.description),
        unlocked ? variantPicker(deck) : h('p', { class: 'tile-lock' }, icon('lock'), unlockHint(deck)),
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
    }
    t.select('decks');
  };

  const t = tabs([
    {
      id: 'decks',
      label: `Decks ${ownedDecks}/${decks.length}`,
      render: () =>
        paginatorPanel({
          items: decks,
          minTileWidth: 150,
          minTileHeight: 200,
          maxTileHeight: 280,
          label: 'Decks',
          initialIndex: Math.max(
            0,
            decks.findIndex((d) => d.id === store.state.selection.deckId),
          ),
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
                ? h(
                    'span',
                    { class: 'tile-meta' },
                    equipped ? badge('In use', 'badge-accent') : badge(d.rarity, `badge-${d.rarity}`),
                    d.contentRating === 'mature' ? badge('18+', 'badge-mature') : null,
                  )
                : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(d)),
            );
          },
        }),
    },
    {
      id: 'gallery',
      label: 'Card Gallery',
      render: () => {
        const deck = getDeck(deckThemes.safeDeckId(store.state.selection.deckId));
        const cards = SUITS.flatMap((suit) => RANK_LABELS.map((rank) => ({ rank, suit })));
        return paginatorPanel({
          items: cards,
          minTileWidth: 64,
          minTileHeight: 96,
          maxTileHeight: 130,
          gap: 10,
          label: `${deck.name} cards`,
          render: ({ rank, suit }) => h('div', { class: 'gallery-cell' }, cardFace(deck, rank, suit, '', 'explicit')),
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
