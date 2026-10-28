import { h } from '@/utils/dom';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { CHAPTERS, getCharacter } from '@/story/chapters';
import { getGame } from '@/games/registry';
import { audio } from '@/audio';
import { notify } from '../Notifications';
import { paginator } from '../Paginator';
import { badge, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const StoryModeScreen: ScreenFactory = ({ store }) => {
  const reached = store.state.profile.storyChapter;
  const pager = paginator({
    items: CHAPTERS,
    minTileWidth: 280,
    minTileHeight: 120,
    maxTileHeight: 170,
    maxColumns: 2,
    label: 'Chapters',
    initialIndex: Math.min(reached, CHAPTERS.length - 1),
    render: (ch) => {
      const host = getCharacter(ch.hostId);
      const game = getGame(ch.gameId);
      const unlocked = ch.index <= reached + 1;
      const done = ch.index <= reached;
      return h(
        'button',
        {
          type: 'button',
          class: `tile chapter-tile${unlocked ? '' : ' locked'}${done ? ' done' : ''}`,
          'aria-disabled': String(!unlocked),
          'data-chapter': ch.id,
          onclick: () => {
            if (!unlocked)
              return void notify('Finish the previous chapter to unlock this one.', { kind: 'warning', icon: 'lock' });
            audio.play('tap');
            store.dispatch({ type: 'SELECT_STORY_CHAPTER', chapterId: ch.id });
            store.dispatch({ type: 'SELECT_GAME', gameId: ch.gameId });
            navigate(AppState.GAMEPLAY);
          },
        },
        h(
          'span',
          { class: 'portrait', style: { background: host?.color ?? '#888' }, 'aria-hidden': 'true' },
          host?.name[0] ?? '?',
        ),
        h(
          'span',
          { class: 'tile-body' },
          h('span', { class: 'tile-kicker' }, `Chapter ${ch.index}${host ? ` · ${host.name}` : ''}`),
          h('span', { class: 'tile-title' }, unlocked ? ch.title : '???'),
          h('span', { class: 'tile-sub' }, unlocked ? ch.synopsis : 'Complete the previous chapter to continue.'),
          h(
            'span',
            { class: 'tile-meta' },
            game ? badge(game.name) : null,
            badge(`${ch.reward.credits} credits`),
            done ? badge('Complete', 'badge-done') : null,
          ),
        ),
      );
    },
  });

  return {
    el: screenFrame({ title: 'Story Mode', subtitle: 'The tale of the parlor', body: pager.el }),
    unmount: pager.destroy,
  };
};
