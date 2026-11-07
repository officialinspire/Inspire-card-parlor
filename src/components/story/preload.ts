import { warmImage } from '@/assets/preload';
import { assetManager, deckThemes } from '@/decks';
import { getBoard } from '@/boards/registry';
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
 * Transfers and image decodes are deduplicated and bounded to two sprites at once.
 */
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
  const chapter = STORY_CHAPTERS.find((c) => locationState(profile, c) === 'available');
  const level = chapter?.levels.find((l) => !profile.story.completed.includes(l.id)) ?? chapter?.levels[0];
  if (level) {
    void assetManager.loadDeck(deckThemes.resolve(level.setup.deckId));
    const board = getBoard(level.setup.boardId);
    if (board.assets.status === 'ready') void assetManager.loadImage(board.assets.basePath, board.assets.background);
  }
  for (const id of preloadPlan(profile)) {
    const thumb = id.startsWith('thumb:');
    const s = storySprite(thumb ? id.slice(6) : id);
    if (s) void warmImage(storyUrl(thumb ? s.thumb : s.src));
  }
}
