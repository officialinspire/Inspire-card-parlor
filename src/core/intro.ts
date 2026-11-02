import type { Settings } from './types';

/**
 * The opening sequence's rules, kept pure so they are easy to test:
 * which version plays, and how long each stage lasts.
 *
 *  BLACK → PRESENTS (OFFICIAL INSPIRE) → TITLE → TOUCH TO START → (fade) → menu
 *
 * Timing is presentation only. Loading runs alongside and is never padded:
 * Touch to Start appears when loading has really finished (and the title has
 * been shown), and any tap or key skips straight to the title.
 */
export type IntroPlan = 'full' | 'brief';
export type IntroStage = 'black' | 'presents' | 'title' | 'ready' | 'leaving';

export interface LaunchHistory {
  /** The intro has played on this device before. */
  seenBefore: boolean;
  /** It already played in this browser session (a quick refresh). */
  playedThisSession: boolean;
}

/** Which version plays. `auto`: the full intro once; afterwards, and on a quick refresh, the brief one. */
export function introPlan(setting: Settings['startupIntro'], launch: LaunchHistory): IntroPlan {
  if (setting === 'brief') return 'brief';
  if (setting === 'full') return 'full';
  return launch.seenBefore || launch.playedThisSession ? 'brief' : 'full';
}

export interface IntroTimeline {
  /** When each stage begins, in ms from the start. */
  presents: number;
  title: number;
  /** Fade to black after Touch to Start. */
  leave: number;
  /** The menu's reveal from black. */
  reveal: number;
}

/** Stage start times. Reduced motion keeps the order but shortens every fade to a moment. */
export function introTimeline(plan: IntroPlan, calm: boolean): IntroTimeline {
  if (plan === 'brief') return { presents: 0, title: 0, leave: calm ? 120 : 420, reveal: calm ? 150 : 1100 };
  return calm
    ? { presents: 150, title: 1550, leave: 120, reveal: 150 }
    : { presents: 450, title: 2750, leave: 420, reveal: 1100 };
}

// Launch history lives outside the save, so clearing progress doesn't change it.
const SEEN_KEY = 'icp:intro-seen';
const SESSION_KEY = 'icp:intro-played';

export function readLaunchHistory(): LaunchHistory {
  const get = (store: () => Storage, key: string) => {
    try {
      return store().getItem(key) === '1';
    } catch {
      return false;
    }
  };
  return { seenBefore: get(() => localStorage, SEEN_KEY), playedThisSession: get(() => sessionStorage, SESSION_KEY) };
}

export function recordIntroPlayed(): void {
  for (const [store, key] of [
    [() => localStorage, SEEN_KEY],
    [() => sessionStorage, SESSION_KEY],
  ] as const) {
    try {
      store().setItem(key, '1');
    } catch {
      /* private mode: the full intro may simply play again */
    }
  }
}
