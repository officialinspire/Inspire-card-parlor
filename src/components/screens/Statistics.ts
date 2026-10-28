import { h } from '@/utils/dom';
import { GAMES } from '@/games/registry';
import type { GameStats } from '@/core/types';
import { levelProgress } from '@/progression/levels';
import { gameThumbnail } from '../illustrations';
import { tabs } from '../Tabs';
import { progressBar, screenFrame, statItem } from '../ui';
import type { ScreenFactory } from '../Screen';
import { fmtTime, winRate } from './GameSelection';

function statGrid(...items: HTMLElement[]): HTMLElement {
  return h('div', { class: 'stat-grid' }, ...items);
}

function gameStats(s: GameStats): HTMLElement[] {
  return [
    statItem('Played', s.played),
    statItem('Won', s.won),
    statItem('Win rate', winRate(s)),
    statItem('Best time', fmtTime(s.bestTimeMs)),
    statItem('Best score', s.bestScore ?? '—'),
    statItem('Streak', `${s.currentStreak} · best ${s.longestStreak}`),
  ];
}

export const StatisticsScreen: ScreenFactory = ({ store }) => {
  const p = store.state.profile;
  const all = Object.values(p.stats);
  const played = all.reduce((n, s) => n + s.played, 0);
  const won = all.reduce((n, s) => n + s.won, 0);
  const lp = levelProgress(p);

  const t = tabs([
    {
      id: 'overview',
      label: 'Overview',
      render: () =>
        h(
          'div',
          { class: 'stats-panel' },
          h(
            'div',
            { class: 'stats-level' },
            h('span', { class: 'menu-level-num' }, String(lp.level)),
            h(
              'div',
              null,
              h('strong', null, `Level ${lp.level}`),
              progressBar(lp.ratio),
              h('small', null, `${lp.current} / ${lp.needed} XP`),
            ),
          ),
          statGrid(
            statItem('Credits', p.credits.toLocaleString()),
            statItem('Games played', played),
            statItem('Games won', won),
            statItem('Story chapter', p.storyChapter),
          ),
        ),
    },
    ...GAMES.map((g) => ({
      id: g.id,
      label: g.name,
      render: () =>
        h(
          'div',
          { class: 'stats-panel' },
          h('div', { class: 'stats-thumb' }, gameThumbnail(g.id)),
          statGrid(...gameStats(p.stats[g.id])),
        ),
    })),
  ]);

  return {
    el: screenFrame({
      title: 'Statistics',
      subtitle: `Member since ${new Date(p.createdAt).toLocaleDateString()}`,
      body: t.el,
    }),
    unmount: t.destroy,
  };
};
