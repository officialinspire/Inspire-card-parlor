/** Every top-level state the application can be in. */
export const AppState = {
  BOOT: 'BOOT',
  INITIALIZATION: 'INITIALIZATION',
  MAIN_MENU: 'MAIN_MENU',
  GAME_SELECTION: 'GAME_SELECTION',
  DECK_SELECTION: 'DECK_SELECTION',
  BOARD_SELECTION: 'BOARD_SELECTION',
  GAMEPLAY: 'GAMEPLAY',
  STORY_MODE: 'STORY_MODE',
  COLLECTION: 'COLLECTION',
  GAMEBOARDS: 'GAMEBOARDS',
  ACHIEVEMENTS: 'ACHIEVEMENTS',
  SETTINGS: 'SETTINGS',
  STATISTICS: 'STATISTICS',
} as const;

export type AppState = (typeof AppState)[keyof typeof AppState];

/** Screens reachable from the main menu and from every menu screen's header. */
export const MENU_HUB: readonly AppState[] = [
  AppState.MAIN_MENU,
  AppState.GAME_SELECTION,
  AppState.STORY_MODE,
  AppState.COLLECTION,
  AppState.GAMEBOARDS,
  AppState.ACHIEVEMENTS,
  AppState.SETTINGS,
  AppState.STATISTICS,
];

/**
 * Allowed transitions. Anything not listed here is rejected by the store,
 * which keeps navigation predictable as the game grows.
 */
export const TRANSITIONS: Record<AppState, readonly AppState[]> = {
  BOOT: [AppState.INITIALIZATION],
  INITIALIZATION: [AppState.MAIN_MENU],
  MAIN_MENU: MENU_HUB,
  GAME_SELECTION: [...MENU_HUB, AppState.DECK_SELECTION],
  DECK_SELECTION: [...MENU_HUB, AppState.BOARD_SELECTION],
  BOARD_SELECTION: [...MENU_HUB, AppState.DECK_SELECTION, AppState.GAMEPLAY],
  GAMEPLAY: [...MENU_HUB, AppState.BOARD_SELECTION, AppState.DECK_SELECTION],
  STORY_MODE: [...MENU_HUB, AppState.DECK_SELECTION, AppState.GAMEPLAY],
  COLLECTION: MENU_HUB,
  GAMEBOARDS: MENU_HUB,
  ACHIEVEMENTS: MENU_HUB,
  SETTINGS: MENU_HUB,
  STATISTICS: MENU_HUB,
};

export function canTransition(from: AppState, to: AppState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}
