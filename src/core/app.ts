import { h } from '@/utils/dom';
import { fullscreen, getOrientation, trackViewport } from '@/utils/device';
import { attachPersistence } from '@/storage/persistence';
import { attachAchievements, evaluateAchievements } from '@/achievements/engine';
import { attachJournalTracking } from '@/achievements/tracking';
import { attachAnnouncer } from '@/progression/announcer';
import { attachAudio, audio } from '@/audio';
import { ambienceState, attachAmbience } from '@/audio/ambience';
import { setGameHaptics } from '@/audio/gameSounds';
import { haptic } from '@/utils/haptics';
import { attachAnalytics, track } from '@/analytics/analytics';
import { attachProductAnalytics } from '@/analytics/productEvents';
import { recentEvents } from '@/analytics/posthog';
import { attachInstallPrompt } from '@/utils/install';
import { attachTheme } from '@/themes/theme';
import { assetManager, attachDeckThemes } from '@/decks';
import { ScreenManager } from '@/components/ScreenManager';
import { attachDialogs, confirmDialog } from '@/components/Dialog';
import { attachNotifications } from '@/components/Notifications';
import { SCREENS } from '@/components/screens';
import { AppState } from './states';
import { goBack, navigate, store } from './store';
import { runBoot } from './boot';
import { attachBrowserBack } from './browserBack';
import { loadStoryArt } from '@/story/art';
import { attachStoryDirector } from '@/audio/director';
import { setActiveStoryLevel } from '@/story/session';
import { recordGameResult } from '@/progression/results';
import { ALL_LEVELS } from '@/story/campaign';
import { APP } from './config';
import { attachErrorHandling, errorLog } from './errors';
import { onStorageHealth } from '@/storage/health';
import { notify } from '@/components/Notifications';
import { liveCount } from '@/components/live';

/** BOOT: wire every subsystem to the store, build the shell, then start loading. */
export async function startApp(mount: HTMLElement): Promise<void> {
  attachPersistence(store);
  // Progression: toasts, achievements and the journal. Progress earned before this
  // version (or while offline) unlocks quietly, summarized in one toast.
  attachAnnouncer(store);
  attachAchievements(store);
  attachJournalTracking(store);
  evaluateAchievements(store, { silent: true });
  attachDeckThemes(store);
  attachTheme(store);
  attachAudio(store);
  attachAmbience(store);
  attachStoryDirector(store);
  setGameHaptics((kind) => haptic(kind));
  attachAnalytics(store);
  attachProductAnalytics(store);
  attachInstallPrompt();

  trackViewport(() => store.dispatch({ type: 'SET_ORIENTATION', orientation: getOrientation() }));
  store.dispatch({ type: 'SET_ONLINE', online: navigator.onLine });
  addEventListener('online', () => store.dispatch({ type: 'SET_ONLINE', online: true }));
  addEventListener('offline', () => store.dispatch({ type: 'SET_ONLINE', online: false }));
  for (const type of ['fullscreenchange', 'webkitfullscreenchange'])
    document.addEventListener(type, () => store.dispatch({ type: 'SET_FULLSCREEN', fullscreen: fullscreen.active() }));

  const stage = h('main', { class: 'stage' });
  mount.replaceChildren(stage);
  new ScreenManager(stage, store, SCREENS);
  attachDialogs(mount, store);
  attachNotifications(mount, store);
  attachBrowserBack(store);

  addEventListener('keydown', (e) => {
    if (store.state.modals.length || e.metaKey || e.ctrlKey || e.altKey) return;
    const s = store.state.screen;
    // Escape / Backspace act as "back" everywhere except the hub and splash.
    if ((e.key === 'Escape' || e.key === 'Backspace') && s !== AppState.MAIN_MENU && s !== AppState.INITIALIZATION) {
      // Gameplay owns its own back (it asks before leaving the table); Story Mode steps back
      // through its own views (journal → chapter → map) before leaving.
      if (s === AppState.GAMEPLAY || s === AppState.STORY_MODE)
        document.querySelector<HTMLElement>('.screen:not([aria-hidden]) [data-nav="back"]')?.click();
      else goBack();
    }
    if (e.key === 'f' || e.key === 'F') void fullscreen.toggle();
  });

  // Double-tap zoom stays off (it fights card taps); pinch zoom stays available for anyone
  // who needs larger text. The card tables opt out of browser gestures themselves.
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  attachErrorHandling(stage);
  // Saving: tell the player once when the device stops keeping progress, and when it recovers.
  onStorageHealth((area, ok) => {
    if (ok) notify('Saving works again.', { kind: 'success', sound: false });
    else
      notify(
        area === 'games'
          ? 'This game can’t be saved on this device right now (storage is full or blocked). You can keep playing; finish before closing the tab.'
          : 'Your progress can’t be saved on this device right now (storage is full or blocked, e.g. a private window). You can keep playing, but it may not be kept after you close the tab.',
        { kind: 'warning', duration: 9000, title: 'Not saving' },
      );
  });

  track('boot', { version: APP.version });
  // Card faces wait for the opening to finish loading (the title shows only backs).
  let opened!: () => void;
  assetManager.deferFacesUntil(new Promise<void>((r) => (opened = r)));
  navigate(AppState.INITIALIZATION);
  // Story artwork is decorative: fetch its small manifest once the browser is idle (Story Mode
  // also asks for it when opened), never during boot work. No image is decoded until shown.
  const idle = (fn: () => void) =>
    'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500);
  idle(() => void loadStoryArt());
  try {
    await runBoot(store);
  } finally {
    opened();
  }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // A new worker does not replace JavaScript already running in this tab.
    // Keep play uninterrupted until the player chooses to reload; normal
    // pagehide persistence flushes progress/settings without clearing saves.
    let hadController = !!navigator.serviceWorker.controller;
    let updateOffered = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!navigator.serviceWorker.controller) return;
      if (!hadController) {
        hadController = true;
        return;
      }
      if (updateOffered) return;
      updateOffered = true;
      void confirmDialog({
        title: 'Update available',
        message:
          'A new version is ready. Reload to use it, or keep playing and update later. Your saved progress and settings are kept.',
        confirmLabel: 'Reload',
        cancelLabel: 'Later',
      }).then((reload) => {
        if (reload) location.reload();
      });
    });
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err: unknown) => {
      console.warn('[offline] service worker not registered:', err);
    });
  }

  // Expose the store for debugging and end-to-end tests.
  Object.assign(window, {
    __ICP__: {
      store,
      navigate,
      // Product events captured this session (what would be sent to PostHog).
      analytics: recentEvents,
      // The music engine's state (track, voices still sounding) for audio tests.
      audio: () => ({ track: audio.track.id, playing: audio.playing, voices: audio.voiceCount }),
      // Uncaught errors and rejected promises seen this session (none are swallowed).
      errors: () => ({ ...errorLog }),
      // Live widgets still subscribed to the store (must stay bounded: screens let go when they leave).
      liveWidgets: liveCount,
      // The riverfront ambience: scene, level, instances (live + fading), loop sources, timers.
      ambience: ambienceState,
      // The audio context's state ('running', 'suspended'…), or null before the first gesture.
      audioContext: () => audio.contextState,
      // Records a finished story game (as if played), so tests can reach any result screen.
      storyResult: (levelId: string, outcome: 'win' | 'loss') => {
        const level = ALL_LEVELS.find((l) => l.id === levelId);
        if (!level) return;
        setActiveStoryLevel(levelId);
        recordGameResult(store, {
          gameId: level.game,
          outcome,
          durationMs: 60_000,
          score: outcome === 'win' && level.game === 'go-fish' ? 7 : 0,
          details: level.game === 'go-fish' ? { books: outcome === 'win' ? 7 : 0 } : {},
        });
        setActiveStoryLevel(null);
      },
      // The campaign's challenges, so tests can launch each one.
      story: ALL_LEVELS.map((l) => ({
        id: l.id,
        game: l.game,
        deck: l.setup.deckId,
        board: l.setup.boardId,
        seeded: l.setup.seed !== undefined,
      })),
    },
  });
}
