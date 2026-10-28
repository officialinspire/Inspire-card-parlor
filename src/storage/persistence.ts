import type { Store } from '@/core/store';
import type { Profile, Settings } from '@/core/types';
import { debounce } from '@/utils/timing';
import { local } from './local';
import { idb, STORES } from './idb';

const SETTINGS_KEY = 'settings';
const PROFILE_KEY = 'profile';

/** Loads saved settings/profile into the store and keeps them saved. */
export function attachPersistence(store: Store): void {
  store.dispatch({
    type: 'HYDRATE',
    settings: local.get<Partial<Settings>>(SETTINGS_KEY, {}),
    profile: local.get<Partial<Profile>>(PROFILE_KEY, {}),
  });

  const saveSettings = debounce(() => local.set(SETTINGS_KEY, store.state.settings), 250);
  const saveProfile = debounce(() => local.set(PROFILE_KEY, store.state.profile), 250);
  store.select((s) => s.settings, saveSettings);
  store.select((s) => s.profile, saveProfile);
}

export async function resetAllData(): Promise<void> {
  local.clearAll();
  await Promise.all(STORES.map((s) => idb.clear(s)));
}
