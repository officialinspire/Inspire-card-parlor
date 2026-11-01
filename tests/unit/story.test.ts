import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ALL_LEVELS,
  CAMPAIGN_ID,
  CAMPAIGN_VERSION,
  STAMPS,
  STORY_CHAPTERS,
  discoveriesIn,
  getChapter,
  NARRATOR,
  type DialogueLine,
  type StoryLevel,
} from '@/story/campaign';
import {
  applyStoryResult,
  chapterProgress,
  emptyStoryProgress,
  grantRewards,
  isChapterUnlocked,
  isLevelUnlocked,
  markIntroSeen,
  nextLevel,
  objectiveMet,
  storyOf,
} from '@/story/progress';
import { goFishWinRate, simulateWar, verifySolitaire } from '@/story/verify';
import { createDefaultProfile, PROFILE_SCHEMA } from '@/core/defaults';
import { Store } from '@/core/store';
import { allDecks } from '@/decks/registry';
import { allBoards, getBoard } from '@/boards/registry';
import { getDeck } from '@/decks/registry';
import { ACHIEVEMENTS } from '@/achievements/registry';
import { buildFacts } from '@/achievements/facts';
import { unlockEarned } from '@/achievements/engine';
import { PERSONALITIES, STORY_OPPONENTS, getPersonality } from '@/games/cpu/personalities';
import { CHARACTERS, getCharacter } from '@/story/chapters';
import { LOCATIONS, getLocation } from '@/story/locations';
import { EVIDENCE, getEvidence } from '@/story/evidence';
import { LEGACY_CHAPTERS, LEGACY_LEVEL_IDS } from '@/story/legacy';
import { migrateStoryProgress } from '@/story/migrate';
import { migrateProfile } from '@/storage/persistence';
import { ALL_TRACKS } from '@/audio/tracks';
import { recordGameResult, type GameResult } from '@/progression/results';
import { setActiveStoryLevel, takeStoryOutcome } from '@/story/session';
import { isBoardUnlocked, isDeckUnlocked } from '@/progression/levels';
import type { Profile } from '@/core/types';

const win = (level: StoryLevel, extra: Partial<GameResult> = {}): GameResult => ({
  gameId: level.game,
  outcome: 'win',
  durationMs: 60_000,
  score: level.game === 'go-fish' ? 7 : 100,
  details: level.game === 'go-fish' ? { books: 7 } : {},
  ...extra,
});

/** Every scene in the campaign, with where it is. */
const scenes = (): { where: string; lines: DialogueLine[] }[] =>
  STORY_CHAPTERS.flatMap((c) => [
    { where: `${c.id} intro`, lines: c.intro },
    { where: `${c.id} outro`, lines: c.outro },
    ...c.levels.flatMap((l) => [
      { where: `${l.id} intro`, lines: l.intro },
      { where: `${l.id} outro`, lines: l.outro },
    ]),
  ]);

const sprites = new Set(
  (
    JSON.parse(readFileSync('public/assets/story/manifest.json', 'utf8')) as {
      sheets: { id: string; sprites: { id: string }[] }[];
    }
  ).sheets.flatMap((s) => s.sprites.map((x) => x.id)),
);
const sheets = new Set(
  (JSON.parse(readFileSync('public/assets/story/manifest.json', 'utf8')) as { sheets: { id: string }[] }).sheets.map(
    (s) => s.id,
  ),
);

/** A first-campaign save, as stored by the previous build (schema 2). */
const legacySave = () => ({
  ...createDefaultProfile(),
  schemaVersion: 2,
  credits: 1234,
  level: 9,
  storyChapter: 2,
  unlockedDecks: ['classic', 'inspire', 'fredericksburg_downtown', 'jak_gold'],
  unlockedBoards: ['backroom_card_table', 'picnic_table', 'rappahannock_riverside', 'jak_golds_casino'],
  unlockedAchievements: ['story-start', 'story-ch1', 'passport-first', 'story-ch2'],
  story: {
    completed: [...LEGACY_LEVEL_IDS.slice(0, 10), 'chapter-3-1'],
    rewarded: ['level:chapter-1-1', 'chapter:chapter-1', 'chapter:chapter-2'],
    stamps: ['hometown', 'casino'],
    introsSeen: ['chapter-1', 'chapter-2', 'chapter-3'],
    attempts: { 'chapter-1-1': 1, 'chapter-1-2': 3, 'chapter-3-1': 1 },
  },
});

describe('campaign structure', () => {
  it('has nine chapters of five challenges, in order, on the five games', () => {
    expect(STORY_CHAPTERS).toHaveLength(9);
    expect(STORY_CHAPTERS.map((c) => c.location)).toEqual([
      'Cheryl’s Antique Shop',
      'Rappahannock River Station',
      'iSMOKESHOP',
      'Jak’s Backroom Card Parlor',
      'Mrs. Gray’s Intelligence Safehouse',
      'Fredericksburg Masonic Lodge No. 4',
      'Kenmore',
      'The Underground Tunnels',
      'Washington’s Spectral Card Parlor',
    ]);
    STORY_CHAPTERS.forEach((c, i) => {
      expect(c.id).toBe(`th-${i + 1}`);
      expect(c.index).toBe(i + 1);
      expect(c.levels, c.id).toHaveLength(5);
      expect(c.levels.map((l) => l.number)).toEqual([1, 2, 3, 4, 5]);
      expect(c.levels.map((l) => l.id)).toEqual([1, 2, 3, 4, 5].map((n) => `${c.id}-${n}`));
      expect(c.levels.at(-1)!.finale, c.id).toBe(true);
      expect(
        c.levels.filter((l) => l.finale),
        c.id,
      ).toHaveLength(1);
      // Each chapter plays all five games once.
      expect(new Set(c.levels.map((l) => l.game)).size, c.id).toBe(5);
      expect(c.beats.length, c.id).toBeGreaterThanOrEqual(4);
      expect(c.mysteryThread.length, c.id).toBeGreaterThan(20);
      expect(c.unlockRequirements).toEqual(i === 0 ? {} : { chapter: `th-${i}` });
    });
    expect(new Set(ALL_LEVELS.map((l) => l.id)).size).toBe(45);
  });

  it('never reuses a first-campaign id', () => {
    for (const l of ALL_LEVELS) expect(LEGACY_LEVEL_IDS).not.toContain(l.id);
    for (const c of STORY_CHAPTERS) expect(LEGACY_CHAPTERS.map((x) => x.id)).not.toContain(c.id);
    for (const s of STAMPS) expect(LEGACY_CHAPTERS.map((x) => x.stamp)).not.toContain(s.id);
  });

  it('writes chapters 1–2 in full and marks chapters 3–9 as drafts', () => {
    expect(STORY_CHAPTERS.map((c) => c.status)).toEqual([
      'final',
      'final',
      'draft',
      'draft',
      'draft',
      'draft',
      'draft',
      'draft',
      'draft',
    ]);
    for (const c of STORY_CHAPTERS) {
      const lines = [c.intro, c.outro, ...c.levels.flatMap((l) => [l.intro, l.outro])].flat();
      if (c.status === 'final') {
        // Written scenes: no draft text, and the host actually speaks.
        expect(
          lines.some((l) => l.status === 'draft'),
          c.id,
        ).toBe(false);
        expect(
          c.intro.some((l) => l.who === c.hostId),
          c.id,
        ).toBe(true);
        for (const l of c.levels) expect(l.intro.length, l.id).toBeGreaterThan(0);
      } else {
        // Outlines: short narration only, every line labelled, no invented character dialogue.
        for (const l of lines) {
          expect(l.status, `${c.id}: ${l.text}`).toBe('draft');
          expect(l.who, `${c.id}: ${l.text}`).toBe(NARRATOR);
          expect(l.text.length, l.text).toBeLessThanOrEqual(140);
        }
        expect(c.artwork.placeholder, c.id).toBeTruthy();
      }
    }
  });
});

describe('the silent observer', () => {
  it('never gives the player a line, and narrates in the second person', () => {
    const ids = new Set(CHARACTERS.map((c) => c.id));
    for (const { where, lines } of scenes())
      for (const line of lines) {
        expect(ids.has(line.who), `${where}: ${line.who}`).toBe(true);
        expect(['player', 'you', 'me'], where).not.toContain(line.who.toLowerCase());
        if (line.who === NARRATOR) {
          expect(line.narration, where).toBe(true);
          expect(line.text, where).toMatch(/\b(you|your)\b/i);
          // Narration describes; it never quotes the player.
          expect(line.text, where).not.toMatch(/\byou (say|said|ask|asked|reply|replied|tell|told)\b/i);
        }
      }
  });

  it('has no player character in the cast', () => {
    expect(CHARACTERS.some((c) => /player|protagonist/i.test(`${c.id} ${c.role}`))).toBe(false);
  });
});

describe('references', () => {
  it('refers only to real decks, boards, opponents, characters, achievements, evidence and tracks', () => {
    const decks = new Set(allDecks().map((d) => d.id));
    const boards = new Set(allBoards().map((b) => b.id));
    const cpus = new Set([...PERSONALITIES, ...STORY_OPPONENTS].map((p) => p.id));
    const tracks = new Set(ALL_TRACKS.map((t) => t.id));
    for (const c of STORY_CHAPTERS) {
      expect(getCharacter(c.hostId), c.id).toBeDefined();
      for (const who of c.cast) expect(getCharacter(who), `${c.id} cast ${who}`).toBeDefined();
      expect(getLocation(c.locationId), c.id).toBeDefined();
      expect(getLocation(c.locationId)!.name).toBe(c.location);
      expect(tracks.has(c.music), `${c.id} music ${c.music}`).toBe(true);
      for (const d of c.artwork.decks) expect(decks.has(d), d).toBe(true);
      if (c.artwork.locationSprite) expect(sprites.has(c.artwork.locationSprite), c.artwork.locationSprite).toBe(true);
      for (const l of c.levels) {
        expect(decks.has(l.setup.deckId), `${l.id} deck`).toBe(true);
        expect(boards.has(l.setup.boardId), `${l.id} board`).toBe(true);
        for (const o of [l.setup.options?.opponent, ...(l.setup.options?.opponents ?? [])].filter(Boolean)) {
          expect(cpus.has(o!), `${l.id} opponent ${o}`).toBe(true);
          expect(getPersonality(o).id, `${l.id} opponent ${o}`).toBe(o);
        }
      }
      for (const r of [...c.rewards, ...c.levels.flatMap((l) => l.rewards)]) {
        if (r.kind === 'deck') expect(decks.has(r.id), r.id).toBe(true);
        if (r.kind === 'board') expect(boards.has(r.id), r.id).toBe(true);
        if (r.kind === 'achievement')
          expect(
            ACHIEVEMENTS.some((a) => a.id === r.id),
            r.id,
          ).toBe(true);
        if (r.kind === 'evidence') expect(getEvidence(r.id), r.id).toBeDefined();
        if (r.kind === 'stamp')
          expect(
            STAMPS.some((s) => s.id === r.id),
            r.id,
          ).toBe(true);
        if (r.kind === 'variant') {
          const [deck, variant] = r.id.split('@');
          expect(
            getDeck(deck!).variants.some((v) => v.id === variant),
            r.id,
          ).toBe(true);
        }
        if (r.kind === 'credits' || r.kind === 'xp') expect(r.amount).toBeGreaterThan(0);
      }
    }
    for (const { where, lines } of scenes())
      for (const line of lines) {
        if (line.discovers) expect(getEvidence(line.discovers), `${where}: ${line.discovers}`).toBeDefined();
        if (line.pose && line.who !== NARRATOR) {
          const sheet = getCharacter(line.who)?.portrait?.sheet;
          if (sheet) expect(sprites.has(`${sheet}/${line.pose}`), `${where}: ${sheet}/${line.pose}`).toBe(true);
        }
      }
  });

  it('gives every chapter one passport stamp, with artwork', () => {
    expect(STAMPS).toHaveLength(9);
    expect(STAMPS.map((s) => s.chapter)).toEqual(STORY_CHAPTERS.map((c) => c.id));
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(9);
    for (const s of STAMPS) expect(sprites.has(s.sprite), s.sprite).toBe(true);
  });

  it('has no duplicate one-time rewards anywhere in the campaign', () => {
    const once = (kinds: string[]) =>
      STORY_CHAPTERS.flatMap((c) => [...c.rewards, ...c.levels.flatMap((l) => l.rewards)])
        .filter((r) => kinds.includes(r.kind))
        .map((r) => `${r.kind}:${(r as { id: string }).id}`);
    for (const kinds of [['stamp'], ['evidence'], ['achievement'], ['deck'], ['board'], ['variant']]) {
      const list = once(kinds);
      expect(new Set(list).size, kinds[0]).toBe(list.length);
    }
  });

  it('collects every piece of evidence exactly once, in its own chapter', () => {
    const found = STORY_CHAPTERS.flatMap((c) =>
      [c.intro, c.outro, ...c.levels.flatMap((l) => [l.intro, l.outro])].flatMap((lines) =>
        discoveriesIn(lines).map((id) => ({ id, chapter: c.id })),
      ),
    );
    expect(found.map((f) => f.id).sort()).toEqual(EVIDENCE.map((e) => e.id).sort());
    for (const f of found) expect(getEvidence(f.id)!.chapter, f.id).toBe(f.chapter);
    for (const e of EVIDENCE) if (e.sprite) expect(sprites.has(e.sprite), e.sprite).toBe(true);
    // The four suit marks are found before the tunnels.
    for (const id of ['club-mark', 'heart-mark', 'diamond-mark', 'spade-mark'])
      expect(Number(getEvidence(id)!.chapter.slice(3)), id).toBeLessThan(8);
    // Written chapters' evidence is final; outlines' is draft.
    for (const e of EVIDENCE) expect(e.status, e.id).toBe(getChapter(e.chapter)!.status);
  });

  it('casts real characters, each with a portrait sheet that exists (or none yet) and a theme', () => {
    const tracks = new Set(ALL_TRACKS.map((t) => t.id));
    for (const c of CHARACTERS.filter((x) => x.id !== NARRATOR)) {
      expect(c.portrait, c.id).toBeDefined();
      if (c.portrait!.sheet) {
        expect(sheets.has(c.portrait!.sheet), c.id).toBe(true);
        expect(sprites.has(`${c.portrait!.sheet}/${c.portrait!.pose}`), c.id).toBe(true);
      }
      expect(tracks.has(c.music!), `${c.id} music`).toBe(true);
      expect(getPersonality(c.opponentId).id, `${c.id} opponent`).toBe(c.opponentId);
    }
    // Jak has no sprite sheet yet; it is recorded, not faked.
    expect(getCharacter('jak_gold')!.portrait!.sheet).toBeNull();
  });

  it('keeps story opponents out of Quick Play, with draft table talk labelled', () => {
    const quickPlay = PERSONALITIES.map((p) => p.id);
    for (const p of STORY_OPPONENTS) expect(quickPlay).not.toContain(p.id);
    expect(STORY_OPPONENTS.filter((p) => p.linesStatus === 'final').map((p) => p.id)).toEqual(['cheryl', 'sophia']);
    for (const p of STORY_OPPONENTS)
      for (const lines of Object.values(p.lines)) if (Array.isArray(lines)) expect(lines.length).toBeGreaterThan(0);
  });
});

describe('history and fiction', () => {
  it('labels every location as real, fictional or supernatural, and says what is invented', () => {
    expect(LOCATIONS).toHaveLength(9);
    for (const l of LOCATIONS) {
      expect(getBoard(l.boardId), l.id).toBeDefined();
      if (l.sprite) expect(sprites.has(l.sprite), l.sprite).toBe(true);
      // Every location has a fiction note: even real places host invented scenes.
      expect(
        l.notes.some((n) => n.kind === 'fiction'),
        l.id,
      ).toBe(true);
      for (const n of l.notes) if (n.kind === 'history') expect(n.source, `${l.id}: ${n.title}`).toBeTruthy();
    }
    expect(getLocation('masonic-lodge-no4')!.kind).toBe('real');
    expect(getLocation('kenmore')!.kind).toBe('real');
    for (const id of ['underground-tunnels', 'mrs-gray-safehouse']) expect(getLocation(id)!.kind).toBe('fictional');
    expect(getLocation('washington-spectral-parlor')!.kind).toBe('supernatural');
  });

  it('presents the operation, the tunnels and the ghosts as fiction, never as documented history', () => {
    const history = LOCATIONS.flatMap((l) => l.notes.filter((n) => n.kind === 'history'));
    for (const n of history) expect(n.text, n.title).not.toMatch(/thirteenth hand|tunnel|ghost|operation/i);
    const fiction = (id: string) =>
      getLocation(id)!
        .notes.filter((n) => n.kind === 'fiction')
        .map((n) => n.text)
        .join(' ');
    expect(fiction('mrs-gray-safehouse')).toMatch(/fictional|not a real/i);
    expect(fiction('underground-tunnels')).toMatch(/invented/i);
    expect(fiction('masonic-lodge-no4')).toMatch(/invented/i);
    // Kenmore was Betty and Fielding Lewis's home; Mary Ball Washington lived elsewhere.
    const kenmore = getLocation('kenmore')!
      .notes.map((n) => n.text)
      .join(' ');
    expect(kenmore).toMatch(/Fielding Lewis/);
    expect(kenmore).toMatch(/did not live at Kenmore/);
    expect(getCharacter('mary_ball_washington')!.supernatural).toBe(true);
    expect(getCharacter('george_washington')!.supernatural).toBe(true);
  });
});

describe('every challenge can be won', () => {
  const solitaire = ALL_LEVELS.filter((l) => ['klondike', 'spider', 'freecell'].includes(l.game));
  const war = ALL_LEVELS.filter((l) => l.game === 'war');
  const goFish = ALL_LEVELS.filter((l) => l.game === 'go-fish');

  it('seeds every solitaire and War challenge; Go Fish deals fresh on each try', () => {
    for (const l of [...solitaire, ...war]) expect(l.setup.seed, l.id).toBeTypeOf('number');
    for (const l of goFish) expect(l.setup.seed, l.id).toBeUndefined();
    expect(solitaire.length + war.length + goFish.length).toBe(45);
    // Only configurations the engines support.
    for (const l of ALL_LEVELS) {
      const o = l.setup.options ?? {};
      if (l.game === 'klondike') expect([1, 3]).toContain(o.draw);
      if (l.game === 'spider') expect([1, 2, 4]).toContain(o.suits);
      if (l.game === 'war') expect(o.opponent, l.id).toBeTruthy();
      if (l.game === 'go-fish') {
        expect(o.opponents?.length, l.id).toBeGreaterThanOrEqual(1);
        expect(o.opponents!.length, l.id).toBeLessThanOrEqual(3);
        expect(new Set(o.opponents).size, l.id).toBe(o.opponents!.length);
      }
      if (l.objective.kind === 'books') expect(l.game).toBe('go-fish');
    }
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
    const after = { ...p, story: { ...emptyStoryProgress(), completed: ['th-1-1'] } };
    expect(isLevelUnlocked(after, ch1.levels[1]!)).toBe(true);
    expect(nextLevel(after, ch1)!.id).toBe('th-1-2');
  });

  it('unlocks each chapter only when the one before is finished, all the way to the finale', () => {
    let p = fresh();
    for (const [i, chapter] of STORY_CHAPTERS.entries()) {
      expect(isChapterUnlocked(p, chapter), chapter.id).toBe(true);
      if (STORY_CHAPTERS[i + 1]) expect(isChapterUnlocked(p, STORY_CHAPTERS[i + 1]!), chapter.id).toBe(false);
      for (const level of chapter.levels) {
        expect(isLevelUnlocked(p, level), level.id).toBe(true);
        p = { ...p, ...applyStoryResult(p, level.id, win(level)).patch };
      }
      expect(p.storyChapter).toBe(i + 1);
    }
  });

  it('a chapter count alone (as old saves kept it) opens nothing', () => {
    const p = fresh({ storyChapter: 5 });
    expect(isChapterUnlocked(p, STORY_CHAPTERS[1]!)).toBe(false);
    expect(isLevelUnlocked(p, STORY_CHAPTERS[0]!.levels[1]!)).toBe(false);
  });

  it('checks objectives against the finished game', () => {
    const l1 = STORY_CHAPTERS[0]!.levels[0]!;
    expect(objectiveMet(l1, win(l1))).toBe(true);
    expect(objectiveMet(l1, win(l1, { outcome: 'loss' }))).toBe(false);
    expect(objectiveMet(l1, { ...win(l1), gameId: 'klondike' })).toBe(false);
    const books = ALL_LEVELS.find((l) => l.objective.kind === 'books')!;
    expect(objectiveMet(books, win(books, { outcome: 'loss', score: 3, details: { books: 3 } }))).toBe(true);
    expect(objectiveMet(books, win(books, { outcome: 'loss', score: 1, details: { books: 1 } }))).toBe(false);
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
    expect(p.unlockedBoards).toContain('cheryls_antique_shop');
    expect(storyOf(p).stamps).toEqual(['th-antique-shop']);
    expect(storyOf(p).evidence).toEqual(['estate-sale-receipt', 'ledger-of-twelve', 'river-postcard']);
    // Story achievements are unlocked by the achievement engine (once, with a date).
    p = { ...p, ...unlockEarned(p).patch };
    expect(p.unlockedAchievements.filter((a) => a === 'passport-first')).toHaveLength(1);
    expect(p.storyChapter).toBe(1);
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
    expect(unlockEarned(p).earned).not.toContain('passport-first');
    expect(storyOf(p).stamps).toEqual(['th-antique-shop']);
    expect(storyOf(p).evidence).toHaveLength(3);
    expect(p.unlockedBoards.filter((b) => b === 'cheryls_antique_shop')).toHaveLength(1);
  });

  it('collects intro evidence once, when the chapter introduction is seen', () => {
    let p = createDefaultProfile();
    p = { ...p, ...markIntroSeen(p, 'th-1') };
    expect(storyOf(p).evidence).toEqual(['thirteenth-hand-card']);
    expect(storyOf(p).introsSeen).toEqual(['th-1']);
    expect(markIntroSeen(p, 'th-1')).toEqual({});
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
      { kind: 'evidence', id: 'club-mark' },
      { kind: 'evidence', id: 'not-a-real-clue' },
    ]);
    expect(granted).toEqual([
      { kind: 'board', id: 'jak_golds_casino' },
      { kind: 'evidence', id: 'club-mark' },
    ]);
  });

  it('finishing the whole campaign stamps the passport nine times and earns the finale', () => {
    let p = createDefaultProfile();
    for (const level of ALL_LEVELS) p = { ...p, ...applyStoryResult(p, level.id, win(level)).patch };
    expect(storyOf(p).stamps).toEqual(STAMPS.map((s) => s.id));
    expect(p.storyChapter).toBe(9);
    p = { ...p, ...unlockEarned(p).patch };
    expect(p.unlockedAchievements).toEqual(
      expect.arrayContaining(['passport-first', 'halfway-home', 'chronicles-complete', 'story-35']),
    );
    for (const id of ['washington_ghost', 'dantes_world', 'freemasonry', 'eastern_woodlands'])
      expect(isDeckUnlocked(id, p), id).toBe(true);
    for (const id of ['washington_final_table', 'underground_tunnels', 'kenmore_parlor'])
      expect(isBoardUnlocked(id, p), id).toBe(true);
    // Every reward id appears once in the profile.
    for (const list of [p.unlockedDecks, p.unlockedBoards, p.unlockedAchievements, storyOf(p).stamps])
      expect(new Set(list).size).toBe(list.length);
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
    // The profile (with story progress) survives a save → load round trip, migration included.
    const saved = JSON.parse(JSON.stringify(store.state.profile)) as Profile;
    const reloaded = new Store();
    reloaded.dispatch({ type: 'HYDRATE', profile: migrateProfile(saved) });
    const story = storyOf(reloaded.state.profile);
    expect(story.campaign).toBe(CAMPAIGN_ID);
    expect(story.completed).toContain(level.id);
    expect(story.rewarded).toContain(`level:${level.id}`);
    expect(story.evidence).toContain('estate-sale-receipt');
    expect(reloaded.state.profile.legacyStory).toBeUndefined();
  });
});

describe('migrating first-campaign saves', () => {
  it('archives old progress unchanged and starts The Thirteenth Hand fresh', () => {
    const old = legacySave();
    const m = migrateProfile(old as unknown as Profile) as Profile;
    expect(m.schemaVersion).toBe(PROFILE_SCHEMA);
    expect(m.legacyStory).toMatchObject({
      campaign: 'card-parlor-chronicles',
      chaptersCompleted: 2,
      completed: old.story.completed,
      rewarded: old.story.rewarded,
      stamps: ['hometown', 'casino'],
      attempts: old.story.attempts,
    });
    expect(m.story).toEqual({ ...emptyStoryProgress(), campaign: CAMPAIGN_ID, version: CAMPAIGN_VERSION });
    expect(m.storyChapter).toBe(0);
  });

  it('keeps everything the old campaign paid out', () => {
    const old = legacySave();
    const m = migrateProfile(old as unknown as Profile) as Profile;
    for (const key of ['credits', 'level', 'unlockedDecks', 'unlockedBoards', 'unlockedAchievements'] as const)
      expect(m[key], key).toEqual(old[key]);
    const p = { ...createDefaultProfile(), ...m };
    expect(isDeckUnlocked('jak_gold', p)).toBe(true);
    expect(isBoardUnlocked('rappahannock_riverside', p)).toBe(true);
    // Earned achievements are never taken back.
    expect(unlockEarned(p).patch.unlockedAchievements ?? p.unlockedAchievements).toEqual(
      expect.arrayContaining(old.unlockedAchievements),
    );
  });

  it('never treats an old win as a win in the new campaign', () => {
    const p = { ...createDefaultProfile(), ...(migrateProfile(legacySave() as unknown as Profile) as Profile) };
    expect(storyOf(p).completed).toEqual([]);
    expect(isChapterUnlocked(p, STORY_CHAPTERS[1]!)).toBe(false);
    expect(isLevelUnlocked(p, STORY_CHAPTERS[0]!.levels[1]!)).toBe(false);
    for (const c of STORY_CHAPTERS) expect(chapterProgress(p, c).done, c.id).toBe(0);
    // An unmigrated old block is never read as new progress either.
    const raw = { ...createDefaultProfile(), story: legacySave().story } as unknown as Profile;
    expect(storyOf(raw).completed).toEqual([]);
    expect(isChapterUnlocked(raw, STORY_CHAPTERS[1]!)).toBe(false);
  });

  it('counts old clears toward general story achievements only', () => {
    const p = { ...createDefaultProfile(), ...(migrateProfile(legacySave() as unknown as Profile) as Profile) };
    const f = buildFacts(p);
    expect(f.storyCleared).toBe(11);
    expect(f.firstTryClears).toBe(2);
    expect(f.campaignCleared).toBe(0);
    expect(f.chaptersComplete).toBe(0);
    expect(f.chapterDone(1)).toBe(false);
  });

  it('is idempotent and never re-archives new-campaign progress', () => {
    const once = migrateProfile(legacySave() as unknown as Profile) as Profile;
    let p = { ...createDefaultProfile(), ...once };
    for (const level of STORY_CHAPTERS[0]!.levels) p = { ...p, ...applyStoryResult(p, level.id, win(level)).patch };
    expect(p.storyChapter).toBe(1);
    const again = migrateProfile(JSON.parse(JSON.stringify(p))) as Profile;
    expect(again.legacyStory).toEqual(once.legacyStory);
    expect(storyOf(again as Profile).completed).toEqual(STORY_CHAPTERS[0]!.levels.map((l) => l.id));
    expect(again.storyChapter).toBe(1);
  });

  it('handles pre-campaign saves, untouched old blocks and empty saves', () => {
    // A save from before any campaign: chapters counted only in storyChapter.
    const preCampaign = { ...createDefaultProfile(), schemaVersion: 1, storyChapter: 3 } as Partial<Profile>;
    delete preCampaign.story;
    const a = migrateProfile(preCampaign as Profile) as Profile;
    expect(a.legacyStory?.chaptersCompleted).toBe(3);
    expect(a.story?.campaign).toBe(CAMPAIGN_ID);
    // An old block with no progress just starts fresh, with nothing to archive.
    const untouched = {
      ...createDefaultProfile(),
      schemaVersion: 2,
      story: { completed: [], rewarded: [], stamps: [], introsSeen: [], attempts: {} },
    };
    const b = migrateProfile(untouched as unknown as Profile) as Profile;
    expect(b.legacyStory).toBeUndefined();
    expect(b.story?.campaign).toBe(CAMPAIGN_ID);
    // A brand-new player has nothing to migrate.
    expect(migrateProfile({}).legacyStory).toBeUndefined();
    expect(migrateStoryProgress({}).story).toBeUndefined();
  });

  it('loads an old save end to end through the store', () => {
    const s = new Store();
    s.dispatch({ type: 'HYDRATE', profile: migrateProfile(legacySave() as unknown as Profile) });
    expect(s.state.profile.credits).toBe(1234);
    expect(s.state.profile.legacyStory?.stamps).toEqual(['hometown', 'casino']);
    expect(storyOf(s.state.profile).completed).toEqual([]);
  });
});

describe('family-friendly story', () => {
  it('never uses adult-only decks or boards', () => {
    for (const level of ALL_LEVELS) {
      expect(getDeck(level.setup.deckId).contentRating, level.id).toBe('general');
      expect(getBoard(level.setup.boardId).contentRating ?? 'general', level.id).toBe('general');
    }
    for (const c of STORY_CHAPTERS)
      for (const r of c.rewards) {
        if (r.kind === 'deck') expect(getDeck(r.id).contentRating, r.id).toBe('general');
        if (r.kind === 'board') expect(getBoard(r.id).contentRating ?? 'general', r.id).toBe('general');
      }
    for (const l of LOCATIONS) expect(getBoard(l.boardId).contentRating ?? 'general', l.id).toBe('general');
  });
});
