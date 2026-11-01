import type { LegacyStoryArchive, Profile, StoryProgress } from '@/core/types';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { grantXp } from '@/progression/levels';
import type { GameResult } from '@/progression/results';
import {
  STORY_CHAPTERS,
  chapterOfLevel,
  discoveriesIn,
  getChapter,
  getLevel,
  type StoryChapter,
  type StoryLevel,
  type StoryReward,
} from './campaign';
import { getEvidence } from './evidence';
import { CAMPAIGN_ID } from './ids';
import { emptyCampaignProgress } from './migrate';

/**
 * Campaign progress and rewards. Pure functions over the profile, so the
 * rules (unlock order, objectives, "rewards only once") are easy to test.
 *
 * Progress lives in `profile.story`, marked with the campaign it belongs to;
 * `profile.storyChapter` counts this campaign's chapters completed in order.
 * The first campaign's progress is archived in `profile.legacyStory`
 * (./migrate.ts) and is never read as progress here.
 */

export const emptyStoryProgress = emptyCampaignProgress;

/** This campaign's progress. Story blocks from another campaign read as empty (they are archived on load). */
export function storyOf(profile: Profile): StoryProgress {
  const story = profile.story;
  if (story && story.campaign !== undefined && story.campaign !== CAMPAIGN_ID) return emptyCampaignProgress();
  if (story && story.campaign === undefined && story.completed?.some((id) => !id.startsWith('th-')))
    return emptyCampaignProgress();
  return { ...emptyCampaignProgress(), ...story };
}

/** The archived first-campaign progress, if the save had any. */
export const legacyStoryOf = (profile: Profile): LegacyStoryArchive | undefined => profile.legacyStory;

export function isChapterComplete(profile: Profile, chapter: StoryChapter): boolean {
  const done = storyOf(profile).completed;
  return chapter.levels.every((l) => done.includes(l.id));
}

export function isChapterUnlocked(profile: Profile, chapter: StoryChapter): boolean {
  const req = chapter.unlockRequirements;
  if (req.level && profile.level < req.level) return false;
  if (!req.chapter) return true;
  return isChapterComplete(profile, getChapter(req.chapter)!);
}

export function isLevelUnlocked(profile: Profile, level: StoryLevel): boolean {
  const chapter = chapterOfLevel(level.id)!;
  if (!isChapterUnlocked(profile, chapter)) return false;
  if (level.number === 1) return true;
  const prev = chapter.levels[level.number - 2]!;
  return storyOf(profile).completed.includes(prev.id);
}

export const isLevelComplete = (profile: Profile, levelId: string) => storyOf(profile).completed.includes(levelId);

export function chapterProgress(profile: Profile, chapter: StoryChapter): { done: number; total: number } {
  const done = storyOf(profile).completed;
  return { done: chapter.levels.filter((l) => done.includes(l.id)).length, total: chapter.levels.length };
}

/** The next level to play in a chapter (first unfinished), or null when all are done. */
export function nextLevel(profile: Profile, chapter: StoryChapter): StoryLevel | null {
  return chapter.levels.find((l) => !isLevelComplete(profile, l.id)) ?? null;
}

/** Did this finished game meet the level's objective? */
export function objectiveMet(level: StoryLevel, r: GameResult): boolean {
  if (r.gameId !== level.game) return false;
  if (level.objective.kind === 'books') return (r.details?.books ?? r.score ?? 0) >= level.objective.min;
  return r.outcome === 'win';
}

/** Applies rewards that are not already owned. Returns the profile patch and what was actually new. */
export function grantRewards(
  profile: Profile,
  rewards: readonly StoryReward[],
): { patch: Partial<Profile>; granted: StoryReward[] } {
  const story = storyOf(profile);
  let { credits, unlockedDecks, unlockedBoards, ownedVariants } = profile;
  const { unlockedAchievements } = profile;
  let stamps = story.stamps;
  let evidence = story.evidence ?? [];
  let xp = 0;
  const granted: StoryReward[] = [];
  for (const r of rewards) {
    switch (r.kind) {
      case 'credits':
        credits += r.amount;
        granted.push(r);
        break;
      case 'xp':
        xp += r.amount;
        granted.push(r);
        break;
      case 'deck':
        if (!unlockedDecks.includes(r.id)) ((unlockedDecks = [...unlockedDecks, r.id]), granted.push(r));
        break;
      case 'board':
        if (!unlockedBoards.includes(r.id)) ((unlockedBoards = [...unlockedBoards, r.id]), granted.push(r));
        break;
      case 'variant':
        if (!ownedVariants.includes(r.id)) ((ownedVariants = [...ownedVariants, r.id]), granted.push(r));
        break;
      case 'stamp':
        if (!stamps.includes(r.id)) ((stamps = [...stamps, r.id]), granted.push(r));
        break;
      case 'evidence':
        if (!evidence.includes(r.id) && getEvidence(r.id)) ((evidence = [...evidence, r.id]), granted.push(r));
        break;
      case 'achievement':
        // Listed for the reward screen only: the achievement engine unlocks it (with its date
        // and XP) as soon as its condition — finishing the chapter — is met, exactly once.
        if (!unlockedAchievements.includes(r.id) && ACHIEVEMENTS.some((a) => a.id === r.id)) granted.push(r);
        break;
    }
  }
  const levelled = grantXp(profile, xp);
  return {
    patch: {
      credits,
      unlockedDecks,
      unlockedBoards,
      ownedVariants,
      ...levelled,
      story: { ...story, stamps, evidence },
    },
    granted,
  };
}

export interface StoryOutcome {
  levelId: string;
  chapterId: string;
  met: boolean;
  /** First time this level was completed. */
  firstClear: boolean;
  levelRewards: StoryReward[];
  chapterComplete: boolean;
  chapterRewards: StoryReward[];
  attempts: number;
}

/**
 * Records a finished story game. Level rewards are granted the first time
 * the objective is met, chapter rewards the first time all five are done;
 * both are keyed in `story.rewarded`, so replays never pay out twice.
 */
export function applyStoryResult(
  profile: Profile,
  levelId: string,
  r: GameResult,
): { patch: Partial<Profile>; outcome: StoryOutcome } {
  const level = getLevel(levelId);
  const chapter = chapterOfLevel(levelId);
  if (!level || !chapter) throw new Error(`Unknown story level "${levelId}"`);
  let p: Profile = profile;
  const story = storyOf(p);
  const attempts = (story.attempts[levelId] ?? 0) + 1;
  p = { ...p, story: { ...story, attempts: { ...story.attempts, [levelId]: attempts } } };
  const met = objectiveMet(level, r);
  const outcome: StoryOutcome = {
    levelId,
    chapterId: chapter.id,
    met,
    firstClear: false,
    levelRewards: [],
    chapterRewards: [],
    chapterComplete: false,
    attempts,
  };
  if (met) {
    const s = storyOf(p);
    if (!s.completed.includes(levelId)) {
      outcome.firstClear = true;
      p = { ...p, story: { ...s, completed: [...s.completed, levelId] } };
    }
    const levelKey = `level:${levelId}`;
    if (!storyOf(p).rewarded.includes(levelKey)) {
      const g = grantRewards(p, level.rewards);
      p = { ...p, ...g.patch };
      p = { ...p, story: { ...storyOf(p), rewarded: [...storyOf(p).rewarded, levelKey] } };
      outcome.levelRewards = g.granted;
    }
    const chapterKey = `chapter:${chapter.id}`;
    if (isChapterComplete(p, chapter) && !storyOf(p).rewarded.includes(chapterKey)) {
      const g = grantRewards(p, chapter.rewards);
      p = { ...p, ...g.patch };
      p = { ...p, story: { ...storyOf(p), rewarded: [...storyOf(p).rewarded, chapterKey] } };
      outcome.chapterComplete = true;
      outcome.chapterRewards = g.granted;
    }
  }
  // Chapters completed in order; never lower than an older save's count.
  const inOrder = STORY_CHAPTERS.findIndex((c) => !isChapterComplete(p, c));
  const completedCount = inOrder === -1 ? STORY_CHAPTERS.length : inOrder;
  const patch: Partial<Profile> = {
    story: p.story,
    storyChapter: Math.max(profile.storyChapter, completedCount),
    credits: p.credits,
    xp: p.xp,
    level: p.level,
    unlockedDecks: p.unlockedDecks,
    unlockedBoards: p.unlockedBoards,
    ownedVariants: p.ownedVariants,
    unlockedAchievements: p.unlockedAchievements,
  };
  return { patch, outcome };
}

/**
 * Marks a chapter's introduction as seen (so it is offered, not forced, next
 * time) and collects the evidence found in it.
 */
export function markIntroSeen(profile: Profile, chapterId: string): Partial<Profile> {
  const s = storyOf(profile);
  const found = discoveriesIn(getChapter(chapterId)?.intro ?? []).filter((id) => !(s.evidence ?? []).includes(id));
  if (s.introsSeen.includes(chapterId) && !found.length) return {};
  return {
    story: {
      ...s,
      introsSeen: s.introsSeen.includes(chapterId) ? s.introsSeen : [...s.introsSeen, chapterId],
      evidence: [...(s.evidence ?? []), ...found],
    },
  };
}

export function describeReward(
  r: StoryReward,
  names: { deck: (id: string) => string; board: (id: string) => string },
): string {
  switch (r.kind) {
    case 'credits':
      return `${r.amount} credits`;
    case 'xp':
      return `${r.amount} XP`;
    case 'deck':
      return `${names.deck(r.id)} deck`;
    case 'board':
      return `${names.board(r.id)} board`;
    case 'variant':
      return r.id === 'eastern_woodlands@turtle' ? 'Turtle Back card art' : 'Alternate card art';
    case 'stamp':
      return 'Passport stamp';
    case 'achievement':
      return `Achievement: ${ACHIEVEMENTS.find((a) => a.id === r.id)?.name ?? r.id}`;
    case 'evidence':
      return `Evidence: ${getEvidence(r.id)?.name ?? r.id}`;
  }
}
