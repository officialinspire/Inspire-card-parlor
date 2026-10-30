import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { deckThemes, getDeck } from '@/decks';
import { audio, startMusicFromGesture } from '@/audio';
import { track } from '@/analytics/analytics';
import { cardBack } from '../Card';
import { brandLogo } from '../illustrations';
import { button } from '../ui';
import { environment } from '../environment';
import { cssUrl } from '@/boards/BoardRenderer';
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

  // A thin gold line that fills as the parlor opens (updated in place so it glides).
  const fill = h('span', { class: 'boot-fill' });
  const pct = h('span', { class: 'boot-pct' });
  const bar = h(
    'div',
    { class: 'boot-bar', role: 'progressbar', 'aria-label': 'Loading', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('span', { class: 'boot-track' }, fill),
    pct,
  );
  const label = h('p', { class: 'boot-label' });
  const enter = button(
    'Enter Parlor',
    async () => {
      await audio.unlock();
      audio.play('chime');
      startMusicFromGesture(store);
      track('enter_parlor');
      store.dispatch({ type: 'JOURNAL', update: { add: { visits: 1 } } });
      navigate(AppState.MAIN_MENU);
    },
    { sfx: null, size: 'lg', variant: 'gold', class: 'btn-enter', attrs: { 'data-nav': AppState.MAIN_MENU } },
  );
  enter.hidden = true;

  const renderBoot = () => {
    const { progress, label: text, ready } = store.state.boot;
    const value = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    fill.style.transform = `scaleX(${value / 100})`;
    pct.textContent = `${value}%`;
    bar.setAttribute('aria-valuenow', String(value));
    label.textContent = ready ? 'The parlor is open.' : text;
    enter.hidden = !ready;
    el.classList.toggle('ready', ready);
    if (ready) requestAnimationFrame(() => enter.focus());
  };

  const env = environment(store, { variant: 'splash' });
  d.add(env.destroy);

  // The gold shine that sweeps across the logo is masked by the logo itself.
  const logoUrl = `${import.meta.env.BASE_URL}assets/branding/logo.webp`;
  const shine = h('span', { class: 'logo-shine', 'aria-hidden': 'true', style: { '--logo-mask': cssUrl(logoUrl) } });

  const el = h(
    'section',
    { class: 'init' },
    env.el,
    h(
      'div',
      { class: 'init-dust', 'aria-hidden': 'true' },
      ...Array.from({ length: 14 }, (_, i) =>
        h('span', {
          style: { '--x': `${(i * 71) % 100}%`, '--d': `${7 + (i % 5) * 1.6}s`, '--delay': `${(i * 0.9) % 6}s` },
        }),
      ),
    ),
    h(
      'div',
      { class: 'init-content' },
      h('p', { class: 'init-presents' }, `${APP.developer} presents`),
      h(
        'div',
        { class: 'init-title' },
        h(
          'h1',
          { class: 'game-title screen-title', tabindex: '-1' },
          h('span', { class: 'logo-wrap' }, brandLogo('init-logo'), shine),
        ),
        h('p', { class: 'game-tagline' }, 'Classic card games · Collectible decks · Cozy nights'),
      ),
      h('div', { class: 'init-stage' }, shuffle),
      h('div', { class: 'init-loader' }, bar, label, enter),
      h('p', { class: 'init-version' }, `Version ${APP.version}`),
    ),
  );

  renderBoot();
  d.add(store.select((s) => s.boot, renderBoot));

  return { el, unmount: () => d.dispose() };
};
