import type { Store } from '@/core/store';
import { createInitialState, reduce } from '@/core/store';
import { GAME_IDS, createDefaultProfile, createDefaultSelection, DEFAULT_SETTINGS } from '@/core/defaults';
import type { Profile, Selection, Settings } from '@/core/types';
import { Table, validateSnapshot, type TableSnapshot } from '@/engine/Table';
import { KlondikeGame } from '@/games/solitaire/KlondikeGame';
import { SpiderGame } from '@/games/solitaire/SpiderGame';
import { FreeCellGame } from '@/games/solitaire/FreeCellGame';
import { WarGame } from '@/games/war/WarGame';
import { GoFishGame } from '@/games/goFish/GoFishGame';
import { idb } from './idb';
import { local } from './local';
import { migrateProfile } from './persistence';

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export interface ParlorBackup {
  format: 'inspire-card-parlor';
  version: 1;
  exportedAt: string;
  profile: Profile;
  settings: Settings;
  selection: Selection;
  saves: Record<string, TableSnapshot>;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function invalid(): never {
  throw new Error('This is not a supported Card Parlor save file.');
}

/** Validate before touching either storage area. Only JSON data is accepted. */
function safeJson(v: unknown, depth = 0): void {
  if (depth > 40) invalid();
  if (typeof v === 'number' && !Number.isFinite(v)) invalid();
  if (v && typeof v === 'object') {
    for (const [k, value] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) invalid();
      safeJson(value, depth + 1);
    }
  }
}
function shape(v: unknown, model: unknown): void {
  if (model === null) {
    if (v !== null && typeof v !== 'number' && typeof v !== 'string') invalid();
    return;
  }
  if (Array.isArray(model)) {
    if (!Array.isArray(v)) invalid();
    if (model.length) for (const x of v) shape(x, model[0]);
    return;
  }
  if (object(model)) {
    if (!object(v)) invalid();
    for (const [k, value] of Object.entries(model)) {
      if (!(k in v)) invalid();
      shape(v[k], value);
    }
    return;
  }
  if (typeof v !== typeof model) invalid();
}
const stringList = (v: unknown) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) invalid();
};
const numberMap = (v: unknown) => {
  if (!object(v) || Object.values(v).some((x) => typeof x !== 'number' || x < 0)) invalid();
};

export function parseBackup(text: string): ParlorBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('Save file is too large (maximum 5 MB).');
  const b = JSON.parse(text) as ParlorBackup;
  safeJson(b);
  if (!object(b) || b.format !== 'inspire-card-parlor' || b.version !== 1 || !object(b.saves)) invalid();
  shape(b.profile, createDefaultProfile());
  shape(b.settings, DEFAULT_SETTINGS);
  shape(b.selection, createDefaultSelection());
  if (b.profile.schemaVersion > createDefaultProfile().schemaVersion)
    throw new Error('Update the parlor before importing this newer save.');
  if (b.selection.gameId !== null && !GAME_IDS.includes(b.selection.gameId)) invalid();
  if (b.selection.cardBack !== null && typeof b.selection.cardBack !== 'string') invalid();
  for (const key of [
    'unlockedDecks',
    'unlockedBoards',
    'unlockedAchievements',
    'favoriteDecks',
    'ownedVariants',
  ] as const)
    stringList(b.profile[key]);
  for (const key of ['completed', 'rewarded', 'stamps', 'introsSeen', 'evidence'] as const)
    stringList(b.profile.story[key] ?? []);
  numberMap(b.profile.achievementDates);
  numberMap(b.profile.story.attempts);
  numberMap(b.profile.journal.counters);
  for (const list of Object.values(b.profile.journal.seen)) stringList(list);
  for (const choice of Object.values(b.selection.byGame)) shape(choice, { deckId: '', boardId: '' });
  if (Object.values(b.selection.artVariants).some((v) => typeof v !== 'string')) invalid();
  const enums: Partial<Record<keyof Settings, readonly unknown[]>> = {
    theme: ['auto', 'day', 'night'],
    startupIntro: ['auto', 'full', 'brief'],
    cardAnimationSpeed: ['slow', 'normal', 'fast'],
    warSpeed: ['slow', 'normal', 'fast', 'instant'],
    musicRepeat: ['all', 'one', 'off'],
    cpuDifficulty: ['easy', 'normal', 'hard'],
    goFishOpponents: [1, 2, 3],
    klondikeDraw: [1, 3],
    spiderSuits: [1, 2, 4],
  };
  for (const [key, values] of Object.entries(enums)) if (!values.includes(b.settings[key as keyof Settings])) invalid();
  for (const [key, snap] of Object.entries(b.saves)) {
    if (!/^(klondike|spider|freecell|war|go-fish)\/(current|story)$/.test(key) || key.split('/')[0] !== snap.gameId)
      invalid();
    validateSnapshot(snap);
    if (!Array.isArray(snap.history) || !object(snap.data)) invalid();
    const reference =
      snap.gameId === 'klondike'
        ? KlondikeGame.create().table
        : snap.gameId === 'spider'
          ? SpiderGame.create().table
          : snap.gameId === 'freecell'
            ? FreeCellGame.create().table
            : snap.gameId === 'war'
              ? WarGame.create().table
              : GoFishGame.create({
                  players: [
                    { id: 'you', name: 'You' },
                    { id: 'friendly_local', name: 'Local', cpu: 'friendly_local' },
                  ],
                }).table;
    if (snap.cardCount !== reference.cardCount) invalid();
    // Logs are tagged unions: their first event may differ between valid games.
    if (snap.gameId === 'go-fish') reference.data.log = [];
    shape(snap.data, reference.data);
    const table = Table.restore(snap);
    if (snap.gameId === 'go-fish') {
      const game = GoFishGame.restore(table);
      if (game.players.length < 2 || game.players.length > 4 || !game.current || game.players[0]?.id !== 'you')
        invalid();
      if (new Set(game.players.map((p) => p.id)).size !== game.players.length) invalid();
      if (table.piles.get('pond')?.kind !== 'pond') invalid();
      for (const p of game.players) {
        if (table.piles.get(`hand:${p.id}`)?.kind !== 'hand' || table.piles.get(`books:${p.id}`)?.kind !== 'book')
          invalid();
      }
    } else {
      for (const p of reference.piles.values()) if (table.piles.get(p.id)?.kind !== p.kind) invalid();
    }
    for (const field of ['hints', 'undos'])
      if (snap.data[field] !== undefined && (typeof snap.data[field] !== 'number' || Number(snap.data[field]) < 0))
        invalid();
  }
  b.profile = { ...createDefaultProfile(), ...migrateProfile(b.profile) };
  b.selection.storyChapterId = b.selection.storyLevelId = null;
  return b;
}

export async function exportBackup(store: Store): Promise<ParlorBackup> {
  if (!(await idb.ready())) throw new Error('Game storage is unavailable. Enable browser storage to export saves.');
  const saves: Record<string, TableSnapshot> = {};
  for (const key of (await idb.keys('saves')) ?? []) {
    const snap = await idb.get<TableSnapshot>('saves', key);
    if (snap) saves[String(key)] = snap;
  }
  return {
    format: 'inspire-card-parlor',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: structuredClone(store.state.profile),
    settings: { ...store.state.settings },
    selection: { ...structuredClone(store.state.selection), storyChapterId: null, storyLevelId: null },
    saves,
  };
}

/** The saves transaction commits before the in-memory profile is replaced. */
export async function importBackup(store: Store, backup: ParlorBackup): Promise<void> {
  const b = parseBackup(JSON.stringify(backup));
  const state = reduce(createInitialState(), {
    type: 'HYDRATE',
    profile: b.profile,
    settings: b.settings,
    selection: b.selection,
  });
  // Device preferences that must not be transferred with somebody else's file.
  state.settings.analyticsEnabled = store.state.settings.analyticsEnabled;
  state.settings.ageVerified = store.state.settings.ageVerified;
  state.settings.matureContent = store.state.settings.matureContent;
  await idb.replaceSaves(b.saves);
  store.dispatch({
    type: 'RESTORE_BACKUP',
    profile: state.profile,
    settings: state.settings,
    selection: state.selection,
  });
  const ok = [
    local.set('profile', state.profile),
    local.set('settings', state.settings),
    local.set('selection', state.selection),
  ].every(Boolean);
  if (!ok)
    throw new Error(
      'Save loaded for this session, but browser storage could not keep the profile. Keep your backup file.',
    );
}
