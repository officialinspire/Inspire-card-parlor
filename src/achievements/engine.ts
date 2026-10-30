import type { Store } from '@/core/store';
import type { Profile } from '@/core/types';
import { grantXp } from '@/progression/levels';
import { buildFacts } from './facts';
import { ACHIEVEMENTS, type AchievementDefinition } from './registry';

/** Pure: achievements whose condition is met but that aren't unlocked yet. */
export function newlyEarned(profile: Profile): AchievementDefinition[] {
  const has = new Set(profile.unlockedAchievements);
  const f = buildFacts(profile);
  return ACHIEVEMENTS.filter((a) => !has.has(a.id) && a.progress(f) >= a.target);
}

/**
 * Pure: unlocks everything earned, stamping each with `now` and paying its
 * XP once. Repeats until nothing new is earned (XP can raise the level,
 * which can earn a level achievement). Ids already unlocked are never
 * added again, so nothing pays twice.
 */
export function unlockEarned(profile: Profile, now = Date.now()): { patch: Partial<Profile>; earned: string[] } {
  let p = profile;
  const earned: string[] = [];
  for (let round = 0; round < 6; round++) {
    const fresh = newlyEarned(p);
    if (!fresh.length) break;
    const xp = fresh.reduce((n, a) => n + a.xp, 0);
    const dates = { ...p.achievementDates };
    for (const a of fresh) dates[a.id] = now;
    p = {
      ...p,
      ...grantXp(p, xp),
      unlockedAchievements: [...p.unlockedAchievements, ...fresh.map((a) => a.id)],
      achievementDates: dates,
    };
    earned.push(...fresh.map((a) => a.id));
  }
  if (!earned.length) return { patch: {}, earned };
  return {
    patch: {
      unlockedAchievements: p.unlockedAchievements,
      achievementDates: p.achievementDates,
      xp: p.xp,
      level: p.level,
    },
    earned,
  };
}

type EarnedListener = (ids: string[], opts: { silent: boolean }) => void;
const listeners = new Set<EarnedListener>();
export const onAchievementsEarned = (fn: EarnedListener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let evaluating = false;

/** Unlocks whatever the current profile has earned. Returns the new ids. */
export function evaluateAchievements(store: Store, opts: { silent?: boolean } = {}): string[] {
  if (evaluating) return [];
  evaluating = true;
  try {
    const { patch, earned } = unlockEarned(store.state.profile);
    if (earned.length) {
      store.dispatch({ type: 'UPDATE_PROFILE', patch });
      for (const l of listeners) l(earned, { silent: !!opts.silent });
    }
    return earned;
  } finally {
    evaluating = false;
  }
}

/** Re-checks achievements (coalesced, after the current dispatch) whenever the profile changes. */
export function attachAchievements(store: Store): void {
  let scheduled = false;
  store.select(
    (s) => s.profile,
    () => {
      if (scheduled || evaluating) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        evaluateAchievements(store);
      });
    },
  );
}
