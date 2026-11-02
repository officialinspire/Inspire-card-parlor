import { h } from '@/utils/dom';
import { APP } from '@/core/config';
import { AppState } from '@/core/states';
import { navigate } from '@/core/store';
import type { Settings } from '@/core/types';
import { createDefaultProfile, createDefaultSelection, DEFAULT_SETTINGS } from '@/core/defaults';
import { resetAllData } from '@/storage/persistence';
import { fullscreen } from '@/utils/device';
import { haptic, hapticsSupported } from '@/utils/haptics';
import { analyticsConfigured } from '@/analytics/posthog';
import { canInstall, promptInstall } from '@/utils/install';
import { audio } from '@/audio';
import { musicPlayer } from '../musicPlayer';
import { segmented, slider, toggle } from '../controls';
import { confirmDialog } from '../Dialog';
import { live } from '../live';
import { notify } from '../Notifications';
import { tabs } from '../Tabs';
import { FEATURES } from '@/core/config';
import { ageGate, ageGateLocked } from '../AgeGate';
import { openDialog } from '../Dialog';
import { deckThemes, visibleBoards } from '@/decks';
import { artistCredit } from './Collection';
import { button, screenFrame } from '../ui';
import type { ScreenFactory } from '../Screen';

export const SettingsScreen: ScreenFactory = ({ store }) => {
  const set = (patch: Partial<Settings>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });
  const s = () => store.state.settings;
  const tagged = (el: HTMLElement, setting: string) => {
    el.dataset.setting = setting;
    return el;
  };
  const panel = (...children: (Node | null)[]) => h('div', { class: 'settings-panel' }, ...children);

  /** Every deck and board with its artist credit (adult decks only when enabled). */
  const showCredits = () => {
    store.dispatch({ type: 'JOURNAL', update: { add: { 'credits.viewed': 1 } } });
    return openDialog({
      title: 'Artwork credits',
      icon: 'star',
      class: 'dialog-wide',
      body: h(
        'dl',
        { class: 'credits', 'data-credits': '' },
        ...[...deckThemes.list(), ...visibleBoards()].flatMap((item) => [
          h('dt', null, item.name),
          h('dd', null, artistCredit(item.artist)),
        ]),
      ),
      dismissValue: undefined,
      actions: [{ label: 'Close', value: undefined }],
    });
  };

  const t = tabs([
    {
      id: 'audio',
      label: 'Audio',
      render: () =>
        panel(
          slider('Master volume', s().masterVolume, (v) => set({ masterVolume: v })),
          slider('Sound effects', s().sfxVolume, (v) => set({ sfxVolume: v })),
          tagged(
            toggle(
              'Riverfront ambience',
              s().ambience,
              (v) => set({ ambience: v }),
              'Water, breeze and the town at night, behind the menu. Separate from the music.',
            ),
            'ambience',
          ),
          tagged(
            slider('Ambience volume', s().ambienceVolume, (v) => set({ ambienceVolume: v })),
            'ambienceVolume',
          ),
          toggle('Mute all', s().muted, (v) => set({ muted: v })),
          tagged(
            toggle(
              'Haptic feedback',
              s().haptics,
              (v) => {
                set({ haptics: v });
                if (v) haptic('success', true);
              },
              hapticsSupported() ? 'Gentle vibrations for wins, wars and mistakes.' : 'Not supported on this device.',
            ),
            'haptics',
          ),
          tagged(
            toggle(
              'Story soundtrack',
              s().storySoundtrack,
              (v) => set({ storySoundtrack: v }),
              'Story Mode chooses music for each place; picking a track yourself always wins',
            ),
            'storySoundtrack',
          ),
          button('Test sound', () => audio.play('chime'), { variant: 'secondary', sfx: null, icon: 'music' }),
        ),
    },
    {
      id: 'music',
      label: 'Music',
      render: () => h('div', { class: 'settings-panel settings-music' }, musicPlayer()),
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
          tagged(
            segmented(
              'Startup intro',
              [
                { value: 'auto', label: 'Auto' },
                { value: 'full', label: 'Full' },
                { value: 'brief', label: 'Brief' },
              ],
              s().startupIntro,
              (v) => set({ startupIntro: v }),
            ),
            'startupIntro',
          ),
          toggle(
            'Reduced motion',
            s().reducedMotion,
            (v) => set({ reducedMotion: v }),
            'Minimize animations and transitions',
          ),
          tagged(
            toggle(
              'Low effects',
              s().lowEffects,
              (v) => set({ lowEffects: v }),
              'No story particles or glows — smoother on older phones',
            ),
            'lowEffects',
          ),
          tagged(
            toggle(
              'Ambient table animation',
              s().ambientAnimations,
              (v) => set({ ambientAnimations: v }),
              'Leaves, steam, rain… on gameboards',
            ),
            'ambientAnimations',
          ),
          tagged(
            toggle(
              'High-contrast tables',
              s().highContrastTable,
              (v) => set({ highContrastTable: v }),
              'Shade busy boards so cards stand out',
            ),
            'highContrastTable',
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
      id: 'content',
      label: 'Content',
      render: () => {
        const placeholder = toggle(
          'Placeholder artwork',
          s().placeholderArt,
          (v) => set({ placeholderArt: v }),
          'Show the sprite-sheet template for decks whose artwork is not uploaded yet',
        );
        placeholder.dataset.setting = 'placeholderArt';
        if (!FEATURES.matureContent) {
          return panel(
            h(
              'p',
              { class: 'control edition-note', 'data-edition': 'public' },
              'Adult-only decks are not available in this edition.',
            ),
            placeholder,
          );
        }
        const mature = toggle(
          'Mature decks (18+)',
          s().matureContent && s().ageVerified,
          async (on) => {
            const input = mature.querySelector('input')!;
            if (!on) {
              set({ matureContent: false });
              notify('Mature decks are hidden again.', { kind: 'info' });
              return;
            }
            const ok = s().ageVerified || (await ageGate());
            if (!ok) {
              input.checked = false;
              notify(ageGateLocked() ? 'Mature decks are only available to adults.' : 'Mature decks stay hidden.', {
                kind: 'info',
              });
              return;
            }
            set({ matureContent: true, ageVerified: true });
            notify('Mature decks are now in your collection.', { kind: 'success' });
          },
          'Off by default. Requires an age check; never shown in ordinary previews.',
        );
        mature.dataset.setting = 'matureContent';
        return panel(mature, placeholder);
      },
    },
    {
      id: 'data',
      label: 'Data',
      render: () =>
        panel(
          tagged(
            toggle(
              'Anonymous usage statistics',
              s().analyticsEnabled,
              (v) => set({ analyticsEnabled: v }),
              analyticsConfigured()
                ? 'Anonymous game events (no names or personal data) help improve the parlor.'
                : 'Kept on this device only.',
            ),
            'analyticsEnabled',
          ),
          canInstall()
            ? button(
                'Install the parlor',
                async (e) => {
                  const btn = e.currentTarget as HTMLElement;
                  if (await promptInstall()) btn.remove();
                },
                { variant: 'secondary', icon: 'expand', attrs: { 'data-action': 'install' } },
              )
            : null,
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
          button(
            'Repair offline files',
            async () => {
              const ok = await confirmDialog({
                title: 'Repair offline files?',
                message:
                  'The game’s offline copy will be cleared and downloaded fresh. Use this if something looks out of date or broken after an update. Your progress, collection and settings are kept.',
                confirmLabel: 'Repair and reload',
                cancelLabel: 'Cancel',
              });
              if (!ok) return;
              (window as Window & { __icpRepair?: () => void }).__icpRepair?.();
            },
            { variant: 'secondary', icon: 'restart', attrs: { 'data-action': 'repair-offline' } },
          ),
          button('Artwork credits', () => void showCredits(), {
            variant: 'secondary',
            attrs: { 'data-action': 'credits' },
          }),
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
