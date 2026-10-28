import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import type { GameStats } from '@/core/types';
import { GAMES, type GameDefinition } from '@/games/registry';
import { track } from '@/analytics/analytics';
import { gameThumbnail } from '../illustrations';
import { paginator } from '../Paginator';
import { badge, button, difficulty, screenFrame, statItem } from '../ui';
import type { ScreenFactory } from '../Screen';

export const fmtTime = (ms: number | null) =>
  ms == null ? '—' : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export const winRate = (s: GameStats) => (s.played ? `${Math.round((s.won / s.played) * 100)}%` : '—');

export const SETUP_STEPS = ['Game', 'Deck', 'Board'];

export const GameSelectionScreen: ScreenFactory = ({ store }) => {
  const { gameId: lastGame } = store.state.selection;

  const play = (g: GameDefinition) => {
    store.dispatch({ type: 'SELECT_GAME', gameId: g.id });
    store.dispatch({ type: 'SELECT_STORY_CHAPTER', chapterId: null });
    track('game_selected', { gameId: g.id });
    navigate(AppState.DECK_SELECTION);
  };

  const pager = paginator({
    items: GAMES,
    minTileWidth: 280,
    minTileHeight: 240,
    fill: true,
    maxColumns: 3,
    maxRows: 1,
    gap: 16,
    label: 'Games',
    initialIndex: Math.max(
      0,
      GAMES.findIndex((g) => g.id === lastGame),
    ),
    render: (g) => {
      const stats = store.state.profile.stats[g.id];
      return h(
        'article',
        { class: `game-card${g.id === lastGame ? ' last' : ''}`, 'data-game': g.id, 'aria-labelledby': `game-${g.id}` },
        h(
          'div',
          { class: 'game-card-inner' },
          h(
            'div',
            { class: 'game-thumb' },
            gameThumbnail(g.id),
            g.id === lastGame ? badge('Last played', 'badge-accent game-thumb-badge') : null,
          ),
          h(
            'div',
            { class: 'game-info' },
            h(
              'header',
              { class: 'game-head' },
              h('h2', { id: `game-${g.id}`, class: 'game-name' }, g.name),
              h('span', { class: 'game-players' }, `${g.players} · ~${g.durationMin} min`),
            ),
            h('p', { class: 'game-desc' }, g.description),
            difficulty(g.difficulty),
            h(
              'div',
              { class: 'game-stats', 'aria-label': `Your ${g.name} statistics` },
              statItem('Played', stats.played),
              statItem('Win rate', winRate(stats)),
              statItem('Best time', fmtTime(stats.bestTimeMs)),
            ),
            button(`Play ${g.name}`, () => play(g), {
              icon: 'play',
              class: 'game-play',
              attrs: { 'data-play': g.id },
            }),
          ),
        ),
      );
    },
  });

  return {
    el: screenFrame({
      title: 'Quick Play',
      steps: { current: 1, total: 3, labels: SETUP_STEPS },
      body: pager.el,
      class: 'quickplay-screen',
    }),
    unmount: pager.destroy,
  };
};
