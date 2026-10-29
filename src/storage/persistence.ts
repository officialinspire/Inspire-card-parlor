import type { Store } from '@/core/store';
import type { Profile, Selection, Settings } from '@/core/types';
import { debounce } from '@/utils/timing';
import { local } from './local';
import { idb, STORES } from './idb';

const SETTINGS_KEY = 'settings';
const PROFILE_KEY = 'profile';
const SELECTION_KEY = 'selection';

type StoredProfile = Partial<Profile> & { coins?: number };

/** Upgrades profiles saved by older builds. */
export function migrateProfile(raw: StoredProfile): Partial<Profile> {
  const { coins, ...rest } = raw;
  if (rest.credits == null && typeof coins === 'number') rest.credits = coins;
  return rest;
}

/** Loads saved settings/profile/selection into the store and keeps them saved. */
export function attachPersistence(store: Store): void {
  const { gameId, deckId, boardId, byGame, artVariants, cardBack } = local.get<Partial<Selection>>(SELECTION_KEY, {});
  store.dispatch({
    type: 'HYDRATE',
    settings: local.get<Partial<Settings>>(SETTINGS_KEY, {}),
    profile: migrateProfile(local.get<StoredProfile>(PROFILE_KEY, {})),
    selection: {
      ...(gameId ? { gameId } : {}),
      ...(deckId ? { deckId } : {}),
      ...(boardId ? { boardId } : {}),
      ...(byGame ? { byGame } : {}),
      ...(artVariants ? { artVariants } : {}),
      ...(cardBack !== undefined ? { cardBack } : {}),
    },
  });

  const writeSettings = () => local.set(SETTINGS_KEY, store.state.settings);
  const writeProfile = () => local.set(PROFILE_KEY, store.state.profile);
  const writeSelection = () => {
    const { gameId, deckId, boardId, byGame, artVariants, cardBack } = store.state.selection;
    local.set(SELECTION_KEY, { gameId, deckId, boardId, byGame, artVariants, cardBack });
  };
  store.select((s) => s.settings, debounce(writeSettings, 250));
  store.select((s) => s.profile, debounce(writeProfile, 250));
  store.select((s) => s.selection, debounce(writeSelection, 250));
  // Saves are batched; write everything at once if the page is hidden or closed mid-batch.
  if (typeof addEventListener === 'function') {
    const flush = () => {
      writeSettings();
      writeProfile();
      writeSelection();
    };
    addEventListener('pagehide', flush);
    addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }
}

export async function resetAllData(): Promise<void> {
  local.clearAll();
  await Promise.all(STORES.map((s) => idb.clear(s)));
}
