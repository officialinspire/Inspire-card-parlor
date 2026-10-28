import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate, store } from '@/core/store';
import { deckThemes, getDeck } from '@/decks';
import { getBoard } from '@/boards/registry';
import { audio, getTrack, nextTrackId } from '@/audio';
import { levelProgress } from '@/progression/levels';
import { icon, type IconName } from '../icons';
import { brandLogo, parlorScene } from '../illustrations';
import { cssUrl } from '@/boards/BoardRenderer';
import { live } from '../live';
import { cardBack } from '../Card';
import { button, creditsPill, fullscreenButton, iconButton, progressBar } from '../ui';
import type { ScreenFactory } from '../Screen';

interface MenuEntry {
  state: AppState;
  label: string;
  icon: IconName;
  hint: string;
}

export const MENU_ENTRIES: readonly MenuEntry[] = [
  { state: AppState.STORY_MODE, label: 'Story Mode', icon: 'story', hint: 'The parlor’s tale' },
  { state: AppState.COLLECTION, label: 'Card Collection', icon: 'cards', hint: 'Decks & cards' },
  { state: AppState.GAMEBOARDS, label: 'Gameboards', icon: 'board', hint: 'Tables & felts' },
  { state: AppState.ACHIEVEMENTS, label: 'Achievements', icon: 'trophy', hint: 'Trophies' },
  { state: AppState.STATISTICS, label: 'Statistics', icon: 'stats', hint: 'Your records' },
  { state: AppState.SETTINGS, label: 'Settings', icon: 'settings', hint: 'Sound & display' },
];

/** Level badge with XP progress; tapping opens Statistics. */
function levelCard(): HTMLElement {
  const el = h('button', {
    type: 'button',
    class: 'menu-level',
    'data-nav': AppState.STATISTICS,
    'data-status': 'level',
    onclick: () => {
      audio.play('tap');
      navigate(AppState.STATISTICS);
    },
  });
  return live(
    el,
    (s) => s.profile,
    (node, p) => {
      const lp = levelProgress(p);
      node.title = `Level ${lp.level} — ${lp.current} / ${lp.needed} XP`;
      node.setAttribute('aria-label', `Player level ${lp.level}, ${lp.current} of ${lp.needed} XP`);
      node.replaceChildren(
        h('span', { class: 'menu-level-num' }, String(lp.level)),
        h('span', { class: 'menu-level-meta' }, h('span', null, `Level ${lp.level}`), progressBar(lp.ratio)),
      );
    },
  );
}

/** A tappable chip in the status strip (selected deck / board / music). */
function statusChip(kind: string, label: string, onClick: () => void): HTMLButtonElement {
  return h('button', {
    type: 'button',
    class: `status-chip status-${kind}`,
    'data-status': kind,
    'aria-label': label,
    onclick: () => {
      audio.play('tap');
      onClick();
    },
  });
}

function statusStrip(): HTMLElement {
  const deck = live(
    statusChip('deck', 'Selected deck — open Card Collection', () => navigate(AppState.COLLECTION)),
    (s) => s.selection.deckId,
    (el, id) => {
      const d = getDeck(deckThemes.safeDeckId(id));
      el.dataset.nav = AppState.COLLECTION;
      el.replaceChildren(
        h('span', { class: 'status-visual' }, cardBack(d, 'chip-card')),
        h('span', { class: 'status-text' }, h('small', null, 'Deck'), h('span', { 'data-value': 'deck' }, d.name)),
      );
    },
  );
  const board = live(
    statusChip('board', 'Selected gameboard — open Gameboards', () => navigate(AppState.GAMEBOARDS)),
    (s) => s.selection.boardId,
    (el, id) => {
      const b = getBoard(id);
      el.dataset.nav = AppState.GAMEBOARDS;
      el.replaceChildren(
        h('span', {
          class: 'status-visual chip-felt',
          style: { background: b.surface.felt, borderColor: b.surface.rim },
        }),
        h('span', { class: 'status-text' }, h('small', null, 'Board'), h('span', { 'data-value': 'board' }, b.name)),
      );
    },
  );
  const music = live(
    h('div', { class: 'status-chip status-music', 'data-status': 'music' }),
    (s) => s.settings.musicTrack,
    (el, id) => {
      const t = getTrack(id);
      el.replaceChildren(
        h('span', { class: 'status-visual music-visual' }, icon('music')),
        h(
          'span',
          { class: 'status-text', 'aria-live': 'polite' },
          h('small', null, 'Now playing'),
          h('span', { 'data-value': 'music' }, t.title),
        ),
        iconButton(
          'next',
          'Next track',
          () => {
            void audio
              .unlock()
              .then(() => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { musicTrack: nextTrackId(id) } }));
          },
          { size: 'sm', sfx: null, class: 'status-next', attrs: { 'data-action': 'next-track' } },
        ),
      );
    },
  );
  return h('div', { class: 'menu-status', 'aria-label': 'Current setup' }, deck, board, music);
}

export const MainMenuScreen: ScreenFactory = () => {
  const quickPlay = button(
    h(
      'span',
      { class: 'quickplay-text' },
      h('span', { class: 'quickplay-label' }, 'Quick Play'),
      h('span', { class: 'quickplay-hint' }, 'Five classic card games'),
    ),
    () => navigate(AppState.GAME_SELECTION),
    {
      variant: 'primary',
      size: 'lg',
      icon: 'play',
      class: 'quickplay',
      attrs: { 'data-nav': AppState.GAME_SELECTION },
    },
  );

  const artUrl = (path: string) => cssUrl(`${import.meta.env.BASE_URL}assets/${path}`);

  const el = h(
    'section',
    { class: 'menu' },
    h(
      'header',
      { class: 'menu-header' },
      h(
        'div',
        { class: 'menu-brand' },
        h('h1', { class: 'menu-title screen-title', tabindex: '-1' }, brandLogo('menu-logo')),
      ),
      h('div', { class: 'menu-header-right' }, levelCard(), creditsPill(), fullscreenButton()),
    ),
    h(
      'div',
      { class: 'menu-hero' },
      // The illustrated scene stays underneath as the fallback while the riverfront painting loads.
      parlorScene('menu-scene'),
      h('div', {
        class: 'menu-hero-art',
        'aria-hidden': 'true',
        style: {
          '--menu-day': artUrl('backgrounds/menu/day.webp'),
          '--menu-night': artUrl('backgrounds/menu/night.webp'),
        },
      }),
      quickPlay,
    ),
    statusStrip(),
    h(
      'nav',
      { class: 'menu-grid', 'aria-label': 'Main menu' },
      ...MENU_ENTRIES.map((e) =>
        button(
          h(
            'span',
            { class: 'menu-tile-content' },
            h('span', { class: 'menu-tile-icon' }, icon(e.icon)),
            h('span', { class: 'menu-tile-label' }, e.label),
            h('span', { class: 'menu-tile-hint' }, e.hint),
          ),
          () => navigate(e.state),
          { variant: 'plain', class: 'menu-tile', attrs: { 'data-nav': e.state } },
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

  return { el };
};
