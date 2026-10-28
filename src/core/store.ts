import { AppState, canTransition } from './states';
import type { GameId, ModalRef, Notification, Profile, RootState, Selection, Settings } from './types';
import { createDefaultProfile, createDefaultSelection, DEFAULT_SETTINGS } from './defaults';

export type Action =
  | { type: 'NAVIGATE'; to: AppState; replace?: boolean }
  | { type: 'BACK' }
  | { type: 'BOOT_PROGRESS'; progress: number; label: string }
  | { type: 'BOOT_READY' }
  | { type: 'SELECT_GAME'; gameId: GameId }
  | { type: 'SELECT_DECK'; deckId: string }
  | { type: 'SELECT_BOARD'; boardId: string }
  | { type: 'SELECT_STORY_CHAPTER'; chapterId: string | null }
  | { type: 'START_GAME' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'UPDATE_PROFILE'; patch: Partial<Profile> }
  | { type: 'HYDRATE'; settings?: Partial<Settings>; profile?: Partial<Profile>; selection?: Partial<Selection> }
  | { type: 'MODAL_OPENED'; modal: ModalRef }
  | { type: 'MODAL_CLOSED'; id: string }
  | { type: 'NOTIFY'; notification: Notification }
  | { type: 'DISMISS_NOTIFICATION'; id: number }
  | { type: 'SET_ORIENTATION'; orientation: RootState['orientation'] }
  | { type: 'SET_FULLSCREEN'; fullscreen: boolean }
  | { type: 'SET_ONLINE'; online: boolean };

type Listener = (state: RootState, prev: RootState, action: Action) => void;

const HISTORY_LIMIT = 20;
const MAX_NOTIFICATIONS = 4;

export function createInitialState(): RootState {
  return {
    screen: AppState.BOOT,
    history: [],
    boot: { progress: 0, label: 'Waking the parlor…', ready: false },
    selection: createDefaultSelection(),
    settings: { ...DEFAULT_SETTINGS },
    profile: createDefaultProfile(),
    modals: [],
    notifications: [],
    orientation: 'portrait',
    fullscreen: false,
    online: true,
  };
}

export function reduce(state: RootState, action: Action): RootState {
  switch (action.type) {
    case 'NAVIGATE': {
      if (action.to === state.screen || !canTransition(state.screen, action.to)) return state;
      // Returning to the hub resets the trail so "back" never loops through menus.
      const history =
        action.to === AppState.MAIN_MENU
          ? []
          : action.replace
            ? state.history
            : [...state.history, state.screen].slice(-HISTORY_LIMIT);
      return { ...state, screen: action.to, history };
    }
    case 'BACK': {
      const history = [...state.history];
      let prev = history.pop();
      // Never go back into the boot/splash sequence.
      while (prev === AppState.BOOT || prev === AppState.INITIALIZATION) prev = history.pop();
      const to = prev ?? AppState.MAIN_MENU;
      if (to === state.screen) return state;
      return { ...state, screen: to, history };
    }
    case 'BOOT_PROGRESS':
      return { ...state, boot: { ...state.boot, progress: action.progress, label: action.label } };
    case 'BOOT_READY':
      return { ...state, boot: { progress: 1, label: 'Ready', ready: true } };
    case 'SELECT_GAME': {
      const remembered = state.selection.byGame[action.gameId];
      return { ...state, selection: { ...state.selection, ...remembered, gameId: action.gameId } };
    }
    case 'SELECT_DECK':
      return { ...state, selection: { ...state.selection, deckId: action.deckId } };
    case 'SELECT_BOARD':
      return { ...state, selection: { ...state.selection, boardId: action.boardId } };
    case 'SELECT_STORY_CHAPTER':
      return { ...state, selection: { ...state.selection, storyChapterId: action.chapterId } };
    case 'START_GAME': {
      const { gameId, deckId, boardId } = state.selection;
      if (!gameId) return state;
      return {
        ...state,
        selection: { ...state.selection, byGame: { ...state.selection.byGame, [gameId]: { deckId, boardId } } },
      };
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'HYDRATE':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
        profile: {
          ...state.profile,
          ...action.profile,
          stats: { ...state.profile.stats, ...action.profile?.stats },
        },
        selection: {
          ...state.selection,
          ...action.selection,
          byGame: { ...state.selection.byGame, ...action.selection?.byGame },
          storyChapterId: null,
        },
      };
    case 'MODAL_OPENED':
      return { ...state, modals: [...state.modals.filter((m) => m.id !== action.modal.id), action.modal] };
    case 'MODAL_CLOSED':
      return state.modals.some((m) => m.id === action.id)
        ? { ...state, modals: state.modals.filter((m) => m.id !== action.id) }
        : state;
    case 'NOTIFY':
      return { ...state, notifications: [...state.notifications, action.notification].slice(-MAX_NOTIFICATIONS) };
    case 'DISMISS_NOTIFICATION':
      return state.notifications.some((n) => n.id === action.id)
        ? { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) }
        : state;
    case 'SET_ORIENTATION':
      return state.orientation === action.orientation ? state : { ...state, orientation: action.orientation };
    case 'SET_FULLSCREEN':
      return state.fullscreen === action.fullscreen ? state : { ...state, fullscreen: action.fullscreen };
    case 'SET_ONLINE':
      return state.online === action.online ? state : { ...state, online: action.online };
  }
}

/**
 * Centralized, framework-free store. All state changes flow through
 * `dispatch`, and every subsystem (screens, audio, persistence, analytics)
 * observes changes through `subscribe`.
 */
export class Store {
  #state: RootState;
  #listeners = new Set<Listener>();

  constructor(initial: RootState = createInitialState()) {
    this.#state = initial;
  }

  get state(): Readonly<RootState> {
    return this.#state;
  }

  dispatch(action: Action): void {
    const prev = this.#state;
    const next = reduce(prev, action);
    if (next === prev) return;
    this.#state = next;
    for (const l of this.#listeners) l(next, prev, action);
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribe to a derived slice; fires only when the slice changes (shallow ===). */
  select<T>(selector: (s: RootState) => T, onChange: (value: T, prev: T) => void): () => void {
    let current = selector(this.#state);
    return this.subscribe((s) => {
      const value = selector(s);
      if (value !== current) {
        const prev = current;
        current = value;
        onChange(value, prev);
      }
    });
  }
}

export const store = new Store();

/** Convenience navigation helpers. */
export const navigate = (to: AppState, replace = false) => store.dispatch({ type: 'NAVIGATE', to, replace });
export const goBack = () => store.dispatch({ type: 'BACK' });
