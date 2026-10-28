import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { deckThemes } from '@/decks';
import { getGame } from '@/games/registry';
import { isDeckUnlocked, unlockHint } from '@/progression/levels';
import { audio } from '@/audio';
import { cardBack, cardFace } from '../Card';
import { icon } from '../icons';
import { notify } from '../Notifications';
import { paginator } from '../Paginator';
import { badge, button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';
import { SETUP_STEPS } from './GameSelection';

export const DeckSelectionScreen: ScreenFactory = ({ store }) => {
  const DECKS = deckThemes.list();
  const game = getGame(store.state.selection.gameId);
  const pager = paginator({
    items: DECKS,
    minTileWidth: 150,
    minTileHeight: 200,
    maxTileHeight: 280,
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
          'data-deck': deck.id,
          onclick: () => {
            if (!unlocked)
              return void notify(`${deck.name}: ${unlockHint(deck)} to unlock.`, { kind: 'warning', icon: 'lock' });
            audio.play('flip');
            store.dispatch({ type: 'SELECT_DECK', deckId: deck.id });
            pager.refresh();
          },
        },
        selected ? h('span', { class: 'tile-check' }, icon('check')) : null,
        h('span', { class: 'deck-preview' }, cardBack(deck, 'preview-back'), cardFace(deck, 'A', '♥', 'preview-face')),
        h('span', { class: 'tile-title' }, deck.name),
        unlocked
          ? badge(deck.rarity, `badge-${deck.rarity}`)
          : h('span', { class: 'tile-lock' }, icon('lock'), unlockHint(deck)),
      );
    },
  });

  return {
    el: screenFrame({
      title: game ? game.name : 'Choose a Deck',
      steps: { current: 2, total: 3, labels: SETUP_STEPS },
      body: pager.el,
      footer: button('Choose Board', () => navigate(AppState.BOARD_SELECTION), {
        icon: 'chevronRight',
        attrs: { 'data-nav': AppState.BOARD_SELECTION },
      }),
    }),
    unmount: pager.destroy,
  };
};
