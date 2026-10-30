import { AppState } from '@/core/states';
import type { ScreenRegistry } from '../Screen';
import { InitializationScreen } from './Initialization';
import { MainMenuScreen } from './MainMenu';
import { GameSelectionScreen } from './GameSelection';
import { DeckSelectionScreen } from './DeckSelection';
import { BoardSelectionScreen } from './BoardSelection';
import { GameplayScreen } from './Gameplay';
import { StoryModeScreen } from './StoryMode';
import { CollectionScreen } from './Collection';
import { GameboardsScreen } from './Gameboards';
import { AchievementsScreen } from './Achievements';
import { SettingsScreen } from './Settings';
import { StatisticsScreen } from './Statistics';
import { PassportScreen } from './Passport';

/** BOOT has no screen: it runs before the stage exists, then hands off to INITIALIZATION. */
export const SCREENS: ScreenRegistry = {
  [AppState.INITIALIZATION]: InitializationScreen,
  [AppState.MAIN_MENU]: MainMenuScreen,
  [AppState.GAME_SELECTION]: GameSelectionScreen,
  [AppState.DECK_SELECTION]: DeckSelectionScreen,
  [AppState.BOARD_SELECTION]: BoardSelectionScreen,
  [AppState.GAMEPLAY]: GameplayScreen,
  [AppState.STORY_MODE]: StoryModeScreen,
  [AppState.COLLECTION]: CollectionScreen,
  [AppState.GAMEBOARDS]: GameboardsScreen,
  [AppState.ACHIEVEMENTS]: AchievementsScreen,
  [AppState.SETTINGS]: SettingsScreen,
  [AppState.STATISTICS]: StatisticsScreen,
  [AppState.PASSPORT]: PassportScreen,
};
