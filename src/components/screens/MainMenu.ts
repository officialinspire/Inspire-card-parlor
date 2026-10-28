import { frag, h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import { levelProgress } from '@/progression/levels';
import { fullscreen } from '@/utils/device';
import { button, progressBar } from '../ui';
import { Disposer, type ScreenFactory } from '../Screen';

const ENTRIES: { state: AppState; label: string; icon: string; hint: string; primary?: boolean }[] = [
  { state: AppState.GAME_SELECTION, label: 'Play', icon: '♠', hint: 'Five classic games', primary: true },
  { state: AppState.STORY_MODE, label: 'Story', icon: '📖', hint: 'The parlor’s tale' },
  { state: AppState.COLLECTION, label: 'Collection', icon: '🃏', hint: 'Decks & boards' },
  { state: AppState.ACHIEVEMENTS, label: 'Achievements', icon: '★', hint: 'Trophies' },
  { state: AppState.STATISTICS, label: 'Statistics', icon: '📊', hint: 'Your records' },
  { state: AppState.SETTINGS, label: 'Settings', icon: '⚙', hint: 'Sound & display' },
];

export const MainMenuScreen: ScreenFactory = ({ store }) => {
  const d = new Disposer();
  const profileChip = h('div', { class: 'profile-chip' });

  const renderProfile = () => {
    const p = store.state.profile;
    const lp = levelProgress(p);
    profileChip.replaceChildren(
      h('span', { class: 'profile-level', title: 'Level' }, String(lp.level)),
      h(
        'span',
        { class: 'profile-meta' },
        h('span', { class: 'profile-name' }, p.playerName),
        progressBar(lp.ratio, `${lp.current} of ${lp.needed} XP`),
      ),
      h('span', { class: 'profile-coins', title: 'Coins' }, `◉ ${p.coins}`),
    );
  };
  renderProfile();
  d.add(store.select((s) => s.profile, renderProfile));

  const fsButton = fullscreen.supported()
    ? button('⛶', () => void fullscreen.toggle(), { variant: 'icon', title: 'Toggle fullscreen' })
    : null;

  const el = h(
    'section',
    { class: 'menu' },
    h(
      'header',
      { class: 'menu-header' },
      h(
        'div',
        { class: 'menu-brand' },
        h('span', { class: 'brand-mark small' }, 'INSPIRE'),
        h('h1', { class: 'menu-title screen-title', tabindex: '-1' }, 'Card Parlor'),
      ),
      h('div', { class: 'menu-header-right' }, profileChip, fsButton),
    ),
    h(
      'nav',
      { class: 'menu-grid', 'aria-label': 'Main menu' },
      ...ENTRIES.map((e) =>
        button(
          frag(
            h('span', { class: 'menu-tile-icon', 'aria-hidden': 'true' }, e.icon),
            h('span', { class: 'menu-tile-label' }, e.label),
            h('span', { class: 'menu-tile-hint' }, e.hint),
          ),
          () => navigate(e.state),
          { variant: 'plain', class: `menu-tile${e.primary ? ' menu-tile-primary' : ''}` },
        ),
      ),
    ),
    h(
      'footer',
      { class: 'menu-footer' },
      h('span', null, `v${APP.version}`),
      h('a', { href: APP.website, target: '_blank', rel: 'noopener' }, APP.websiteLabel),
    ),
  );

  return { el, unmount: () => d.dispose() };
};
