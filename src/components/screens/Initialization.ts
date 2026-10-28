import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { deckThemes, getDeck } from '@/decks';
import { audio, getTrack } from '@/audio';
import { track } from '@/analytics/analytics';
import { cardBack } from '../Card';
import { brandLogo, parlorScene } from '../illustrations';
import { progressBar, button } from '../ui';
import { Disposer, type ScreenFactory } from '../Screen';

export const InitializationScreen: ScreenFactory = ({ store }) => {
  const d = new Disposer();
  const deck = getDeck(deckThemes.safeDeckId(store.state.selection.deckId));

  const shuffle = h(
    'div',
    { class: 'shuffle', 'aria-hidden': 'true' },
    ...Array.from({ length: 7 }, (_, i) => {
      const c = cardBack(deck, 'shuffle-card');
      c.style.setProperty('--i', String(i));
      return c;
    }),
  );

  const bar = h('div', { class: 'boot-bar' });
  const label = h('p', { class: 'boot-label' });
  const enter = button(
    'Enter Parlor',
    async () => {
      await audio.unlock();
      audio.play('chime');
      audio.startMusic(getTrack(store.state.settings.musicTrack));
      track('enter_parlor');
      const p = store.state.profile;
      if (!p.unlockedAchievements.includes('first-visit')) {
        store.dispatch({
          type: 'UPDATE_PROFILE',
          patch: { unlockedAchievements: [...p.unlockedAchievements, 'first-visit'] },
        });
      }
      navigate(AppState.MAIN_MENU);
    },
    { sfx: null, size: 'lg', class: 'btn-enter', attrs: { 'data-nav': AppState.MAIN_MENU } },
  );
  enter.hidden = true;

  const renderBoot = () => {
    const { progress, label: text, ready } = store.state.boot;
    bar.replaceChildren(progressBar(progress, 'Loading'));
    label.textContent = ready ? 'The parlor is open.' : text;
    enter.hidden = !ready;
    el.classList.toggle('ready', ready);
    if (ready) requestAnimationFrame(() => enter.focus());
  };

  const el = h(
    'section',
    { class: 'init' },
    parlorScene('init-scene'),
    h(
      'div',
      { class: 'init-content' },
      h(
        'div',
        { class: 'init-brand' },
        h('span', { class: 'brand-mark' }, 'INSPIRE'),
        h('span', { class: 'brand-sub' }, `${APP.developer} presents`),
      ),
      h('div', { class: 'init-stage' }, shuffle),
      h(
        'div',
        { class: 'init-title' },
        h('h1', { class: 'game-title screen-title', tabindex: '-1' }, brandLogo('init-logo')),
        h('p', { class: 'game-tagline' }, 'Classic card games · Collectible decks · Cozy nights'),
      ),
      h('div', { class: 'init-loader' }, bar, label, enter),
      h('p', { class: 'init-version' }, `v${APP.version}`),
    ),
  );

  renderBoot();
  d.add(store.select((s) => s.boot, renderBoot));

  return { el, unmount: () => d.dispose() };
};
