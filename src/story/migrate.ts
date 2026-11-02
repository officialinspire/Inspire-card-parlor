import type { LegacyStoryArchive, Profile, StoryProgress } from '@/core/types';
import { CAMPAIGN_ID, CAMPAIGN_VERSION } from './ids';

/**
 * Story progress migration: The Card Parlor Chronicles → The Thirteenth Hand.
 *
 * The two campaigns' chapters mean different things, so a first-campaign win
 * is never treated as a win in the new one. The plan:
 *
 *  1. A save whose `story` has no campaign marker (or a pre-campaign save
 *     with chapters counted in `storyChapter`) holds first-campaign progress.
 *     It is copied, unchanged, into `legacyStory`.
 *  2. `story` starts fresh for The Thirteenth Hand, stamped with the campaign
 *     id and data version, and `storyChapter` restarts at 0 (it counts the
 *     current campaign's chapters).
 *  3. Nothing else is touched: decks, boards, art, credits, XP, level and
 *     achievements earned in the first campaign stay owned.
 *  4. Unlock rules that used to read an old chapter keep honouring it through
 *     the archive (src/progression/levels.ts), and first-campaign clears still
 *     count toward the general "clear N challenges" achievements.
 *
 * The migration is idempotent: an archive is never overwritten, and progress
 * already marked for this campaign is left alone.
 */

type StoredStory = Partial<StoryProgress>;
type MigratableProfile = Partial<Profile>;

export function emptyCampaignProgress(): StoryProgress {
  return {
    campaign: CAMPAIGN_ID,
    version: CAMPAIGN_VERSION,
    completed: [],
    rewarded: [],
    stamps: [],
    introsSeen: [],
    attempts: {},
    evidence: [],
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
const counts = (v: unknown): Record<string, number> =>
  v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number'))
    : {};

/** True when stored story progress was recorded for the first campaign. */
export function isLegacyStory(story: StoredStory | undefined): boolean {
  return !!story && story.campaign !== CAMPAIGN_ID;
}

/** Applies the plan above to a stored profile (in place on a copy). */
export function migrateStoryProgress(profile: MigratableProfile, now = Date.now()): MigratableProfile {
  const out: MigratableProfile = { ...profile };
  const story = profile.story;
  const legacyCount = typeof profile.storyChapter === 'number' ? profile.storyChapter : 0;
  // `storyChapter` only means first-campaign chapters when the story block is not this
  // campaign's (or is missing, in saves from before any campaign); after migration it
  // counts this campaign's chapters and must never be archived again.
  const legacyStory = story ? isLegacyStory(story) : legacyCount > 0;
  const legacyProgress =
    legacyStory &&
    (legacyCount > 0 ||
      strings(story?.completed).length > 0 ||
      strings(story?.rewarded).length > 0 ||
      strings(story?.stamps).length > 0 ||
      Object.keys(counts(story?.attempts)).length > 0);
  if (legacyStory) {
    // Archive only real progress; an untouched first-campaign block just starts fresh.
    if (legacyProgress && !out.legacyStory) {
      const archive: LegacyStoryArchive = {
        campaign: 'card-parlor-chronicles',
        chaptersCompleted: legacyCount,
        completed: strings(story?.completed),
        rewarded: strings(story?.rewarded),
        stamps: strings(story?.stamps),
        introsSeen: strings(story?.introsSeen),
        attempts: counts(story?.attempts),
        archivedAt: now,
      };
      out.legacyStory = archive;
    }
    out.story = emptyCampaignProgress();
    out.storyChapter = 0;
  } else if (story) {
    // Already this campaign's: fill any fields an older build of it did not write, then
    // bring older data versions up to date.
    out.story = upgradeCampaignVersion({ ...emptyCampaignProgress(), ...story, version: story.version ?? 1 });
  }
  return out;
}

/**
 * Campaign data version 1 → 2: Chapter 2's challenges were put in a new order
 * (Go Fish, Klondike, FreeCell, Spider, War). Each saved challenge keeps its
 * meaning: ids are remapped by game, not by position, in completed challenges,
 * paid rewards and attempts, so no win is lost and nothing is paid twice.
 * The river-map clue was renamed for Sophia's annotated map.
 */
const V2_LEVELS: Record<string, string> = {
  'th-2-1': 'th-2-2', // Klondike
  'th-2-2': 'th-2-5', // War
  'th-2-3': 'th-2-1', // Go Fish
  'th-2-4': 'th-2-3', // FreeCell
  'th-2-5': 'th-2-4', // Spider
};
const V2_EVIDENCE: Record<string, string> = { 'old-river-map': 'sophia-river-map' };

export function upgradeCampaignVersion(story: StoryProgress): StoryProgress {
  if ((story.version ?? 1) >= CAMPAIGN_VERSION) return story;
  let s = story;
  if ((s.version ?? 1) < 2) {
    const level = (id: string) => V2_LEVELS[id] ?? id;
    s = {
      ...s,
      completed: [...new Set(s.completed.map(level))],
      rewarded: [...new Set(s.rewarded.map((k) => (k.startsWith('level:') ? `level:${level(k.slice(6))}` : k)))],
      attempts: Object.fromEntries(Object.entries(s.attempts).map(([id, n]) => [level(id), n])),
      evidence: [...new Set((s.evidence ?? []).map((id) => V2_EVIDENCE[id] ?? id))],
      version: 2,
    };
  }
  return { ...s, version: CAMPAIGN_VERSION };
}
