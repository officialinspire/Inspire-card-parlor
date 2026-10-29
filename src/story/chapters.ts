import { getPersonality, PERSONALITIES } from '@/games/cpu/personalities';
import { CHARACTERS, STORY_CHAPTERS, type Character, type StoryChapter } from './campaign';

/**
 * Story chapters and characters. The campaign itself is defined in
 * ./campaign.ts; this module keeps the original names other code imports.
 */
export type Chapter = StoryChapter;
export type { Character };
export { CHARACTERS };

/** Chapter ids stay "chapter-1" … so story unlocks in saved data keep working. */
export const CHAPTERS: readonly StoryChapter[] = STORY_CHAPTERS;

/** A speaker: one of the parlor's regulars, or a CPU personality (Jak Gold…). */
export function getCharacter(id: string): Character | undefined {
  const c = CHARACTERS.find((x) => x.id === id);
  if (c) return c;
  if (!PERSONALITIES.some((p) => p.id === id)) return undefined;
  const p = getPersonality(id);
  return { id: p.id, name: p.name, role: p.title, color: p.color };
}
