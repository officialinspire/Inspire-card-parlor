import { h } from '@/utils/dom';
import { store } from '@/core/store';
import type { Settings } from '@/core/types';
import {
  audio,
  getCategory,
  getTrack,
  MUSIC_CATEGORIES,
  music,
  nextRepeat,
  tracksIn,
  type MusicCategoryId,
} from '@/audio';
import { icon } from './icons';
import { live } from './live';
import { iconButton } from './ui';
import { slider } from './controls';
import { openDialog } from './Dialog';
import { paginatorPanel } from './Paginator';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const REPEAT_LABEL = { all: 'Repeat playlist', one: 'Repeat this track', off: 'Repeat off' } as const;

/** Title, playlist and a progress line that ticks while the player is on screen. */
function nowPlaying(): HTMLElement {
  const bar = h('span', { class: 'mp-progress-fill' });
  const time = h('span', { class: 'mp-time' });
  const el = live(
    h('div', { class: 'mp-now', 'data-now-playing': '' }),
    (s) => `${s.settings.musicTrack}|${s.settings.musicPaused}`,
    (el) => {
      const s = store.state.settings;
      const t = getTrack(s.musicTrack);
      el.dataset.nowTrack = t.id;
      el.replaceChildren(
        h('span', { class: 'mp-disc', 'data-spinning': String(!s.musicPaused) }, icon('music')),
        h(
          'span',
          { class: 'mp-title' },
          h('strong', { 'data-value': 'track-title' }, t.title),
          h('small', null, `${getCategory(t.category)?.title ?? ''} · ${t.mood}`),
        ),
        h('span', { class: 'mp-progress', 'aria-hidden': 'true' }, bar),
        time,
      );
    },
  );
  const tick = () => {
    if (!el.isConnected) return;
    const t = getTrack(store.state.settings.musicTrack);
    const pos = Math.min(audio.position, t.duration);
    bar.style.transform = `scaleX(${t.duration ? pos / t.duration : 0})`;
    time.textContent = `${fmt(pos)} / ${fmt(t.duration)}`;
    setTimeout(tick, 500);
  };
  requestAnimationFrame(tick);
  return el;
}

function transport(): HTMLElement {
  return live(
    h('div', { class: 'mp-transport', role: 'group', 'aria-label': 'Music controls' }),
    (s) =>
      `${s.settings.musicPaused}|${s.settings.musicShuffle}|${s.settings.musicRepeat}|${s.settings.musicMuted}|${s.settings.musicTrack}`,
    (el) => {
      const s = store.state.settings;
      const set = (patch: Partial<Settings>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });
      const shuffle = iconButton('shuffle', s.musicShuffle ? 'Shuffle on' : 'Shuffle off', () =>
        set({ musicShuffle: !s.musicShuffle }),
      );
      shuffle.setAttribute('aria-pressed', String(s.musicShuffle));
      shuffle.dataset.action = 'music-shuffle';
      const repeat = iconButton(s.musicRepeat === 'one' ? 'repeatOne' : 'repeat', REPEAT_LABEL[s.musicRepeat], () =>
        set({ musicRepeat: nextRepeat(s.musicRepeat) }),
      );
      repeat.setAttribute('aria-pressed', String(s.musicRepeat !== 'off'));
      repeat.dataset.action = 'music-repeat';
      repeat.dataset.repeat = s.musicRepeat;
      const play = iconButton(
        s.musicPaused ? 'play' : 'pause',
        s.musicPaused ? 'Play' : 'Pause',
        () => music.toggle(),
        {
          variant: 'gold',
          class: 'mp-play',
          attrs: { 'data-action': 'music-toggle' },
        },
      );
      play.dataset.state = s.musicPaused ? 'paused' : 'playing';
      const mute = iconButton(s.musicMuted ? 'mute' : 'volume', s.musicMuted ? 'Unmute music' : 'Mute music', () =>
        set({ musicMuted: !s.musicMuted }),
      );
      mute.setAttribute('aria-pressed', String(s.musicMuted));
      mute.dataset.action = 'music-mute';
      el.replaceChildren(
        shuffle,
        iconButton('prev', 'Previous track', () => music.previous(), { attrs: { 'data-action': 'music-prev' } }),
        play,
        iconButton('next', 'Next track', () => music.next(), { attrs: { 'data-action': 'music-next' } }),
        repeat,
        mute,
      );
    },
  );
}

/** Category chips and the tracks of the chosen playlist (paged, never scrolled). */
function library(): HTMLElement {
  let pager: (HTMLElement & { destroy?: () => void }) | null = null;
  return live(
    h('div', { class: 'mp-library' }),
    (s) => `${s.settings.musicCategory}|${s.settings.musicTrack}`,
    (el) => {
      const s = store.state.settings;
      const cat = s.musicCategory as MusicCategoryId | 'all';
      const chips = h(
        'div',
        { class: 'mp-categories', role: 'radiogroup', 'aria-label': 'Playlist' },
        ...[{ id: 'all', title: 'All music' }, ...MUSIC_CATEGORIES].map((c) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              class: `chip${c.id === cat ? ' active' : ''}`,
              'aria-checked': String(c.id === cat),
              'data-category': c.id,
              onclick: () => {
                audio.play('tap');
                music.setCategory(c.id);
              },
            },
            c.title,
          ),
        ),
      );
      const tracks = tracksIn(cat);
      pager?.destroy?.();
      pager = paginatorPanel({
        items: tracks,
        minTileWidth: 180,
        minTileHeight: 46,
        maxTileHeight: 56,
        gap: 6,
        label: 'Music tracks',
        initialIndex: Math.max(
          0,
          tracks.findIndex((t) => t.id === s.musicTrack),
        ),
        render: (t) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(t.id === s.musicTrack),
              class: `track${t.id === s.musicTrack ? ' active' : ''}`,
              'data-track': t.id,
              onclick: () => {
                audio.play('tap');
                music.select(t.id);
              },
            },
            icon(t.id === s.musicTrack ? 'music' : 'play'),
            h('span', null, h('strong', null, t.title), h('small', null, t.mood)),
          ),
      });
      pager.classList.add('mp-tracks');
      el.replaceChildren(chips, pager);
    },
  );
}

/** The full music player: now playing, transport, volume and the library. */
export function musicPlayer(opts: { library?: boolean } = {}): HTMLElement {
  return h(
    'div',
    { class: 'music-player', 'data-music-player': '' },
    h(
      'div',
      { class: 'mp-main' },
      nowPlaying(),
      transport(),
      slider('Music volume', store.state.settings.musicVolume, (v) =>
        store.dispatch({ type: 'UPDATE_SETTINGS', patch: { musicVolume: v } }),
      ),
    ),
    opts.library === false ? null : library(),
  );
}

export function openMusicPlayer(): Promise<void> {
  return openDialog({
    title: 'Music',
    icon: 'music',
    class: 'dialog-music',
    body: musicPlayer(),
    dismissValue: undefined,
    actions: [{ label: 'Done', value: undefined }],
  });
}
