import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import type { Settings } from '@/core/types';
import { createDefaultProfile, createDefaultSelection, DEFAULT_SETTINGS } from '@/core/defaults';
import { resetAllData } from '@/storage/persistence';
import { fullscreen } from '@/utils/device';
import { audio, TRACKS } from '@/audio';
import { segmented, slider, toggle } from '../controls';
import { confirmDialog } from '../Dialog';
import { icon } from '../icons';
import { live } from '../live';
import { notify } from '../Notifications';
import { tabs } from '../Tabs';
import { button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const SettingsScreen: ScreenFactory = ({ store }) => {
  const set = (patch: Partial<Settings>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });
  const s = () => store.state.settings;
  const panel = (...children: (Node | null)[]) => h('div', { class: 'settings-panel' }, ...children);

  const trackList = () =>
    live(
      h('div', { class: 'control control-tracks', role: 'radiogroup', 'aria-label': 'Music track' }),
      (st) => st.settings.musicTrack,
      (el, current) =>
        el.replaceChildren(
          h('span', { class: 'control-label' }, 'Music track'),
          h(
            'div',
            { class: 'track-list' },
            ...TRACKS.map((t) =>
              h(
                'button',
                {
                  type: 'button',
                  role: 'radio',
                  'aria-checked': String(t.id === current),
                  class: `track${t.id === current ? ' active' : ''}`,
                  'data-track': t.id,
                  onclick: () => {
                    void audio.unlock().then(() => set({ musicTrack: t.id }));
                  },
                },
                icon(t.id === current ? 'music' : 'play'),
                h('span', null, h('strong', null, t.title), h('small', null, t.mood)),
              ),
            ),
          ),
        ),
    );

  const t = tabs([
    {
      id: 'audio',
      label: 'Audio',
      render: () =>
        panel(
          slider('Master volume', s().masterVolume, (v) => set({ masterVolume: v })),
          slider('Sound effects', s().sfxVolume, (v) => set({ sfxVolume: v })),
          toggle('Mute all', s().muted, (v) => set({ muted: v })),
          button('Test sound', () => audio.play('chime'), { variant: 'secondary', sfx: null, icon: 'music' }),
        ),
    },
    {
      id: 'music',
      label: 'Music',
      render: () =>
        panel(
          slider('Music volume', s().musicVolume, (v) => set({ musicVolume: v })),
          trackList(),
        ),
    },
    {
      id: 'display',
      label: 'Display',
      render: () =>
        panel(
          segmented(
            'Parlor lighting',
            [
              { value: 'auto', label: 'Auto' },
              { value: 'day', label: 'Day' },
              { value: 'night', label: 'Night' },
            ],
            s().theme,
            (v) => set({ theme: v }),
          ),
          toggle(
            'Reduced motion',
            s().reducedMotion,
            (v) => set({ reducedMotion: v }),
            'Minimize animations and transitions',
          ),
          segmented(
            'Card animation speed',
            [
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ],
            s().cardAnimationSpeed,
            (v) => set({ cardAnimationSpeed: v }),
          ),
          fullscreen.supported()
            ? live(
                toggle('Fullscreen', store.state.fullscreen, () => void fullscreen.toggle(), 'Also: F key'),
                (st) => st.fullscreen,
                (el, on) => {
                  const input = el.querySelector('input');
                  if (input) input.checked = on;
                },
              )
            : null,
        ),
    },
    {
      id: 'gameplay',
      label: 'Gameplay',
      render: () =>
        panel(
          toggle('Left-handed layout', s().leftHanded, (v) => set({ leftHanded: v }), 'Mirror stock and controls'),
          toggle('Show hints', s().showHints, (v) => set({ showHints: v })),
          toggle(
            'Auto-complete',
            s().autoComplete,
            (v) => set({ autoComplete: v }),
            'Finish solved solitaire games automatically',
          ),
        ),
    },
    {
      id: 'data',
      label: 'Data',
      render: () =>
        panel(
          toggle(
            'On-device analytics',
            s().analyticsEnabled,
            (v) => set({ analyticsEnabled: v }),
            'Stored locally only, never sent anywhere',
          ),
          button(
            'Reset all progress',
            async () => {
              const ok = await confirmDialog({
                title: 'Reset all progress?',
                message:
                  'Your level, credits, collection, statistics and settings will be erased. This cannot be undone.',
                confirmLabel: 'Erase everything',
                cancelLabel: 'Keep my progress',
                danger: true,
              });
              if (!ok) return;
              await resetAllData();
              store.dispatch({
                type: 'HYDRATE',
                settings: { ...DEFAULT_SETTINGS },
                profile: createDefaultProfile(),
                selection: createDefaultSelection(),
              });
              notify('The parlor has been swept clean. Welcome back!', { kind: 'success' });
              navigate(AppState.MAIN_MENU);
            },
            { variant: 'danger', attrs: { 'data-action': 'reset' } },
          ),
          h(
            'p',
            { class: 'about' },
            `${APP.name} v${APP.version} · ${APP.developer} · `,
            h('a', { href: APP.website, target: '_blank', rel: 'noopener' }, APP.websiteLabel),
          ),
        ),
    },
  ]);

  return { el: screenFrame({ title: 'Settings', body: t.el }), unmount: t.destroy };
};
