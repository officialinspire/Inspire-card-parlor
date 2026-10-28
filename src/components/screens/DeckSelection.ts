import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { DECKS } from '@/decks/registry';
import { getGame } from '@/games/registry';
import { isDeckUnlocked, unlockHint } from '@/progression/levels';
import { audio } from '@/audio';
import { cardBack, cardFace } from '../Card';
import { paginator } from '../Paginator';
import { badge, button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const DeckSelectionScreen: ScreenFactory = ({ store }) => {
  const game = getGame(store.state.selection.gameId);
  const pager = paginator({
    items: DECKS,
    minTileWidth: 160,
    minTileHeight: 210,
    label: 'Decks',
    initialIndex: DECKS.findIndex((d) => d.id === store.state.selection.deckId),
    render: (deck) => {
      const unlocked = isDeckUnlocked(deck.id, store.state.profile);
      const selected = store.state.selection.deckId === deck.id;
      return h(
        'button',
        {
          type: 'button',
          class: `tile deck-tile rarity-${deck.rarity}${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`,
          'aria-pressed': String(selected),
          'aria-disabled': String(!unlocked),
          onclick: () => {
            if (!unlocked) return audio.play('error');
            audio.play('flip');
            store.dispatch({ type: 'SELECT_DECK', deckId: deck.id });
            pager.refresh();
          },
        },
        h('span', { class: 'deck-preview' }, cardBack(deck, 'preview-back'), cardFace(deck, 'A', '♥', 'preview-face')),
        h('span', { class: 'tile-title' }, deck.name),
        unlocked
          ? badge(deck.rarity, `badge-${deck.rarity}`)
          : h('span', { class: 'tile-lock' }, `🔒 ${unlockHint(deck)}`),
      );
    },
  });

  return {
    el: screenFrame({
      title: 'Choose a Deck',
      subtitle: game ? `${game.name} · Step 2 of 3` : 'Step 2 of 3',
      body: pager.el,
      footer: button('Continue', () => navigate(AppState.BOARD_SELECTION)),
    }),
    unmount: pager.destroy,
  };
};
