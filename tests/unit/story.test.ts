import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, STAMPS, STORY_CHAPTERS, getChapter, type StoryLevel } from '@/story/campaign';
import {
  applyStoryResult,
  chapterProgress,
  emptyStoryProgress,
  grantRewards,
  isChapterUnlocked,
  isLevelUnlocked,
  nextLevel,
  objectiveMet,
  storyOf,
} from '@/story/progress';
import { goFishWinRate, simulateWar, verifySolitaire } from '@/story/verify';
import { createDefaultProfile } from '@/core/defaults';
import { Store } from '@/core/store';
import { allDecks } from '@/decks/registry';
import { allBoards } from '@/boards/registry';
import { getDeck } from '@/decks/registry';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { PERSONALITIES } from '@/games/cpu/personalities';
import { CHARACTERS, getCharacter } from '@/story/chapters';
import { recordGameResult, type GameResult } from '@/progression/results';
import { setActiveStoryLevel, takeStoryOutcome } from '@/story/session';
import { isDeckUnlocked } from '@/progression/levels';
import type { Profile } from '@/core/types';

const win = (level: StoryLevel, extra: Partial<GameResult> = {}): GameResult => ({
  gameId: level.game,
  outcome: 'win',
  durationMs: 60_000,
  score: level.game === 'go-fish' ? 7 : 100,
  details: level.game === 'go-fish' ? { books: 7 } : {},
  ...extra,
});

describe('campaign data', () => {
  it('has seven chapters of five challenges, in order, on the five games', () => {
    expect(STORY_CHAPTERS.map((c) => c.title)).toEqual([
      'The Hometown',
      'Jak Gold’s Casino',
      'Dante’s World',
      'The Woodlands',
      'The Safehouse',
      'The Builders',
      'Artist’s Alley',
    ]);
    for (const c of STORY_CHAPTERS) {
      expect(c.levels, c.id).toHaveLength(5);
      expect(c.levels.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
      expect(c.levels.at(-1)!.finale, c.id).toBe(true);
      // Every chapter has the required fields.
      for (const key of ['id', 'title', 'description', 'artwork', 'levels', 'rewards', 'unlockRequirements'])
        expect(c, `${c.id}.${key}`).toHaveProperty(key);
      // Each chapter visits several different games.
      expect(new Set(c.levels.map((l) => l.game)).size, c.id).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(ALL_LEVELS.map((l) => l.id)).size).toBe(35);
  });

  it('refers only to real decks, boards, opponents, characters and achievements', () => {
    const decks = new Set(allDecks().map((d) => d.id));
    const boards = new Set(allBoards().map((b) => b.id));
    const cpus = new Set(PERSONALITIES.map((p) => p.id));
    for (const c of STORY_CHAPTERS) {
      expect(getCharacter(c.hostId), c.id).toBeDefined();
      for (const line of [...c.intro, ...c.outro, ...c.levels.flatMap((l) => l.intro)])
        expect(getCharacter(line.who), `${c.id}: ${line.who}`).toBeDefined();
      for (const d of c.artwork.decks) expect(decks.has(d), d).toBe(true);
      for (const l of c.levels) {
        expect(decks.has(l.setup.deckId), `${l.id} deck`).toBe(true);
        expect(boards.has(l.setup.boardId), `${l.id} board`).toBe(true);
        for (const o of [l.setup.options?.opponent, ...(l.setup.options?.opponents ?? [])].filter(Boolean))
          expect(cpus.has(o!), `${l.id} opponent ${o}`).toBe(true);
      }
      for (const r of [...c.rewards, ...c.levels.flatMap((l) => l.rewards)]) {
        if (r.kind === 'deck') expect(decks.has(r.id), r.id).toBe(true);
        if (r.kind === 'board') expect(boards.has(r.id), r.id).toBe(true);
        if (r.kind === 'achievement')
          expect(
            ACHIEVEMENTS.some((a) => a.id === r.id),
            r.id,
          ).toBe(true);
        if (r.kind === 'variant') {
          const [deck, variant] = r.id.split('@');
          expect(
            getDeck(deck!).variants.some((v) => v.id === variant),
            r.id,
          ).toBe(true);
        }
      }
    }
    expect(CHARACTERS.length).toBeGreaterThan(0);
    expect(STAMPS).toHaveLength(7);
  });

  it('the Hometown rewards the Fredericksburg Collector deck', () => {
    expect(getChapter('chapter-1')!.rewards).toContainEqual({ kind: 'deck', id: 'fredericksburg_downtown' });
  });

  it('uses only artwork that exists, and labels the Builders placeholder', () => {
    const builders = getChapter('chapter-6')!;
    expect(builders.artwork.placeholder).toMatch(/coming soon/i);
    for (const c of STORY_CHAPTERS) {
      if (c.artwork.backdrop) expect(c.artwork.backdrop).toMatch(/^backgrounds\/.+\.webp$/);
      for (const d of c.artwork.decks) expect(getDeck(d).assets.status, `${c.id}: ${d}`).toBe('ready');
    }
  });
});

describe('every challenge can be won', () => {
  const solitaire = ALL_LEVELS.filter((l) => ['klondike', 'spider', 'freecell'].includes(l.game));
  const war = ALL_LEVELS.filter((l) => l.game === 'war');
  const goFish = ALL_LEVELS.filter((l) => l.game === 'go-fish');

  it('seeds every solitaire and War challenge; Go Fish deals fresh on each try', () => {
    for (const l of [...solitaire, ...war]) expect(l.setup.seed, l.id).toBeTypeOf('number');
    for (const l of goFish) expect(l.setup.seed, l.id).toBeUndefined();
    expect(solitaire.length + war.length + goFish.length).toBe(35);
  });

  it.each(solitaire.map((l) => [l.id, l] as const))(
    '%s: the solver wins this deal',
    (_, level) => {
      const r = verifySolitaire(level, 250_000);
      expect(r.solved, `${level.id} (${r.nodes} positions)`).toBe(true);
      expect(r.replayed, 'the winning line replays on a fresh deal').toBe(true);
    },
    60_000,
  );

  it.each(war.map((l) => [l.id, l] as const))('%s: the seeded War is a player win', (_, level) => {
    const r = simulateWar(level.setup.seed!, level.setup.options?.opponent);
    expect(r.status).toBe('won');
    expect(r.rounds).toBeLessThan(400);
  });

  it.each(goFish.map((l) => [l.id, l] as const))(
    '%s: the objective is regularly reachable',
    (_, level) => {
      expect(level.setup.options?.difficulty).toBe('easy');
      // A sensible player meets it on a good share of fresh deals; retries are unlimited.
      expect(goFishWinRate(level, 40)).toBeGreaterThanOrEqual(0.25);
    },
    60_000,
  );
});

describe('progress and unlocks', () => {
  const fresh = (over: Partial<Profile> = {}): Profile => ({ ...createDefaultProfile(), ...over });

  it('opens chapters and levels in order', () => {
    const p = fresh();
    expect(isChapterUnlocked(p, STORY_CHAPTERS[0]!)).toBe(true);
    expect(isChapterUnlocked(p, STORY_CHAPTERS[1]!)).toBe(false);
    const ch1 = STORY_CHAPTERS[0]!;
    expect(isLevelUnlocked(p, ch1.levels[0]!)).toBe(true);
    expect(isLevelUnlocked(p, ch1.levels[1]!)).toBe(false);
    const after = { ...p, story: { ...emptyStoryProgress(), completed: ['chapter-1-1'] } };
    expect(isLevelUnlocked(after, ch1.levels[1]!)).toBe(true);
    expect(nextLevel(after, ch1)!.id).toBe('chapter-1-2');
  });

  it('keeps chapters open for saves made before the campaign', () => {
    // An older save that recorded chapters through `storyChapter` only.
    const legacy = fresh({ storyChapter: 3 });
    delete (legacy as Partial<Profile>).story;
    expect(storyOf(legacy).completed).toEqual([]);
    expect(isChapterUnlocked(legacy, STORY_CHAPTERS[3]!)).toBe(true);
    expect(isChapterUnlocked(legacy, STORY_CHAPTERS[4]!)).toBe(false);
  });

  it('checks objectives against the finished game', () => {
    const ch1 = STORY_CHAPTERS[0]!;
    expect(objectiveMet(ch1.levels[0]!, win(ch1.levels[0]!))).toBe(true);
    expect(objectiveMet(ch1.levels[0]!, win(ch1.levels[0]!, { outcome: 'loss' }))).toBe(false);
    expect(objectiveMet(ch1.levels[0]!, { ...win(ch1.levels[0]!), gameId: 'klondike' })).toBe(false);
    const books = ALL_LEVELS.find((l) => l.objective.kind === 'books')!;
    expect(objectiveMet(books, { ...win(books, { outcome: 'loss', score: 3, details: { books: 3 } }) })).toBe(true);
    expect(objectiveMet(books, { ...win(books, { outcome: 'loss', score: 1, details: { books: 1 } }) })).toBe(false);
  });
});

describe('rewards', () => {
  it('grants each level’s and chapter’s rewards exactly once', () => {
    let p = createDefaultProfile();
    const ch1 = STORY_CHAPTERS[0]!;
    const startCredits = p.credits;
    for (const level of ch1.levels) {
      const { patch, outcome } = applyStoryResult(p, level.id, win(level));
      p = { ...p, ...patch };
      expect(outcome.met).toBe(true);
      expect(outcome.firstClear).toBe(true);
      expect(outcome.levelRewards.length).toBeGreaterThan(0);
      expect(outcome.chapterComplete).toBe(level.finale === true);
    }
    expect(chapterProgress(p, ch1)).toEqual({ done: 5, total: 5 });
    expect(p.unlockedDecks).toContain('fredericksburg_downtown');
    expect(p.unlockedBoards).toContain('rappahannock_riverside');
    expect(storyOf(p).stamps).toEqual(['hometown']);
    expect(p.unlockedAchievements).toContain('passport-first');
    expect(p.storyChapter).toBe(1);
    expect(isDeckUnlocked('fredericksburg_downtown', p)).toBe(true);
    const creditsAfter = p.credits;
    expect(creditsAfter).toBeGreaterThan(startCredits);

    // Replaying everything pays nothing more.
    for (const level of ch1.levels) {
      const { patch, outcome } = applyStoryResult(p, level.id, win(level));
      p = { ...p, ...patch };
      expect(outcome.firstClear).toBe(false);
      expect(outcome.levelRewards).toEqual([]);
      expect(outcome.chapterRewards).toEqual([]);
    }
    expect(p.credits).toBe(creditsAfter);
    expect(storyOf(p).stamps).toEqual(['hometown']);
    expect(p.unlockedDecks.filter((d) => d === 'fredericksburg_downtown')).toHaveLength(1);
  });

  it('a failed attempt counts as a try and pays nothing; it can be retried', () => {
    const level = STORY_CHAPTERS[0]!.levels[0]!;
    let p = createDefaultProfile();
    const lost = applyStoryResult(p, level.id, win(level, { outcome: 'loss' }));
    p = { ...p, ...lost.patch };
    expect(lost.outcome.met).toBe(false);
    expect(lost.outcome.levelRewards).toEqual([]);
    expect(p.credits).toBe(createDefaultProfile().credits);
    const retry = applyStoryResult(p, level.id, win(level));
    expect(retry.outcome.met).toBe(true);
    expect(retry.outcome.attempts).toBe(2);
  });

  it('does not grant what is already owned', () => {
    const p = { ...createDefaultProfile(), unlockedDecks: ['classic', 'jak_gold'] };
    const { granted } = grantRewards(p, [
      { kind: 'deck', id: 'jak_gold' },
      { kind: 'board', id: 'jak_golds_casino' },
    ]);
    expect(granted).toEqual([{ kind: 'board', id: 'jak_golds_casino' }]);
  });

  it('finishing the whole campaign stamps the passport seven times', () => {
    let p = createDefaultProfile();
    for (const level of ALL_LEVELS) p = { ...p, ...applyStoryResult(p, level.id, win(level)).patch };
    expect(storyOf(p).stamps).toHaveLength(7);
    expect(p.storyChapter).toBe(7);
    expect(p.unlockedAchievements).toEqual(
      expect.arrayContaining(['passport-first', 'halfway-home', 'chronicles-complete']),
    );
    expect(p.ownedVariants).toContain('eastern_woodlands@turtle');
  });

  it('a finished story game is scored through the normal results, and persists', () => {
    const store = new Store();
    const level = STORY_CHAPTERS[0]!.levels[0]!;
    setActiveStoryLevel(level.id);
    const summary = recordGameResult(store, win(level));
    setActiveStoryLevel(null);
    expect(summary.story?.met).toBe(true);
    expect(takeStoryOutcome()?.levelId).toBe(level.id);
    expect(storyOf(store.state.profile).completed).toContain(level.id);
    // The profile (with story progress) survives a save → load round trip.
    const saved = JSON.parse(JSON.stringify(store.state.profile)) as Profile;
    const reloaded = new Store();
    reloaded.dispatch({ type: 'HYDRATE', profile: saved });
    expect(storyOf(reloaded.state.profile).completed).toContain(level.id);
    expect(storyOf(reloaded.state.profile).rewarded).toContain(`level:${level.id}`);
  });

  it('hydrating a pre-campaign save keeps its data and adds empty story progress', () => {
    const old = createDefaultProfile() as Partial<Profile>;
    delete old.story;
    const s = new Store();
    s.dispatch({ type: 'HYDRATE', profile: { ...old, credits: 999, storyChapter: 2 } });
    expect(s.state.profile.credits).toBe(999);
    expect(s.state.profile.storyChapter).toBe(2);
    expect(s.state.profile.story).toEqual(emptyStoryProgress());
  });
});
