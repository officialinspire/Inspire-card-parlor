import type { Store } from '@/core/store';
import type { Profile, Selection, Settings } from '@/core/types';
import { debounce } from '@/utils/timing';
import { PROFILE_SCHEMA } from '@/core/defaults';
import { local } from './local';
import { idb, STORES } from './idb';

const SETTINGS_KEY = 'settings';
const PROFILE_KEY = 'profile';
const SELECTION_KEY = 'selection';

type StoredProfile = Partial<Profile> & { coins?: number };

const LIST_FIELDS = [
  'unlockedDecks',
  'unlockedBoards',
  'unlockedAchievements',
  'ownedVariants',
  'favoriteDecks',
] as const;

/**
 * Upgrades profiles saved by older builds. Never drops progress: unknown
 * fields pass through, lists are de-duplicated (so nothing can be counted
 * twice), malformed values are left for the defaults to fill, and the
 * result is stamped with the current schema version.
 */
export function migrateProfile(raw: StoredProfile): Partial<Profile> {
  const { coins, ...rest } = raw;
  if (rest.credits == null && typeof coins === 'number') rest.credits = coins;
  for (const key of LIST_FIELDS) {
    const v = rest[key] as unknown;
    if (v === undefined) continue;
    if (Array.isArray(v)) rest[key] = [...new Set(v.filter((x): x is string => typeof x === 'string'))];
    else delete rest[key];
  }
  if (rest.achievementDates !== undefined && (typeof rest.achievementDates !== 'object' || !rest.achievementDates))
    delete rest.achievementDates;
  const version = typeof rest.schemaVersion === 'number' ? rest.schemaVersion : 1;
  if (version < 2 && Object.keys(raw).length) {
    // v1 → v2: achievements gained dates and the journal. Earlier unlocks keep no date
    // (shown as "earned before dates were kept"); a returning player has visited.
    rest.journal = { counters: { visits: 1, ...rest.journal?.counters }, seen: { ...rest.journal?.seen } };
  }
  rest.schemaVersion = Math.max(version, PROFILE_SCHEMA);
  return rest;
}

/** Loads saved settings/profile/selection into the store and keeps them saved. */
export function attachPersistence(store: Store): void {
  const { gameId, deckId, boardId, byGame, artVariants, cardBack } = local.get<Partial<Selection>>(SELECTION_KEY, {});
  const rawProfile = local.get<StoredProfile>(PROFILE_KEY, {});
  // Keep a copy of a save from an older version before upgrading it.
  if (Object.keys(rawProfile).length && (rawProfile.schemaVersion ?? 1) < PROFILE_SCHEMA)
    local.set(`${PROFILE_KEY}-backup-v${rawProfile.schemaVersion ?? 1}`, rawProfile);
  store.dispatch({
    type: 'HYDRATE',
    settings: local.get<Partial<Settings>>(SETTINGS_KEY, {}),
    profile: migrateProfile(rawProfile),
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
