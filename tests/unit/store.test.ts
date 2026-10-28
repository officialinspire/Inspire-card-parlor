import { describe, expect, it } from 'vitest';
import { createInitialState, reduce, Store } from '@/core/store';
import { AppState, MENU_HUB, TRANSITIONS, canTransition } from '@/core/states';

const boot = () => {
  const s = new Store();
  s.dispatch({ type: 'NAVIGATE', to: AppState.INITIALIZATION });
  s.dispatch({ type: 'NAVIGATE', to: AppState.MAIN_MENU });
  return s;
};

describe('navigation', () => {
  it('follows the boot sequence into the main menu with an empty history', () => {
    const s = boot();
    expect(s.state.screen).toBe(AppState.MAIN_MENU);
    expect(s.state.history).toEqual([]);
  });

  it('rejects transitions that are not declared', () => {
    const s = new Store();
    s.dispatch({ type: 'NAVIGATE', to: AppState.GAMEPLAY });
    expect(s.state.screen).toBe(AppState.BOOT);
    expect(canTransition(AppState.COLLECTION, AppState.GAMEPLAY)).toBe(false);
  });

  it('lets every menu screen reach every other menu screen and return home', () => {
    for (const from of MENU_HUB) {
      for (const to of MENU_HUB) expect(canTransition(from, to), `${from} → ${to}`).toBe(true);
    }
  });

  it('declares transitions for every state', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.values(AppState).sort());
  });

  it('walks the Quick Play flow and back again', () => {
    const s = boot();
    for (const to of [AppState.GAME_SELECTION, AppState.DECK_SELECTION, AppState.BOARD_SELECTION, AppState.GAMEPLAY]) {
      s.dispatch({ type: 'NAVIGATE', to });
      expect(s.state.screen).toBe(to);
    }
    s.dispatch({ type: 'BACK' });
    expect(s.state.screen).toBe(AppState.BOARD_SELECTION);
    s.dispatch({ type: 'BACK' });
    s.dispatch({ type: 'BACK' });
    s.dispatch({ type: 'BACK' });
    expect(s.state.screen).toBe(AppState.MAIN_MENU);
  });

  it('never goes back into the splash screens', () => {
    const s = new Store();
    s.dispatch({ type: 'NAVIGATE', to: AppState.INITIALIZATION });
    s.dispatch({ type: 'NAVIGATE', to: AppState.MAIN_MENU });
    s.dispatch({ type: 'NAVIGATE', to: AppState.SETTINGS });
    s.dispatch({ type: 'BACK' });
    s.dispatch({ type: 'BACK' });
    expect(s.state.screen).toBe(AppState.MAIN_MENU);
  });

  it('returns to the same state object for no-op actions', () => {
    const state = createInitialState();
    expect(reduce(state, { type: 'NAVIGATE', to: AppState.BOOT })).toBe(state);
    expect(reduce(state, { type: 'DISMISS_NOTIFICATION', id: 99 })).toBe(state);
    expect(reduce(state, { type: 'SET_FULLSCREEN', fullscreen: false })).toBe(state);
  });
});

describe('selection memory', () => {
  it('remembers the deck and board last dealt for each game', () => {
    const s = boot();
    s.dispatch({ type: 'SELECT_GAME', gameId: 'spider' });
    s.dispatch({ type: 'SELECT_DECK', deckId: 'fredericksburg' });
    s.dispatch({ type: 'SELECT_BOARD', boardId: 'oxblood-lounge' });
    s.dispatch({ type: 'START_GAME' });

    s.dispatch({ type: 'SELECT_GAME', gameId: 'klondike' });
    s.dispatch({ type: 'SELECT_DECK', deckId: 'classic' });
    s.dispatch({ type: 'SELECT_BOARD', boardId: 'velvet-green' });
    s.dispatch({ type: 'START_GAME' });

    s.dispatch({ type: 'SELECT_GAME', gameId: 'spider' });
    expect(s.state.selection).toMatchObject({ gameId: 'spider', deckId: 'fredericksburg', boardId: 'oxblood-lounge' });
    s.dispatch({ type: 'SELECT_GAME', gameId: 'klondike' });
    expect(s.state.selection).toMatchObject({ deckId: 'classic', boardId: 'velvet-green' });
  });

  it('keeps the current deck and board for a game never played before', () => {
    const s = boot();
    s.dispatch({ type: 'SELECT_DECK', deckId: 'eastern_woodlands' });
    s.dispatch({ type: 'SELECT_GAME', gameId: 'war' });
    expect(s.state.selection.deckId).toBe('eastern_woodlands');
  });

  it('does not record a choice without a selected game', () => {
    const state = createInitialState();
    expect(reduce(state, { type: 'START_GAME' })).toBe(state);
  });
});

describe('notifications and modals', () => {
  it('keeps at most four notifications, newest last', () => {
    const s = new Store();
    for (let id = 1; id <= 6; id++) {
      s.dispatch({ type: 'NOTIFY', notification: { id, message: `n${id}`, kind: 'info', duration: 0 } });
    }
    expect(s.state.notifications.map((n) => n.id)).toEqual([3, 4, 5, 6]);
    s.dispatch({ type: 'DISMISS_NOTIFICATION', id: 4 });
    expect(s.state.notifications.map((n) => n.id)).toEqual([3, 5, 6]);
  });

  it('tracks open dialogs as a stack', () => {
    const s = new Store();
    s.dispatch({ type: 'MODAL_OPENED', modal: { id: 'a', title: 'A' } });
    s.dispatch({ type: 'MODAL_OPENED', modal: { id: 'b', title: 'B' } });
    expect(s.state.modals.map((m) => m.id)).toEqual(['a', 'b']);
    s.dispatch({ type: 'MODAL_CLOSED', id: 'a' });
    expect(s.state.modals.map((m) => m.id)).toEqual(['b']);
  });
});

describe('hydration', () => {
  it('merges saved data without losing defaults', () => {
    const s = new Store();
    s.dispatch({
      type: 'HYDRATE',
      settings: { musicTrack: 'midnight-tea' },
      // Saved stats may be partial; hydration fills in the missing games.
      profile: {
        credits: 900,
        stats: {
          war: { played: 3, won: 2, bestTimeMs: null, bestScore: null, currentStreak: 1, longestStreak: 2 },
        } as never,
      },
      selection: { deckId: 'spycraft', storyChapterId: 'chapter-2' },
    });
    expect(s.state.settings.musicTrack).toBe('midnight-tea');
    expect(s.state.settings.masterVolume).toBeGreaterThan(0);
    expect(s.state.profile.credits).toBe(900);
    expect(s.state.profile.stats.war.played).toBe(3);
    expect(s.state.profile.stats.klondike.played).toBe(0);
    expect(s.state.selection.deckId).toBe('spycraft');
    expect(s.state.selection.storyChapterId).toBeNull();
  });
});

describe('select()', () => {
  it('only fires when the selected slice changes', () => {
    const s = new Store();
    const seen: number[] = [];
    s.select(
      (st) => st.profile.credits,
      (v) => seen.push(v),
    );
    s.dispatch({ type: 'UPDATE_SETTINGS', patch: { muted: true } });
    s.dispatch({ type: 'UPDATE_PROFILE', patch: { credits: 10 } });
    s.dispatch({ type: 'UPDATE_PROFILE', patch: { credits: 10 } });
    expect(seen).toEqual([10]);
  });
});
