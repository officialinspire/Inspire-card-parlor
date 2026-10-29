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
