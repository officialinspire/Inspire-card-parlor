import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Store, store as appStore } from '@/core/store';
import { recordGameResult } from '@/progression/results';
import { haptic, __resetHaptics } from '@/utils/haptics';
import { settle, sleep } from '@/games/session';
import { setAvatarMood, TABLE_MOOD_POSE } from '@/components/Avatar';
import { setActiveStoryLevel, setStoryReturn, takeStoryReturn } from '@/story/session';
import { applyStoryResult, storyOf } from '@/story/progress';
import { ALL_LEVELS } from '@/story/campaign';
import { MOOD_POSE } from '@/components/story/sprites';
import { __setSoundBackend, flush, gameSound, repeatLevel } from '@/audio/gameSounds';

/**
 * Gameplay interaction (Prompt 31): rewards paid once per game, haptics that
 * never turn into a buzz, animation waits that can't hang a turn, table moods,
 * and story progress that survives skips, losses and retries.
 */

describe('once-only rewards', () => {
  it('a game reported twice is paid once, and the second report changes nothing', () => {
    const store = new Store();
    const result = { gameId: 'war' as const, outcome: 'win' as const, durationMs: 1000, key: 'war:12345' };
    const first = recordGameResult(store, result);
    const after = structuredClone(store.state.profile);
    const second = recordGameResult(store, result);
    expect(second).toBe(first);
    expect(store.state.profile.credits).toBe(after.credits);
    expect(store.state.profile.xp).toBe(after.xp);
    expect(store.state.profile.stats.war.played).toBe(1);
    // A different game (another key) is paid as usual.
    recordGameResult(store, { ...result, key: 'war:67890' });
    expect(store.state.profile.stats.war.played).toBe(2);
  });

  it('story rewards: a skipped closing scene loses nothing, a loss and retry corrupt nothing', () => {
    // A level whose rewards include a clue (evidence).
    const level = ALL_LEVELS.find((l) => l.rewards.some((r) => r.kind === 'evidence'))!;
    const clue = { id: (level.rewards.find((r) => r.kind === 'evidence') as { id: string }).id };
    const store = new Store();
    const play = (outcome: 'win' | 'loss') => {
      setActiveStoryLevel(level.id);
      const r = recordGameResult(store, {
        gameId: level.game,
        outcome,
        durationMs: 60_000,
        score: outcome === 'win' && level.game === 'go-fish' ? 13 : 0,
        details: level.game === 'go-fish' ? { books: outcome === 'win' ? 13 : 0 } : {},
      });
      setActiveStoryLevel(null);
      return r;
    };
    // A loss: one attempt counted, nothing granted, nothing completed.
    const lost = play('loss');
    expect(lost.story?.met).toBe(false);
    let story = storyOf(store.state.profile);
    expect(story.attempts[level.id]).toBe(1);
    expect(story.completed).not.toContain(level.id);
    expect(story.evidence).not.toContain(clue.id);
    // The retry wins. The clue is in the save as soon as the game is recorded, before
    // any closing scene plays, so skipping that scene can't lose it.
    const won = play('win');
    expect(won.story?.met).toBe(true);
    story = storyOf(store.state.profile);
    expect(story.attempts[level.id]).toBe(2);
    expect(story.completed).toEqual([level.id]);
    expect(story.evidence).toContain(clue.id);
    expect(story.rewarded).toContain(`level:${level.id}`);
    // Playing again pays no story reward twice.
    const credits = store.state.profile.credits;
    const again = play('win');
    expect(again.story?.levelRewards).toEqual([]);
    expect((storyOf(store.state.profile).evidence ?? []).filter((e) => e === clue.id)).toHaveLength(1);
    expect(store.state.profile.credits - credits).toBeLessThanOrEqual(30); // the ordinary game payout only
  });

  it('a loss never lowers progress already made', () => {
    const store = new Store();
    const level = ALL_LEVELS[0]!;
    const { patch } = applyStoryResult({ ...store.state.profile, storyChapter: 4 }, level.id, {
      gameId: level.game,
      outcome: 'loss',
      durationMs: 1000,
    });
    expect(patch.storyChapter).toBe(4);
  });
});

describe('card sounds', () => {
  it('a quick run of the same sound gets softer (never below 55 %); wins always play in full', () => {
    let now = 0;
    const heard: [string, number][] = [];
    const restore = __setSoundBackend(
      (sfx, level) => heard.push([sfx, level]),
      () => now,
    );
    for (let i = 0; i < 8; i++) {
      gameSound('card_move');
      flush();
      now += 100;
    }
    const levels = heard.map(([, l]) => l);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]!);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.55);
    // After a pause the next one is full again.
    now += 1000;
    gameSound('card_move');
    flush();
    expect(heard.at(-1)).toEqual(['slide', 1]);
    now += 3000;
    gameSound('victory');
    flush();
    expect(heard.at(-1)).toEqual(['victory', 1]);
    expect(repeatLevel(0)).toBe(1);
    restore();
  });
});

describe('story return', () => {
  it('remembers the chapter and challenge once, then forgets it', () => {
    setStoryReturn({ chapterId: 'th-3', levelId: 'th-3-2' });
    expect(takeStoryReturn()).toEqual({ chapterId: 'th-3', levelId: 'th-3-2' });
    expect(takeStoryReturn()).toBeNull();
  });
});

describe('haptics', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    appStore.dispatch({ type: 'UPDATE_SETTINGS', patch: { haptics: true } });
    __resetHaptics();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('a long cascade of the same event buzzes only now and then', () => {
    for (let i = 0; i < 30; i++) {
      haptic('tap');
      vi.advanceTimersByTime(20); // a card every 20 ms (auto-finish, a deal)
    }
    // 600 ms of events: at most one buzz per 140 ms.
    expect(vibrate.mock.calls.length).toBeGreaterThan(0);
    expect(vibrate.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('different events close together still respect a short gap; the setting and previews are honoured', () => {
    haptic('tap');
    haptic('error'); // within 60 ms: skipped
    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(80);
    haptic('error');
    expect(vibrate).toHaveBeenCalledTimes(2);
    appStore.dispatch({ type: 'UPDATE_SETTINGS', patch: { haptics: false } });
    vi.advanceTimersByTime(500);
    expect(haptic('tap')).toBe(false);
    expect(haptic('tap', true)).toBe(true); // the Settings preview
  });
});

describe('animation waits', () => {
  it('a turn waits for its animation, but never for ever', async () => {
    const t0 = Date.now();
    await settle(new Promise(() => undefined), 40); // an animation that never ends
    expect(Date.now() - t0).toBeLessThan(400);
    await settle(Promise.reject(new Error('cancelled')), 1000); // a cancelled one
    let done = false;
    await settle(
      sleep(5).then(() => (done = true)),
      1000,
    );
    expect(done).toBe(true);
  });
});

describe('table moods', () => {
  it('uses the story poses (the same set Story Mode uses) and settles back to neutral', () => {
    // Every table mood is one of the expression-sheet poses.
    const poses = new Set(Object.values(MOOD_POSE));
    for (const pose of Object.values(TABLE_MOOD_POSE)) expect(poses.has(pose)).toBe(true);
    vi.useFakeTimers();
    const el = document.createElement('span');
    document.body.append(el);
    setAvatarMood(el, 'surprise', 500);
    expect(el.dataset.mood).toBe('surprise');
    setAvatarMood(el, 'talk', 1000); // a newer mood replaces the pending return
    vi.advanceTimersByTime(600);
    expect(el.dataset.mood).toBe('talk');
    vi.advanceTimersByTime(500);
    expect(el.dataset.mood).toBe('neutral');
    setAvatarMood(el, 'win'); // no duration: it stays (the end of a game)
    vi.advanceTimersByTime(5000);
    expect(el.dataset.mood).toBe('win');
    vi.useRealTimers();
    el.remove();
  });
});
