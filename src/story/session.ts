import type { StoryOutcome } from './progress';

/**
 * The story challenge currently at the table, and the outcome of the last
 * one played. Gameplay sets the active level; finished games are scored
 * against it (progression/results.ts); Story Mode shows the outcome.
 */
let active: string | null = null;
let last: StoryOutcome | null = null;

export const activeStoryLevel = () => active;
export function setActiveStoryLevel(levelId: string | null): void {
  active = levelId;
}

export function setLastStoryOutcome(o: StoryOutcome | null): void {
  last = o;
}
export const peekStoryOutcome = () => last;
/** Returns the last outcome once, then forgets it. */
export function takeStoryOutcome(): StoryOutcome | null {
  const o = last;
  last = null;
  return o;
}

/**
 * Where the player was in Story Mode when a challenge began: Story Mode
 * reopens on that chapter, with that challenge in view, however the table
 * was left (a finish, Back, Home or the browser's Back).
 */
let place: { chapterId: string; levelId: string } | null = null;
export function setStoryReturn(p: { chapterId: string; levelId: string } | null): void {
  place = p;
}
/** Returns the place once, then forgets it. */
export function takeStoryReturn(): { chapterId: string; levelId: string } | null {
  const p = place;
  place = null;
  return p;
}
