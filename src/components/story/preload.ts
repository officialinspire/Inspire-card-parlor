import type { Profile } from '@/core/types';
import { storySprite, storyUrl } from '@/story/art';
import { STORY_CHAPTERS, type StoryChapter } from '@/story/campaign';
import { getCharacter } from '@/story/chapters';
import { locationState } from '@/story/world';
import { MOOD_POSE } from './sprites';

/**
 * Warms the cache for what the player will see next, and nothing else: the
 * current chapter's portraits (the poses its scenes use) and the next
 * place's map tile. Later chapters' artwork loads only when it is shown.
 * Each file is requested once per session, at low priority.
 */
const requested = new Set<string>();

function warm(path: string): void {
  if (requested.has(path)) return;
  requested.add(path);
  const img = new Image();
  img.decoding = 'async';
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
  img.src = storyUrl(path);
}

/** Sprite ids a chapter's scenes show (portraits in their poses). */
export function chapterPortraits(ch: StoryChapter): string[] {
  const lines = [ch.intro, ch.outro, ...ch.levels.flatMap((l) => [l.intro, l.outro])].flat();
  const ids = new Set<string>();
  for (const line of lines) {
    const sheet = getCharacter(line.who)?.portrait?.sheet;
    if (sheet) ids.add(`${sheet}/${line.pose ?? MOOD_POSE.speak}`);
  }
  return [...ids];
}

/** What to warm for this save: the chapter in play, and the next place on the map. */
export function preloadPlan(profile: Profile): string[] {
  const current = STORY_CHAPTERS.find((c) => locationState(profile, c) === 'available');
  if (!current) return [];
  const next = STORY_CHAPTERS[current.index];
  const ids = chapterPortraits(current);
  if (next?.artwork.locationSprite) ids.push(`thumb:${next.artwork.locationSprite}`);
  return ids;
}

export function preloadStory(profile: Profile): void {
  for (const id of preloadPlan(profile)) {
    const thumb = id.startsWith('thumb:');
    const s = storySprite(thumb ? id.slice(6) : id);
    if (s) warm(thumb ? s.thumb : s.src);
  }
}
