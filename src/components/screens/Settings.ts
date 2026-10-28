import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import type { Settings } from '@/core/types';
import { createDefaultProfile, DEFAULT_SETTINGS } from '@/core/defaults';
import { resetAllData } from '@/storage/persistence';
import { fullscreen } from '@/utils/device';
import { audio } from '@/audio';
import { segmented, slider, toggle } from '../controls';
import { tabs } from '../Tabs';
import { button, screenFrame } from '../ui';
import { showModal } from '../Modal';
import type { ScreenFactory } from '../Screen';

export const SettingsScreen: ScreenFactory = ({ store }) => {
  const set = (patch: Partial<Settings>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });
  const s = () => store.state.settings;
  const panel = (...children: (Node | null)[]) => h('div', { class: 'settings-panel' }, ...children);

  const t = tabs([
    {
      id: 'audio',
      label: 'Audio',
      icon: '♪',
      render: () =>
        panel(
          slider('Master volume', s().masterVolume, (v) => set({ masterVolume: v })),
          slider('Music', s().musicVolume, (v) => set({ musicVolume: v })),
          slider('Sound effects', s().sfxVolume, (v) => set({ sfxVolume: v })),
          toggle('Mute all', s().muted, (v) => set({ muted: v })),
          button('Test sound', () => audio.play('chime'), { variant: 'ghost', sfx: null }),
        ),
    },
    {
      id: 'display',
      label: 'Display',
      icon: '◐',
      render: () =>
        panel(
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
            ? button('Toggle fullscreen', () => void fullscreen.toggle(), { variant: 'ghost' })
            : null,
        ),
    },
    {
      id: 'gameplay',
      label: 'Gameplay',
      icon: '♠',
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
      icon: '⛁',
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
              if (!confirm('Erase all progress, collection and settings? This cannot be undone.')) return;
              await resetAllData();
              store.dispatch({ type: 'HYDRATE', settings: { ...DEFAULT_SETTINGS }, profile: createDefaultProfile() });
              showModal(store, 'Progress reset', 'The parlor has been swept clean. Welcome back!');
              navigate(AppState.MAIN_MENU);
            },
            { variant: 'ghost', class: 'btn-danger' },
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
