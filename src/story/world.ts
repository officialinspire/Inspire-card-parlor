import type { Profile } from '@/core/types';
import {
  STORY_CHAPTERS,
  getChapter,
  getLevel,
  type DialogueLine,
  type StoryChapter,
  type StoryLevel,
} from './campaign';
import { EVIDENCE } from './evidence';
import type { Evidence } from './types';
import { getLocation } from './locations';
import { chapterProgress, isChapterComplete, isChapterUnlocked, isLevelComplete, nextLevel, storyOf } from './progress';

/**
 * What the Story Mode screens show, worked out from the save: the state of
 * each place on the map, the journal's clues and summaries, and the scenes
 * that can be replayed. Pure functions, so the rules are easy to test.
 */

/**
 * A location on the world map:
 *  - undiscovered: not reached yet (name and art hidden);
 *  - locked: discovered — the next place to open — but its chapter is locked;
 *  - available: open to play (or revisit);
 *  - completed: all five challenges done (still open to revisit).
 */
export type LocationState = 'undiscovered' | 'locked' | 'available' | 'completed' | 'preview';

/**
 * Chapters whose scenes are still outlines are not offered as playable: once
 * reached they show as a "coming soon" preview (their progress still unlocks
 * underneath, so nothing changes for saves when they are written).
 */
export const isPlayableChapter = (chapter: StoryChapter) => chapter.status === 'final';

export function locationState(profile: Profile, chapter: StoryChapter): LocationState {
  if (isChapterComplete(profile, chapter)) return 'completed';
  if (isChapterUnlocked(profile, chapter)) return isPlayableChapter(chapter) ? 'available' : 'preview';
  const prev = STORY_CHAPTERS[chapter.index - 2];
  if (!prev || !isChapterUnlocked(profile, prev)) return 'undiscovered';
  // Past an unfinished chapter, nothing more is revealed yet.
  return isPlayableChapter(prev) ? 'locked' : 'undiscovered';
}

export interface MapStop {
  chapter: StoryChapter;
  state: LocationState;
  done: number;
  total: number;
  /** Shown to the player: hidden for undiscovered places. */
  name: string;
  description: string;
}

export function worldMap(profile: Profile): MapStop[] {
  return STORY_CHAPTERS.map((chapter) => {
    const state = locationState(profile, chapter);
    const { done, total } = chapterProgress(profile, chapter);
    const location = getLocation(chapter.locationId);
    const hidden = state === 'undiscovered';
    return {
      chapter,
      state,
      done,
      total,
      name: hidden ? 'Undiscovered location' : chapter.location,
      description: hidden
        ? 'Keep following the clues to find this place.'
        : (location?.description ?? chapter.description),
    };
  });
}

/** The chapter the player is on: the first open one not yet finished (null when all are done). */
export function currentChapter(profile: Profile): StoryChapter | null {
  return STORY_CHAPTERS.find((c) => locationState(profile, c) === 'available') ?? null;
}

/** The next challenge to play, with its chapter (null when the campaign is finished). */
export function currentObjective(profile: Profile): { chapter: StoryChapter; level: StoryLevel } | null {
  const chapter = currentChapter(profile);
  const level = chapter && nextLevel(profile, chapter);
  return chapter && level ? { chapter, level } : null;
}

/** The challenge after this one in the same chapter, if any. */
export function levelAfter(levelId: string): StoryLevel | undefined {
  const level = getLevel(levelId);
  const chapter = level && getChapter(levelId.replace(/-\d+$/, ''));
  return chapter?.levels[level!.number];
}

export interface JournalClue extends Evidence {
  chapterIndex: number;
}

export interface JournalChapter {
  chapter: StoryChapter;
  state: LocationState;
  /** What the chapter added to the mystery, once it is finished. */
  summary: string | null;
  cluesFound: number;
  cluesTotal: number;
}

export interface Journal {
  clues: JournalClue[];
  cluesTotal: number;
  chapters: JournalChapter[];
  objective: { chapter: StoryChapter; level: StoryLevel } | null;
  /** The next chapter, when it is reached but not written yet (the end of the demo). */
  preview: StoryChapter | null;
}

/** The quest journal: clues found (in story order), chapter summaries and the current objective. */
export function journalOf(profile: Profile): Journal {
  const found = new Set(storyOf(profile).evidence ?? []);
  const clues = EVIDENCE.filter((e) => found.has(e.id)).map((e) => ({
    ...e,
    chapterIndex: getChapter(e.chapter)?.index ?? 0,
  }));
  const chapters = STORY_CHAPTERS.flatMap((chapter): JournalChapter[] => {
    const state = locationState(profile, chapter);
    if (state === 'undiscovered' || state === 'locked' || state === 'preview') return [];
    const own = EVIDENCE.filter((e) => e.chapter === chapter.id);
    return [
      {
        chapter,
        state,
        summary: state === 'completed' ? chapter.mysteryThread : null,
        cluesFound: own.filter((e) => found.has(e.id)).length,
        cluesTotal: own.length,
      },
    ];
  });
  return {
    clues,
    cluesTotal: EVIDENCE.length,
    chapters,
    objective: currentObjective(profile),
    preview: STORY_CHAPTERS.find((c) => locationState(profile, c) === 'preview') ?? null,
  };
}

export interface ReplayableScene {
  id: string;
  title: string;
  chapter: StoryChapter;
  lines: DialogueLine[];
}

/** Scenes already seen, which the journal can play again. */
export function replayableScenes(profile: Profile): ReplayableScene[] {
  const story = storyOf(profile);
  return STORY_CHAPTERS.flatMap((chapter) => {
    const scenes: ReplayableScene[] = [];
    if (story.introsSeen.includes(chapter.id))
      scenes.push({ id: `${chapter.id}:intro`, title: `${chapter.title}: arrival`, chapter, lines: chapter.intro });
    for (const level of chapter.levels)
      if (level.outro.length && isLevelComplete(profile, level.id))
        scenes.push({ id: `${level.id}:outro`, title: level.title, chapter, lines: level.outro });
    if (isChapterComplete(profile, chapter))
      scenes.push({ id: `${chapter.id}:outro`, title: `${chapter.title}: departure`, chapter, lines: chapter.outro });
    return scenes;
  });
}
