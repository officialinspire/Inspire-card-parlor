import type { Profile } from '@/core/types';
import { DECKS } from '@/decks/registry';
import { BOARDS } from '@/boards/registry';

/** XP required to go from `level` to `level + 1`. Gentle curve for a cozy pace. */
export const xpForLevel = (level: number) => Math.round(100 * Math.pow(level, 1.35));

export function levelProgress(profile: Profile): { level: number; current: number; needed: number; ratio: number } {
  const needed = xpForLevel(profile.level);
  return { level: profile.level, current: profile.xp, needed, ratio: Math.min(1, profile.xp / needed) };
}

/** Applies XP, rolling over levels. Returns the profile patch. */
export function grantXp(profile: Profile, amount: number): Pick<Profile, 'xp' | 'level'> {
  let { xp, level } = profile;
  xp += amount;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return { xp, level };
}

type Unlockable = { id: string; unlock: { type: string; value?: number | string } };

export function isUnlocked(item: Unlockable, profile: Profile, owned: string[]): boolean {
  if (owned.includes(item.id)) return true;
  switch (item.unlock.type) {
    case 'default':
      return true;
    case 'level':
      return profile.level >= Number(item.unlock.value);
    case 'achievement':
      return profile.unlockedAchievements.includes(String(item.unlock.value));
    case 'story': {
      const chapterNum = Number(String(item.unlock.value).replace('chapter-', ''));
      return profile.storyChapter >= chapterNum;
    }
    default:
      return false;
  }
}

export function unlockHint(item: Unlockable): string {
  switch (item.unlock.type) {
    case 'level':
      return `Reach level ${item.unlock.value}`;
    case 'achievement':
      return 'Earn a special achievement';
    case 'story':
      return `Complete ${String(item.unlock.value).replace('chapter-', 'Chapter ')}`;
    default:
      return '';
  }
}

export const isDeckUnlocked = (id: string, p: Profile) =>
  isUnlocked(
    DECKS.find((d) => d.id === id)!,
    p,
    p.unlockedDecks,
  );
export const isBoardUnlocked = (id: string, p: Profile) =>
  isUnlocked(
    BOARDS.find((b) => b.id === id)!,
    p,
    p.unlockedBoards,
  );
