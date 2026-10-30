import type { Store } from '@/core/store';
import type { GameId, Settings } from '@/core/types';
import { audio } from '@/audio';
import { onAchievementsEarned } from '@/achievements/engine';
import { getLevel } from '@/story/campaign';
import { activeStoryLevel } from '@/story/session';
import { capture, startAnalytics, setAnalyticsEnabled, type EventProps, type ProductEvent } from './posthog';

let bound: Store | null = null;
/** Round events are capped per game so a long War doesn't flood the stream. */
const ROUND_CAP = 20;
let roundsThisGame = 0;

/** The difficulty a game is played at, in words. */
export function difficultyOf(game: GameId, s: Settings, options?: Record<string, unknown>): string {
  switch (game) {
    case 'klondike':
      return `draw-${options?.draw ?? s.klondikeDraw}`;
    case 'spider':
      return `${options?.suits ?? s.spiderSuits}-suit`;
    case 'go-fish':
      return `${options?.difficulty ?? s.cpuDifficulty}`;
    case 'war':
      return 'standard';
    case 'freecell':
      return 'standard';
  }
}

/** Sends a game event with the game, mode and difficulty filled in from the current table. */
export function gameEvent(event: ProductEvent, props: EventProps = {}): void {
  if (!bound) return;
  const s = bound.state;
  const storyId = activeStoryLevel() ?? s.selection.storyLevelId;
  const level = storyId ? getLevel(storyId) : undefined;
  const game = (level?.game ?? s.selection.gameId) as GameId | null;
  if (!game) return;
  if (event === 'game_started') roundsThisGame = 0;
  if ((event === 'round_started' || event === 'round_completed') && roundsThisGame++ >= ROUND_CAP * 2) return;
  capture(event, {
    game,
    mode: level ? 'story' : 'quick_play',
    difficulty: difficultyOf(game, s.settings, level?.setup.options as Record<string, unknown> | undefined),
    ...(level ? { story_level: level.id } : {}),
    ...props,
  });
}

/** Wires the suite's product analytics to the app. */
export function attachProductAnalytics(store: Store): void {
  bound = store;
  startAnalytics(store.state.settings.analyticsEnabled);
  store.select(
    (s) => s.settings.analyticsEnabled,
    (on) => setAnalyticsEnabled(on),
  );

  // Difficulty choices.
  const watch = (key: keyof Settings, value: (s: Settings) => { game: GameId; difficulty: string }) =>
    store.subscribe((next, prev, action) => {
      if (action.type === 'HYDRATE' || next.settings[key] === prev.settings[key]) return;
      capture('difficulty_selected', { ...value(next.settings), setting: key });
    });
  watch('klondikeDraw', (s) => ({ game: 'klondike', difficulty: `draw-${s.klondikeDraw}` }));
  watch('spiderSuits', (s) => ({ game: 'spider', difficulty: `${s.spiderSuits}-suit` }));
  watch('cpuDifficulty', (s) => ({ game: 'go-fish', difficulty: s.cpuDifficulty }));

  onAchievementsEarned((ids, { silent }) => {
    if (silent) return;
    for (const achievement of ids) capture('achievement_unlocked', { achievement });
  });

  audio.onUnlock(() => capture('audio_enabled', { source_screen: store.state.screen }));
  addEventListener('appinstalled', () => capture('pwa_installed'));

  // Errors: the kind and a short message only (no stack, no page data).
  const report = (kind: string, err: unknown) =>
    capture('error_encountered', {
      error_kind: kind,
      error_name: err instanceof Error ? err.name : typeof err,
      error_message: String(err instanceof Error ? err.message : err).slice(0, 120),
      screen: store.state.screen,
    });
  addEventListener('error', (e) => report('error', e.error ?? e.message));
  addEventListener('unhandledrejection', (e) => report('rejection', e.reason));
}
