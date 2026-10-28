import { h } from '@/utils/dom';
import { ACHIEVEMENTS, type AchievementDefinition } from '@/achievements/registry';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { badge, progressBar, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

const GROUPS: { id: string; label: string; match: (a: AchievementDefinition) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'general', label: 'General', match: (a) => a.category === 'general' },
  { id: 'games', label: 'Games', match: (a) => !['general', 'collection', 'story'].includes(a.category) },
  { id: 'journey', label: 'Journey', match: (a) => a.category === 'story' || a.category === 'collection' },
];

export const AchievementsScreen: ScreenFactory = ({ store }) => {
  const unlocked = new Set(store.state.profile.unlockedAchievements);
  const earned = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  const t = tabs(
    GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      render: () =>
        paginatorPanel({
          items: ACHIEVEMENTS.filter(g.match),
          minTileWidth: 300,
          minTileHeight: 84,
          label: `${g.label} achievements`,
          render: (a) => {
            const got = unlocked.has(a.id);
            const secret = a.hidden && !got;
            return h(
              'div',
              { class: `tile achievement-tile${got ? ' earned' : ''}` },
              h('span', { class: 'achievement-icon', 'aria-hidden': 'true' }, secret ? '?' : a.icon),
              h(
                'span',
                { class: 'tile-body' },
                h('span', { class: 'tile-title' }, secret ? 'Hidden achievement' : a.name),
                h('span', { class: 'tile-sub' }, secret ? 'Keep playing to discover it.' : a.description),
              ),
              badge(got ? '✓' : `${a.xp} XP`, got ? 'badge-done' : ''),
            );
          },
        }),
    })),
  );

  const summary = h(
    'div',
    { class: 'summary-row' },
    h('span', null, `${earned} / ${ACHIEVEMENTS.length} earned`),
    progressBar(earned / ACHIEVEMENTS.length, 'Achievements earned'),
  );

  return {
    el: screenFrame({
      title: 'Achievements',
      body: h('div', { class: 'stack' }, summary, t.el),
    }),
    unmount: t.destroy,
  };
};
