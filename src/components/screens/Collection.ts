import { h } from '@/utils/dom';
import { assetManager, cardRenderer, deckThemes, getDeck } from '@/decks';
import type { ArtVariant, DeckDefinition } from '@/decks/types';
import { allBoards } from '@/boards/registry';
import { CHARACTERS } from '@/story/chapters';
import { isDeckUnlocked, isVariantOwned, unlockHint } from '@/progression/levels';
import { collectionProgress } from '@/progression/collection';
import { audio } from '@/audio';
import { cardBack, cardFace, RANK_LABELS, SUITS } from '../Card';
import { confirmDialog, openDialog } from '../Dialog';
import { icon } from '../icons';
import { celebrate, notify } from '../Notifications';
import { paginatorPanel } from '../Paginator';
import { segmented } from '../controls';
import { tabs } from '../Tabs';
import { badge, button, progressBar, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';
import type { Store } from '@/core/store';

export const artistLine = (artist: { name: string | null }) =>
  artist.name ? `Art by ${artist.name}` : 'Artist credit coming with the artwork';

/** Artist credit with an optional link (opens in a new tab). */
export function artistCredit(artist: { name: string | null; url?: string; note?: string }): HTMLElement {
  return h(
    'p',
    { class: 'artist-credit', 'data-artist': artist.name ?? 'pending' },
    icon('star'),
    artist.name && artist.url
      ? h('a', { href: artist.url, target: '_blank', rel: 'noopener noreferrer' }, `Art by ${artist.name}`)
      : h('span', null, artistLine(artist)),
  );
}

export const deckBadges = (deck: DeckDefinition) => [
  badge(deck.rarity, `badge-${deck.rarity}`),
  deck.contentRating === 'mature' ? badge('18+', 'badge-mature') : null,
  deck.assets.status === 'pending' ? badge('Art coming soon', 'badge-soft') : null,
];

type DeckFilter = 'all' | 'owned' | 'favorites';

function favoriteButton(store: Store, deckId: string): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: 'fav-btn', 'data-favorite': deckId });
  const draw = () => {
    const on = store.state.profile.favoriteDecks.includes(deckId);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
    btn.title = btn.getAttribute('aria-label')!;
    btn.textContent = on ? '★' : '☆';
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.play('tap');
    store.dispatch({ type: 'TOGGLE_FAVORITE_DECK', deckId });
    draw();
  });
  draw();
  return btn;
}

export const CollectionScreen: ScreenFactory = ({ store }) => {
  const profile = () => store.state.profile;
  const decks = deckThemes.list();
  let filter: DeckFilter = 'all';
  let galleryDeck = deckThemes.safeDeckId(store.state.selection.deckId);

  const progress = collectionProgress(profile(), decks, allBoards());
  const summary = h(
    'div',
    { class: 'summary-row', 'data-completion': String(progress.percent) },
    h('span', null, `Collection ${progress.percent}% complete`),
    progressBar(progress.percent / 100, 'Collection completion'),
    h(
      'small',
      { class: 'summary-detail' },
      [
        `${progress.decks.owned}/${progress.decks.total} decks`,
        progress.artwork.total ? `${progress.artwork.owned}/${progress.artwork.total} artwork` : '',
        `${progress.boards.owned}/${progress.boards.total} boards`,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  );

  // ----- Deck detail -----
  function variantRow(deck: DeckDefinition, v: ArtVariant, refresh: () => void): HTMLElement {
    const owned = isVariantOwned(deck.id, v, profile());
    const selected = store.state.selection.artVariants[deck.id] === v.id;
    const action = owned
      ? button(
          selected ? 'In use' : 'Use',
          () => {
            store.dispatch({ type: 'SELECT_ART_VARIANT', deckId: deck.id, variantId: selected ? null : v.id });
            refresh();
          },
          { size: 'sm', variant: selected ? 'primary' : 'secondary', attrs: { 'data-variant-use': v.id } },
        )
      : v.unlock.type === 'credits'
        ? button(`${v.unlock.value} credits`, () => void buy(deck, v, refresh), {
            size: 'sm',
            variant: 'secondary',
            icon: 'credits',
            disabled: profile().credits < v.unlock.value,
            attrs: { 'data-variant-buy': v.id },
          })
        : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(v));
    return h(
      'div',
      { class: 'variant-row', 'data-variant': v.id },
      h('span', { class: 'variant-text' }, h('strong', null, v.name), h('small', null, artistLine(v.artist))),
      badge(v.rarity, `badge-${v.rarity}`),
      action,
    );
  }

  async function buy(deck: DeckDefinition, v: ArtVariant, refresh: () => void): Promise<void> {
    if (v.unlock.type !== 'credits') return;
    const cost = v.unlock.value;
    const ok = await confirmDialog({
      title: `Collect ${v.name}?`,
      message: `Spend ${cost} credits on this artwork for ${deck.name}? You have ${profile().credits}.`,
      confirmLabel: `Spend ${cost}`,
    });
    if (!ok) return;
    store.dispatch({ type: 'OWN_VARIANT', key: `${deck.id}@${v.id}`, cost });
    celebrate('Artwork unlocked', `${v.name} added to your collection.`, 'star');
    refresh();
  }

  async function inspect(deck: DeckDefinition): Promise<void> {
    const unlocked = isDeckUnlocked(deck.id, profile());
    const theme = deckThemes.resolve(deck.id);
    const preview = h(
      'div',
      { class: 'deck-fan', 'data-preview': 'fan' },
      cardBack(deck, '', 'explicit'),
      cardFace(deck, 'A', '♠', '', 'explicit'),
      cardFace(deck, 'K', '♥', '', 'explicit'),
      cardFace(deck, 'Q', '♦', '', 'explicit'),
    );
    // Uploaded preview art replaces the fan (letterboxed, never stretched).
    if (deckThemes.canShowArt(deck.id, 'explicit')) {
      void assetManager.loadPreview(theme).then((img) => {
        if (!img) return;
        preview.dataset.preview = 'image';
        preview.replaceChildren(h('img', { class: 'deck-preview-img', src: img.url, alt: `${deck.name} preview` }));
      });
    }
    const variants = h('div', { class: 'variants' });
    const drawVariants = () => {
      const list = deckThemes.variants(deck.id);
      variants.replaceChildren(
        ...(list.length
          ? [
              h('h3', { class: 'options-heading' }, 'Alternate artwork'),
              ...list.map((v) => variantRow(deck, v, drawVariants)),
            ]
          : []),
      );
    };
    if (unlocked) drawVariants();

    const choice = await openDialog<'use' | 'gallery' | 'close'>({
      title: deck.name,
      class: 'dialog-wide',
      body: h(
        'div',
        { class: 'item-detail', 'data-deck-detail': deck.id },
        preview,
        h('div', { class: 'item-meta' }, ...deckBadges(deck), favoriteButton(store, deck.id)),
        artistCredit(deck.artist),
        h('p', null, deck.description),
        unlocked
          ? h('p', { class: 'unlock-status owned', 'data-unlock': 'owned' }, icon('check'), 'In your collection')
          : h('p', { class: 'unlock-status', 'data-unlock': 'locked' }, icon('lock'), `Unlock: ${unlockHint(deck)}`),
        variants,
      ),
      dismissValue: 'close',
      actions: [
        { label: 'View cards', value: 'gallery', variant: 'ghost' },
        ...(unlocked && store.state.selection.deckId !== deck.id
          ? [{ label: 'Use this deck', value: 'use' as const, icon: 'check' as const }]
          : [{ label: 'Close', value: 'close' as const, variant: 'secondary' as const }]),
      ],
    });
    if (choice === 'use') {
      store.dispatch({ type: 'SELECT_DECK', deckId: deck.id });
      notify(`Now playing with ${deck.name}.`, { kind: 'success' });
    }
    if (choice === 'gallery') {
      galleryDeck = deck.id;
      t.select('gallery');
      return;
    }
    t.select('decks');
  }

  // ----- Tabs -----
  const deckList = () => {
    const favs = profile().favoriteDecks;
    const visible = decks.filter((d) =>
      filter === 'owned' ? isDeckUnlocked(d.id, profile()) : filter === 'favorites' ? favs.includes(d.id) : true,
    );
    // Favorites first, otherwise registry order.
    return [...visible].sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));
  };

  const decksPanel = () => {
    const items = deckList();
    const pager = items.length
      ? paginatorPanel({
          items,
          minTileWidth: 150,
          minTileHeight: 130,
          maxTileHeight: 280,
          label: 'Decks',
          initialIndex: Math.max(
            0,
            items.findIndex((d) => d.id === store.state.selection.deckId),
          ),
          render: (d) => {
            const owned = isDeckUnlocked(d.id, profile());
            const equipped = store.state.selection.deckId === d.id;
            return h(
              'div',
              {
                class: `tile deck-tile rarity-${d.rarity}${owned ? '' : ' locked'}${equipped ? ' selected' : ''}`,
                'data-deck': d.id,
              },
              h(
                'button',
                {
                  type: 'button',
                  class: 'tile-main',
                  'aria-label': `${d.name} details`,
                  onclick: () => void inspect(d),
                },
                h('span', { class: 'deck-preview' }, cardBack(d, 'preview-back solo')),
                h('span', { class: 'tile-title' }, d.name),
                h('span', { class: 'tile-artist' }, artistLine(d.artist)),
                owned
                  ? h(
                      'span',
                      { class: 'tile-meta' },
                      equipped ? badge('In use', 'badge-accent') : badge(d.rarity, `badge-${d.rarity}`),
                      d.contentRating === 'mature' ? badge('18+', 'badge-mature') : null,
                    )
                  : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(d)),
              ),
              favoriteButton(store, d.id),
            );
          },
        })
      : h(
          'p',
          { class: 'empty-note', 'data-empty': filter },
          filter === 'favorites' ? 'Tap ☆ on a deck to add it to your favorites.' : 'No decks here yet.',
        );
    const filterControl = segmented(
      'Show',
      [
        { value: 'all', label: 'All' },
        { value: 'owned', label: 'Owned' },
        { value: 'favorites', label: 'Favorites' },
      ],
      filter,
      (v) => {
        filter = v;
        t.select('decks');
      },
    );
    filterControl.classList.add('collection-filter');
    const panel = h('div', { class: 'stack' }, filterControl, pager);
    return Object.assign(panel, { destroy: (pager as HTMLElement & { destroy?: () => void }).destroy });
  };

  const backsPanel = () => {
    const backs = [
      { id: '', deckId: store.state.selection.deckId, label: 'Match deck' },
      ...deckThemes.availableBacks(),
    ];
    const panel = paginatorPanel({
      items: backs,
      minTileWidth: 110,
      minTileHeight: 170,
      maxTileHeight: 220,
      label: 'Card backs',
      render: (b) => {
        const selected = (store.state.selection.cardBack ?? '') === b.id;
        const theme = b.id
          ? deckThemes.resolve(b.deckId, (b as { variantId?: string }).variantId)
          : deckThemes.resolve(store.state.selection.deckId);
        const back = b.id
          ? cardRenderer.renderBack(
              { ...theme, backTheme: undefined },
              { className: 'preview-back solo', cover: !deckThemes.canShowArt(b.deckId, 'ordinary') },
            )
          : cardBack(getDeck(b.deckId), 'preview-back solo');
        return h(
          'button',
          {
            type: 'button',
            class: `tile deck-tile${selected ? ' selected' : ''}`,
            'data-back': b.id || 'match',
            'aria-pressed': String(selected),
            onclick: () => {
              audio.play('tap');
              store.dispatch({ type: 'SELECT_CARD_BACK', back: b.id || null });
              notify(b.id ? `Card back: ${b.label}.` : 'Card backs now match your deck.', {
                kind: 'success',
                sound: false,
              });
              t.select('backs');
            },
          },
          selected ? h('span', { class: 'tile-check' }, icon('check')) : null,
          h('span', { class: 'deck-preview' }, back),
          h('span', { class: 'tile-title' }, b.label),
        );
      },
    });
    return panel;
  };

  const galleryPanel = () => {
    const deck = getDeck(galleryDeck);
    const select = h(
      'select',
      {
        class: 'gallery-select',
        'aria-label': 'Deck to view',
        'data-gallery-deck': '',
        onchange: () => {
          galleryDeck = select.value;
          t.select('gallery');
        },
      },
      ...decks.map((d) => h('option', { value: d.id, selected: d.id === deck.id }, d.name)),
    );
    const cards = SUITS.flatMap((suit) => RANK_LABELS.map((rank) => ({ rank, suit })));
    const pager = paginatorPanel({
      items: cards,
      minTileWidth: 64,
      minTileHeight: 96,
      maxTileHeight: 130,
      gap: 10,
      label: `${deck.name} cards`,
      render: ({ rank, suit }) => h('div', { class: 'gallery-cell' }, cardFace(deck, rank, suit, '', 'explicit')),
    });
    const panel = h('div', { class: 'stack' }, h('label', { class: 'gallery-head' }, 'Deck', select), pager);
    return Object.assign(panel, { destroy: (pager as HTMLElement & { destroy?: () => void }).destroy });
  };

  const t = tabs([
    { id: 'decks', label: 'Decks', render: decksPanel },
    { id: 'backs', label: 'Card Backs', render: backsPanel },
    { id: 'gallery', label: 'Card Gallery', render: galleryPanel },
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
    el: screenFrame({ title: 'Deck Collection', body: h('div', { class: 'stack' }, summary, t.el) }),
    unmount: t.destroy,
  };
};
