import type { Store } from '@/core/store';
import type { Profile } from '@/core/types';
import { AppState } from '@/core/states';
import { audio } from '@/audio';
import { haptic } from '@/utils/haptics';
import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';
import { getAchievement } from '@/achievements/registry';
import { onAchievementsEarned } from '@/achievements/engine';
import { notify } from '@/components/Notifications';
import { isBoardUnlocked, isDeckUnlocked } from './levels';

/**
 * Progress announcements: achievements, new decks and boards, level-ups.
 *
 * Toasts never interrupt a game in progress: while a hand is being played
 * they wait in a queue and appear once the game ends (or the player leaves
 * the table). They are small, don't take focus, and stack at most a few at
 * a time; a burst is summarized.
 */
type Announcement =
  | { kind: 'achievement'; id: string }
  | { kind: 'deck'; id: string; name: string }
  | { kind: 'board'; id: string; name: string }
  | { kind: 'level'; level: number }
  | { kind: 'summary'; count: number };

const MAX_AT_ONCE = 3;
let queue: Announcement[] = [];
let inPlay = false;
let bound: Store | null = null;

/** Gameplay calls this when a hand starts (true) and ends (false). */
export function setPlayInProgress(on: boolean): void {
  inPlay = on;
  if (!on) flush();
}

const held = () =>
  inPlay ||
  !bound ||
  bound.state.screen === AppState.BOOT ||
  bound.state.screen === AppState.INITIALIZATION ||
  !bound.state.boot.ready;

export function announce(a: Announcement): void {
  queue.push(a);
  if (!held()) queueMicrotask(flush);
}

export function pendingAnnouncements(): readonly Announcement[] {
  return queue;
}

let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows up to three toasts at once: achievements first (a burst collapses
 * into one "N more" toast), then unlocks and level-ups. Anything left waits
 * for the next batch, once these have had their moment — nothing is dropped.
 */
function flush(): void {
  if (held() || !queue.length || batchTimer) return;
  const items = queue;
  const achievements = items.filter((a) => a.kind === 'achievement');
  const summed = items.reduce((n, a) => n + (a.kind === 'summary' ? a.count : 0), 0);
  const others = items.filter((a) => a.kind !== 'achievement' && a.kind !== 'summary');
  const ordered: Announcement[] = [];
  if (achievements.length + (summed ? 1 : 0) > 2) {
    ordered.push(achievements[0] ?? { kind: 'summary', count: summed });
    const rest = achievements.length ? achievements.length - 1 + summed : 0;
    if (rest) ordered.push({ kind: 'summary', count: rest });
  } else {
    ordered.push(...achievements);
    if (summed) ordered.push({ kind: 'summary', count: summed });
  }
  ordered.push(...others);
  const now = ordered.slice(0, MAX_AT_ONCE);
  queue = ordered.slice(MAX_AT_ONCE);
  now.forEach((a, i) => show(a, i));
  if (queue.length)
    batchTimer = setTimeout(
      () => {
        batchTimer = null;
        flush();
      },
      now.length * 700 + 4400,
    );
}

function show(a: Announcement, index: number): void {
  // Stagger so a burst arrives as a gentle cascade with one sound each.
  setTimeout(() => {
    switch (a.kind) {
      case 'achievement': {
        const def = getAchievement(a.id);
        if (!def) return;
        audio.play('achievement');
        haptic('success');
        notify(def.name, {
          kind: 'celebrate',
          title: 'Achievement unlocked',
          badge: def.id,
          duration: 4200,
          sound: false,
        });
        break;
      }
      case 'summary':
        audio.play('achievement');
        haptic('success');
        notify(`${a.count} ${a.count === 1 ? 'achievement' : 'achievements'} earned`, {
          kind: 'celebrate',
          title: 'Achievements',
          icon: 'trophy',
          duration: 4200,
          sound: false,
        });
        break;
      case 'deck':
        audio.play('unlock');
        haptic('success');
        notify(a.name, { kind: 'celebrate', title: 'Deck unlocked', icon: 'cards', duration: 4200, sound: false });
        break;
      case 'board':
        audio.play('unlock');
        notify(a.name, { kind: 'celebrate', title: 'Gameboard unlocked', icon: 'board', duration: 4200, sound: false });
        break;
      case 'level':
        audio.play('levelup');
        haptic('success');
        notify(`Level ${a.level}`, {
          kind: 'celebrate',
          title: 'Level up',
          icon: 'star',
          duration: 4200,
          sound: false,
        });
        break;
    }
  }, index * 700);
}

const visibleDecks = (p: Profile) =>
  allDecks()
    .filter((d) => d.contentRating !== 'mature' && isDeckUnlocked(d.id, p))
    .map((d) => d.id);
const visibleBoards = (p: Profile) =>
  allBoards()
    .filter((b) => isBoardUnlocked(b.id, p))
    .map((b) => b.id);

/** Watches the profile for things worth announcing, and releases held toasts at the right moments. */
export function attachAnnouncer(store: Store): void {
  bound = store;
  let decks = new Set(visibleDecks(store.state.profile));
  let boards = new Set(visibleBoards(store.state.profile));
  let level = store.state.profile.level;

  onAchievementsEarned((ids, { silent }) => {
    if (silent) {
      if (ids.length) announce({ kind: 'summary', count: ids.length });
      return;
    }
    for (const id of ids) announce({ kind: 'achievement', id });
  });

  store.subscribe((next, prev, action) => {
    if (next.profile !== prev.profile) {
      const p = next.profile;
      const nowDecks = visibleDecks(p);
      const nowBoards = visibleBoards(p);
      // Hydrating a save is not an unlock.
      if (action.type !== 'HYDRATE') {
        for (const id of nowDecks)
          if (!decks.has(id)) announce({ kind: 'deck', id, name: allDecks().find((d) => d.id === id)!.name });
        for (const id of nowBoards)
          if (!boards.has(id)) announce({ kind: 'board', id, name: allBoards().find((b) => b.id === id)!.name });
        if (p.level > level) announce({ kind: 'level', level: p.level });
      }
      decks = new Set(nowDecks);
      boards = new Set(nowBoards);
      level = p.level;
    }
    if (next.screen !== prev.screen) {
      // Leaving the table ends any hand in progress as far as toasts are concerned.
      if (prev.screen === AppState.GAMEPLAY) inPlay = false;
      queueMicrotask(flush);
    }
    if (next.boot.ready !== prev.boot.ready) queueMicrotask(flush);
  });
}
