import type { Profile } from '@/core/types';
import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';

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
    case 'credits':
      return false; // only owned once bought (checked via `owned` above)
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
    case 'credits':
      return `${item.unlock.value} credits`;
    default:
      return '';
  }
}

export function isDeckUnlocked(id: string, p: Profile): boolean {
  const deck = allDecks().find((d) => d.id === id);
  return !!deck && isUnlocked(deck, p, p.unlockedDecks);
}

export function isBoardUnlocked(id: string, p: Profile): boolean {
  const board = allBoards().find((b) => b.id === id);
  return !!board && isUnlocked(board, p, p.unlockedBoards);
}

/** Alternate artwork is owned when bought, or when its unlock condition is met. */
export function isVariantOwned(
  deckId: string,
  variant: { id: string; unlock: { type: string; value?: number | string } },
  p: Profile,
): boolean {
  return isUnlocked(
    variant,
    p,
    p.ownedVariants.map((k) => (k.startsWith(`${deckId}@`) ? k.slice(deckId.length + 1) : '')),
  );
}
