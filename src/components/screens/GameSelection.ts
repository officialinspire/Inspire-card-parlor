import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { GAMES } from '@/games/registry';
import { track } from '@/analytics/analytics';
import { paginator } from '../Paginator';
import { badge, screenFrame, stars } from '../ui';
import type { ScreenFactory } from '../Screen';

export const GameSelectionScreen: ScreenFactory = ({ store }) => {
  const pager = paginator({
    items: GAMES,
    minTileWidth: 220,
    minTileHeight: 150,
    label: 'Games',
    render: (g) =>
      h(
        'button',
        {
          type: 'button',
          class: `tile game-tile${store.state.selection.gameId === g.id ? ' selected' : ''}`,
          onclick: () => {
            store.dispatch({ type: 'SELECT_GAME', gameId: g.id });
            store.dispatch({ type: 'SELECT_STORY_CHAPTER', chapterId: null });
            track('game_selected', { gameId: g.id });
            navigate(AppState.DECK_SELECTION);
          },
        },
        h('span', { class: 'game-tile-icon', 'aria-hidden': 'true' }, g.icon),
        h(
          'span',
          { class: 'tile-body' },
          h('span', { class: 'tile-title' }, g.name),
          h('span', { class: 'tile-sub' }, g.tagline),
          h(
            'span',
            { class: 'tile-meta' },
            badge(g.players),
            badge(`~${g.durationMin} min`),
            stars(g.difficulty),
            g.available ? null : badge('Preview', 'badge-soon'),
          ),
        ),
      ),
  });

  return {
    el: screenFrame({ title: 'Choose a Game', subtitle: 'Step 1 of 3', body: pager.el }),
    unmount: pager.destroy,
  };
};
