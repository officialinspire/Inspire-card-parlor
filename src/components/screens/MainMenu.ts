import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate, store } from '@/core/store';
import { deckThemes, getDeck, visibleBoards } from '@/decks';
import { getBoard } from '@/boards/registry';
import { boardSwatch } from '@/boards/BoardRenderer';
import { audio, getTrack, music } from '@/audio';
import { openMusicPlayer } from '../musicPlayer';
import { levelProgress } from '@/progression/levels';
import { collectionProgress } from '@/progression/collection';
import { resolveTheme } from '@/themes/theme';
import { icon, type IconName } from '../icons';
import { brandLogo } from '../illustrations';
import { environment } from '../environment';
import { live } from '../live';
import { cardBack } from '../Card';
import { GAMES } from '@/games/registry';
import { STORY_CHAPTERS } from '@/story/campaign';
import { isPlayableChapter } from '@/story/world';
import { isChapterComplete, storyOf } from '@/story/progress';
import { button, creditsPill, fullscreenButton, iconButton } from '../ui';
import { takeMenuReveal } from '../menuReveal';
import { Disposer, type ScreenFactory } from '../Screen';

interface MenuEntry {
  state: AppState;
  label: string;
  /** Shown instead of the label on narrow tiles (phones). */
  short?: string;
  icon: IconName;
  hint: string;
}

/**
 * The destinations under the featured Story Mode card, in menu order. Music
 * opens the player over the menu (no screen of its own).
 */
export const MENU_ENTRIES: readonly MenuEntry[] = [
  { state: AppState.GAME_SELECTION, label: 'Card Games', short: 'Games', icon: 'cards', hint: 'Five classic games' },
  { state: AppState.COLLECTION, label: 'Collection', short: 'Decks', icon: 'binder', hint: 'Decks, backs & art' },
  { state: AppState.GAMEBOARDS, label: 'Gameboards', short: 'Boards', icon: 'board', hint: 'Tables & felts' },
  { state: AppState.PASSPORT, label: 'Passport', icon: 'passport', hint: 'Your progress' },
  {
    state: AppState.ACHIEVEMENTS,
    label: 'Achievements',
    short: 'Trophies',
    icon: 'trophy',
    hint: 'Medals & milestones',
  },
  { state: AppState.STATISTICS, label: 'Statistics', short: 'Stats', icon: 'stats', hint: 'Your records' },
  { state: AppState.SETTINGS, label: 'Settings', icon: 'settings', hint: 'Sound & display' },
];

const go = (state: AppState) => () => {
  audio.play('tap');
  navigate(state);
};

/** A small ring that fills with progress (level XP, collection). */
function ring(ratio: number, inner: Node | string): HTMLElement {
  return h(
    'span',
    { class: 'ring', style: { '--p': String(Math.max(0, Math.min(1, ratio))) } },
    h('span', { class: 'ring-inner' }, inner),
  );
}

/** Level, credits and collection progress. */
function playerStatus(): HTMLElement {
  const level = live(
    h('button', {
      type: 'button',
      class: 'status-pill status-level',
      'data-nav': AppState.PASSPORT,
      'data-status': 'level',
      onclick: go(AppState.PASSPORT),
    }),
    (s) => s.profile,
    (el, p) => {
      const lp = levelProgress(p);
      el.title = `Level ${lp.level} — ${lp.current} / ${lp.needed} XP`;
      el.setAttribute('aria-label', `Player level ${lp.level}, ${lp.current} of ${lp.needed} XP — open your Passport`);
      el.replaceChildren(ring(lp.ratio, String(lp.level)), h('span', { class: 'status-caption' }, 'Level'));
    },
  );
  const collection = live(
    h('button', {
      type: 'button',
      class: 'status-pill status-collection',
      'data-nav': AppState.COLLECTION,
      'data-status': 'collection',
      onclick: go(AppState.COLLECTION),
    }),
    (s) => s.profile,
    (el, p) => {
      const c = collectionProgress(p, deckThemes.list(), visibleBoards());
      el.title = `Collection ${c.percent}% complete`;
      el.setAttribute('aria-label', `Collection ${c.percent}% complete — open Deck Collection`);
      el.dataset.value = String(c.percent);
      el.replaceChildren(ring(c.percent / 100, icon('cards')), h('span', { class: 'status-caption' }, `${c.percent}%`));
    },
  );
  return h('div', { class: 'menu-status', role: 'group', 'aria-label': 'Player' }, level, creditsPill(), collection);
}

/** Day / Night: the riverfront by sunlight or by lamplight (also sets the parlor's palette). */
function environmentToggle(): HTMLElement {
  const choice = (kind: 'day' | 'night', label: string, ic: IconName) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'data-env-choice': kind,
        title: label,
        onclick: () => {
          audio.play('tap');
          store.dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: kind } });
        },
      },
      icon(ic),
      h('span', null, label),
    );
  const group = h(
    'div',
    { class: 'env-toggle', role: 'radiogroup', 'aria-label': 'Menu scene' },
    choice('day', 'Day', 'sun'),
    choice('night', 'Night', 'moon'),
  );
  return live(
    group,
    (s) => s.settings.theme,
    (el, mode) => {
      const active = resolveTheme(mode);
      el.dataset.active = active;
      for (const b of el.querySelectorAll<HTMLElement>('[data-env-choice]'))
        b.setAttribute('aria-checked', String(b.dataset.envChoice === active));
    },
  );
}

/** The table you'll sit down at: selected deck and gameboard. */
function setupChips(): HTMLElement {
  const deck = live(
    h('button', {
      type: 'button',
      class: 'setup-chip',
      'data-status': 'deck',
      'data-nav': AppState.COLLECTION,
      'aria-label': 'Selected deck — open Deck Collection',
      onclick: go(AppState.COLLECTION),
    }),
    (s) => s.selection.deckId,
    (el, id) => {
      const d = getDeck(deckThemes.safeDeckId(id));
      el.setAttribute('aria-label', `Deck: ${d.name}. Change deck`);
      el.replaceChildren(
        h('span', { class: 'setup-visual' }, cardBack(d, 'chip-card')),
        h('span', { class: 'setup-text' }, h('small', null, 'Deck'), h('span', { 'data-value': 'deck' }, d.name)),
      );
    },
  );
  const board = live(
    h('button', {
      type: 'button',
      class: 'setup-chip',
      'data-status': 'board',
      'data-nav': AppState.GAMEBOARDS,
      'aria-label': 'Selected gameboard — open Gameboards',
      onclick: go(AppState.GAMEBOARDS),
    }),
    (s) => s.selection.boardId,
    (el, id) => {
      const b = getBoard(id);
      el.setAttribute('aria-label', `Gameboard: ${b.name}. Change gameboard`);
      el.replaceChildren(
        h('span', { class: 'setup-visual' }, boardSwatch(b, { className: 'chip-board' })),
        h('span', { class: 'setup-text' }, h('small', null, 'Board'), h('span', { 'data-value': 'board' }, b.name)),
      );
    },
  );
  return h('div', { class: 'menu-setup', 'aria-label': 'Your table' }, deck, board);
}

function nowPlaying(): HTMLElement {
  return live(
    h('div', { class: 'menu-music', 'data-status': 'music' }),
    (s) => `${s.settings.musicTrack}|${s.settings.musicPaused}`,
    (el) => {
      const { musicTrack: id, musicPaused: paused } = store.state.settings;
      el.replaceChildren(
        iconButton(paused ? 'play' : 'pause', paused ? 'Play music' : 'Pause music', () => music.toggle(), {
          size: 'sm',
          sfx: null,
          variant: 'ghost',
          class: 'status-play',
          attrs: { 'data-action': 'music-toggle' },
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'menu-music-title',
            'aria-live': 'polite',
            title: 'Open the music player',
            'data-action': 'music-player',
            onclick: () => {
              audio.play('tap');
              void openMusicPlayer();
            },
          },
          h('span', { 'data-value': 'music' }, getTrack(id).title),
        ),
        iconButton('next', 'Next track', () => music.next(), {
          size: 'sm',
          sfx: null,
          variant: 'ghost',
          class: 'status-next',
          attrs: { 'data-action': 'next-track' },
        }),
      );
    },
  );
}

/**
 * The featured action: Story Mode, with where the player is in it. A small fan
 * of the selected deck rides on the card and opens on hover.
 */
function storyFeature(): HTMLElement {
  const fan = live(
    h('span', { class: 'play-fan', 'aria-hidden': 'true' }),
    (s) => s.selection.deckId,
    (el, id) => {
      const d = getDeck(deckThemes.safeDeckId(id));
      el.replaceChildren(
        ...[0, 1, 2].map((i) => {
          const c = cardBack(d, 'play-fan-card');
          c.style.setProperty('--i', String(i));
          return c;
        }),
      );
    },
  );
  const text = live(
    h('span', { class: 'play-text' }),
    (s) => s.profile,
    (el, p) => {
      const story = storyOf(p);
      // Only written chapters are playable; the counts cover those, not the outlines.
      const playable = STORY_CHAPTERS.filter(isPlayableChapter);
      const levels = new Set(playable.flatMap((c) => c.levels.map((l) => l.id)));
      const cleared = story.completed.filter((id) => levels.has(id)).length;
      const next = STORY_CHAPTERS.find((c) => !isChapterComplete(p, c));
      const status = !next
        ? 'The Thirteenth Hand is complete'
        : isPlayableChapter(next)
          ? `Chapter ${next.index} · ${next.title}`
          : `Chapter ${next.index} coming soon`;
      el.replaceChildren(
        h('span', { class: 'play-label' }, story.completed.length ? 'Continue Story' : 'Story Mode'),
        h('span', { class: 'play-hint', 'data-value': 'story-chapter' }, status),
        h(
          'span',
          { class: 'play-progress', 'data-value': 'story-progress' },
          `${cleared}/${levels.size} challenges · ${story.stamps.length}/${playable.length} stamps`,
        ),
      );
    },
  );
  const btn = button(text, () => navigate(AppState.STORY_MODE), {
    variant: 'gold',
    size: 'lg',
    icon: 'story',
    class: 'menu-play menu-story',
    attrs: { 'data-nav': AppState.STORY_MODE },
  });
  btn.append(fan);
  return btn;
}

/** Straight back to the last game played, with the chosen deck and table. */
function quickPlay(): HTMLElement {
  return live(
    h('button', {
      type: 'button',
      class: 'quick-play',
      'data-action': 'quick-play',
      onclick: () => {
        const s = store.state;
        const game = s.selection.gameId ?? 'klondike';
        audio.play('shuffle');
        store.dispatch({ type: 'SELECT_GAME', gameId: game });
        store.dispatch({ type: 'START_GAME' });
        navigate(AppState.GAMEPLAY);
      },
    }),
    (s) => s.selection.gameId,
    (el, id) => {
      const game = GAMES.find((g) => g.id === (id ?? 'klondike'))!;
      el.setAttribute('aria-label', `Quick Play: ${game.name}`);
      el.replaceChildren(
        icon('play'),
        h('span', { class: 'quick-play-text' }, h('small', null, 'Quick Play'), h('span', null, game.name)),
      );
    },
  );
}

export const MainMenuScreen: ScreenFactory = () => {
  const d = new Disposer();
  const env = environment(store, { variant: 'menu' });
  d.add(env.destroy);

  const el = h(
    'section',
    { class: 'menu' },
    env.el,
    h(
      'div',
      { class: 'menu-layout' },
      h(
        'h1',
        {
          class: 'menu-title screen-title',
          tabindex: '-1',
          // A little secret: knock on the sign.
          onclick: () => store.dispatch({ type: 'JOURNAL', update: { add: { 'logo.taps': 1 } } }),
        },
        brandLogo('menu-logo'),
      ),
      h('div', { class: 'menu-top' }, playerStatus(), fullscreenButton()),
      h('div', { class: 'menu-stage' }, environmentToggle()),
      h(
        'div',
        { class: 'menu-panel' },
        storyFeature(),
        h('div', { class: 'menu-quick' }, quickPlay(), setupChips()),
        h(
          'nav',
          { class: 'menu-grid', 'aria-label': 'Main menu' },
          ...MENU_ENTRIES.map((e, i) =>
            button(
              h(
                'span',
                { class: 'menu-tile-content' },
                h('span', { class: 'menu-tile-icon' }, icon(e.icon)),
                h(
                  'span',
                  { class: 'menu-tile-text' },
                  h(
                    'span',
                    { class: 'menu-tile-label' },
                    e.short
                      ? [h('span', { class: 'label-full' }, e.label), h('span', { class: 'label-short' }, e.short)]
                      : e.label,
                  ),
                  h('span', { class: 'menu-tile-hint' }, e.hint),
                ),
              ),
              () => navigate(e.state),
              {
                variant: 'plain',
                class: 'menu-tile',
                attrs: { 'data-nav': e.state, style: `--i:${i}`, 'aria-label': e.label },
              },
            ),
          ),
          button(
            h(
              'span',
              { class: 'menu-tile-content' },
              h('span', { class: 'menu-tile-icon' }, icon('music')),
              h(
                'span',
                { class: 'menu-tile-text' },
                h('span', { class: 'menu-tile-label' }, 'Music'),
                h('span', { class: 'menu-tile-hint' }, 'Playlists & tracks'),
              ),
            ),
            () => void openMusicPlayer(),
            {
              variant: 'plain',
              class: 'menu-tile',
              attrs: { 'data-action': 'music-player', style: `--i:${MENU_ENTRIES.length}` },
            },
          ),
        ),
      ),
      h(
        'footer',
        { class: 'menu-footer' },
        nowPlaying(),
        h(
          'span',
          { class: 'menu-footer-meta' },
          h('span', null, `v${APP.version}`),
          h('a', { href: APP.website, target: '_blank', rel: 'noopener' }, APP.websiteLabel),
        ),
      ),
    ),
  );

  // Arriving from the opening sequence: the riverfront rises out of black, once.
  const reveal = takeMenuReveal();
  if (reveal !== null) {
    const veil = h('div', { class: 'menu-veil', 'aria-hidden': 'true', style: { '--reveal': `${reveal}ms` } });
    el.classList.add('from-intro');
    el.append(veil);
    const done = setTimeout(() => {
      veil.remove();
      el.classList.remove('from-intro');
    }, reveal + 100);
    d.add(() => clearTimeout(done));
  }

  return { el, unmount: () => d.dispose() };
};
