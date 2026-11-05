import type { Profile } from '@/core/types';
import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';
import { isUnlocked } from './levels';

/** Atomic, catalog-priced purchase. Duplicate clicks and stale dialogs cannot charge twice. */
export function purchaseCollectible(profile: Profile, kind: 'deck' | 'board', id: string): Profile {
  const item = (kind === 'deck' ? allDecks() : allBoards()).find((entry) => entry.id === id);
  const key = kind === 'deck' ? 'unlockedDecks' : 'unlockedBoards';
  if (!item || item.unlock.type !== 'credits' || isUnlocked(item, profile, profile[key])) return profile;
  const price = item.unlock.value;
  if (!Number.isSafeInteger(price) || price <= 0 || !Number.isFinite(profile.credits) || profile.credits < price)
    return profile;
  return { ...profile, credits: profile.credits - price, [key]: [...profile[key], id] };
}
