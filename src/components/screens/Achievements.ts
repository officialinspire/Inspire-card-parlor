import { h } from '@/utils/dom';
import type { Profile } from '@/core/types';
import {
  ACHIEVEMENTS,
  CATEGORIES,
  RARITY_LABEL,
  progressOf,
  type AchievementCategory,
  type AchievementDefinition,
} from '@/achievements/registry';
import { buildFacts, type Facts } from '@/achievements/facts';
import { medal } from '../medal';
import { openDialog } from '../Dialog';
import { paginatorPanel } from '../Paginator';
import { tabs } from '../Tabs';
import { progressBar, screenFrame } from '../ui';
import { fmtDate } from './Passport';
import type { ScreenFactory } from '../Screen';

const fmtNum = (n: number) => n.toLocaleString();

/** "3 / 10", or a time for time-based goals. */
function progressText(a: AchievementDefinition, f: Facts): string {
  const v = progressOf(a, f);
  return a.target === 1 ? (v >= 1 ? 'Done' : 'Not yet') : `${fmtNum(Math.floor(v))} / ${fmtNum(a.target)}`;
}

function detail(a: AchievementDefinition, p: Profile, f: Facts): void {
  const got = p.unlockedAchievements.includes(a.id);
  const secret = a.hidden && !got;
  void openDialog({
    title: secret ? 'Secret achievement' : a.name,
    class: 'dialog-achievement',
    body: h(
      'div',
      { class: 'achievement-detail', 'data-achievement-detail': a.id },
      medal(a, { earned: got, size: 96 }),
      h('p', null, secret ? 'Keep exploring the parlor to discover this one.' : a.description),
      h(
        'p',
        { class: 'achievement-meta' },
        h(
          'span',
          { class: `rarity-chip rarity-${a.rarity}` },
          h('i', { 'aria-hidden': 'true' }),
          RARITY_LABEL[a.rarity],
        ),
        h('span', null, `${a.xp} XP`),
      ),
      got
        ? h('p', { class: 'ask-hint' }, `Earned ${fmtDate(p.achievementDates[a.id])}`)
        : secret
          ? null
          : h(
              'div',
              { class: 'achievement-progress' },
              progressBar(progressOf(a, f) / a.target, `${a.name} progress`),
              h('small', null, progressText(a, f)),
            ),
    ),
    dismissValue: undefined,
    actions: [{ label: 'Close', value: undefined }],
  });
}

export const AchievementsScreen: ScreenFactory = ({ store }) => {
  const p = store.state.profile;
  const f = buildFacts(p);
  const unlocked = new Set(p.unlockedAchievements);
  const earned = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;
  // Earned first (newest first), then closest to done.
  const order = (list: AchievementDefinition[]) =>
    [...list].sort((a, b) => {
      const ga = unlocked.has(a.id);
      const gb = unlocked.has(b.id);
      if (ga !== gb) return ga ? -1 : 1;
      if (ga) return (p.achievementDates[b.id] ?? 0) - (p.achievementDates[a.id] ?? 0);
      return progressOf(b, f) / b.target - progressOf(a, f) / a.target;
    });

  const tile = (a: AchievementDefinition) => {
    const got = unlocked.has(a.id);
    const secret = a.hidden && !got;
    const ratio = progressOf(a, f) / a.target;
    return h(
      'button',
      {
        type: 'button',
        class: `tile achievement-tile rarity-${a.rarity}${got ? ' earned' : ''}${secret ? ' secret' : ''}`,
        'data-achievement': a.id,
        'data-rarity': a.rarity,
        'aria-label': `${secret ? 'Secret achievement' : a.name}. ${got ? 'Earned.' : secret ? '' : progressText(a, f)}`,
        onclick: () => detail(a, store.state.profile, f),
      },
      h('span', { class: 'achievement-medal' }, medal(a, { earned: got, size: 44 })),
      h(
        'span',
        { class: 'tile-body' },
        h('span', { class: 'tile-title' }, secret ? 'Secret' : a.name),
        h('span', { class: 'tile-sub' }, secret ? 'Keep exploring to discover it.' : a.description),
        got
          ? h(
              'span',
              { class: 'achievement-date', 'data-earned': '' },
              `${RARITY_LABEL[a.rarity]} · ${fmtDate(p.achievementDates[a.id])}`,
            )
          : h(
              'span',
              { class: 'achievement-bar' },
              secret ? null : progressBar(ratio, `${a.name} progress`),
              h('small', null, secret ? RARITY_LABEL[a.rarity] : `${RARITY_LABEL[a.rarity]} · ${progressText(a, f)}`),
            ),
      ),
    );
  };

  const panel = (list: AchievementDefinition[], label: string) =>
    paginatorPanel({
      items: order(list),
      minTileWidth: 290,
      minTileHeight: 86,
      maxTileHeight: 112,
      label: `${label} achievements`,
      render: tile,
    });

  const categoryLabel = (id: AchievementCategory) => {
    const all = ACHIEVEMENTS.filter((a) => a.category === id);
    return `${CATEGORIES.find((c) => c.id === id)!.label} ${all.filter((a) => unlocked.has(a.id)).length}/${all.length}`;
  };

  const t = tabs([
    { id: 'all', label: 'All', render: () => panel([...ACHIEVEMENTS], 'All') },
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: categoryLabel(c.id),
      render: () =>
        panel(
          ACHIEVEMENTS.filter((a) => a.category === c.id),
          c.label,
        ),
    })),
  ]);

  const summary = h(
    'div',
    { class: 'summary-row' },
    h('span', { 'data-value': 'earned' }, `${earned} / ${ACHIEVEMENTS.length} earned`),
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
