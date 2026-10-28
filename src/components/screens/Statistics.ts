import { h } from '@/utils/dom';
import { GAMES } from '@/games/registry';
import type { GameStats } from '@/core/types';
import { levelProgress } from '@/progression/levels';
import { tabs } from '../Tabs';
import { screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

const fmtTime = (ms: number | null) =>
  ms == null ? '—' : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function statGrid(entries: [string, string | number][]): HTMLElement {
  return h(
    'dl',
    { class: 'stat-grid' },
    ...entries.map(([k, v]) => h('div', { class: 'stat' }, h('dt', null, k), h('dd', null, String(v)))),
  );
}

function gameStats(s: GameStats): HTMLElement {
  const rate = s.played ? `${Math.round((s.won / s.played) * 100)}%` : '—';
  return statGrid([
    ['Played', s.played],
    ['Won', s.won],
    ['Win rate', rate],
    ['Best time', fmtTime(s.bestTimeMs)],
    ['Best score', s.bestScore ?? '—'],
    ['Streak', `${s.currentStreak} (best ${s.longestStreak})`],
  ]);
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
        statGrid([
          ['Level', lp.level],
          ['XP', `${lp.current} / ${lp.needed}`],
          ['Coins', p.coins],
          ['Games played', played],
          ['Games won', won],
          ['Story chapter', p.storyChapter],
        ]),
    },
    ...GAMES.map((g) => ({ id: g.id, label: g.name, render: () => gameStats(p.stats[g.id]) })),
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
