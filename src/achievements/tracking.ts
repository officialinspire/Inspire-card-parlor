import type { Store } from '@/core/store';
import type { JournalUpdate } from './journal';
import { resolveTheme } from '@/themes/theme';
import { getTrack } from '@/audio/tracks';

/**
 * Notes what the player explores (screens, lighting, music, full screen,
 * card backs) and lifetime credits earned, into the journal. Updates are
 * batched and written after the current dispatch.
 */
export function attachJournalTracking(store: Store): void {
  let pending: JournalUpdate[] = [];
  const note = (u: JournalUpdate) => {
    if (!pending.length)
      queueMicrotask(() => {
        const batch = pending;
        pending = [];
        for (const update of batch) store.dispatch({ type: 'JOURNAL', update });
      });
    pending.push(u);
  };

  const hearing = () => {
    const s = store.state.settings;
    if (s.musicPaused || !store.state.boot.ready || store.state.screen === 'INITIALIZATION') return;
    const t = getTrack(s.musicTrack);
    note({ seen: { tracks: [t.id], musicCategories: [t.category] } });
  };

  store.subscribe((next, prev, action) => {
    if (next.screen !== prev.screen) {
      note({ seen: { screens: [next.screen] } });
      if (prev.screen === 'INITIALIZATION') hearing();
    }
    if (next.settings.theme !== prev.settings.theme && action.type !== 'HYDRATE')
      note({ seen: { lighting: [resolveTheme(next.settings.theme)] } });
    if (
      (next.settings.musicTrack !== prev.settings.musicTrack ||
        next.settings.musicPaused !== prev.settings.musicPaused) &&
      action.type !== 'HYDRATE'
    )
      hearing();
    if (next.settings.musicShuffle && !prev.settings.musicShuffle && action.type !== 'HYDRATE')
      note({ add: { 'music.shuffle': 1 } });
    if (next.fullscreen && !prev.fullscreen) note({ add: { fullscreen: 1 } });
    if (next.selection.cardBack !== prev.selection.cardBack && next.selection.cardBack && action.type !== 'HYDRATE')
      note({ add: { 'cardBack.changed': 1 } });
    if (next.profile.credits > prev.profile.credits && action.type !== 'HYDRATE')
      note({ add: { 'credits.earned': next.profile.credits - prev.profile.credits } });
    if (next.boot.ready && !prev.boot.ready) note({ seen: { lighting: [resolveTheme(next.settings.theme)] } });
  });
}
