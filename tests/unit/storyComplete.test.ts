import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { storyScriptMarkdown } from '@/story/scriptDoc';
import {
  ALL_LEVELS,
  EPILOGUE,
  NARRATOR,
  STAMPS,
  STORY_CHAPTERS,
  getChapter,
  getLevel,
  type DialogueLine,
  type StoryLevel,
} from '@/story/campaign';
import { getCharacter } from '@/story/chapters';
import { EVIDENCE, getEvidence } from '@/story/evidence';
import {
  applyStoryResult,
  isChapterComplete,
  isChapterUnlocked,
  isLevelUnlocked,
  markIntroSeen,
  storyOf,
} from '@/story/progress';
import { currentObjective, journalOf, locationState, replayableScenes, worldMap } from '@/story/world';
import { FOUND_ORDER, SUIT_NAME, checkSuitOrder, puzzleHint } from '@/story/puzzle';
import { GHOST_REMATCHES, isCampaignComplete, rematchesUnlocked, unlockedGhostOpponents } from '@/story/rematches';
import { STORY_OPPONENTS, getPersonality } from '@/games/cpu/personalities';
import { unlockEarned } from '@/achievements/engine';
import { createDefaultProfile } from '@/core/defaults';
import { migrateProfile } from '@/storage/persistence';
import { getDeck } from '@/decks/registry';
import { getBoard } from '@/boards/registry';
import type { GameResult } from '@/progression/results';
import type { Profile } from '@/core/types';

/**
 * THE THIRTEENTH HAND, finished: all nine chapters played start to end
 * through the real progress rules, with the clues, characters, saves,
 * replays, unlocks and final rewards the story depends on.
 */

const win = (level: StoryLevel): GameResult => ({
  gameId: level.game,
  outcome: 'win',
  durationMs: 60_000,
  score: level.game === 'go-fish' ? 7 : 100,
  details: level.game === 'go-fish' ? { books: 7 } : {},
});

const play = (p: Profile, level: StoryLevel) => {
  const { patch, outcome } = applyStoryResult(p, level.id, win(level));
  return { p: { ...p, ...patch } as Profile, outcome };
};

/** Plays the whole campaign in order, as the player would (seeing each chapter's intro first). */
function playThrough(): { profile: Profile; firstClears: number } {
  let p = createDefaultProfile();
  let firstClears = 0;
  for (const c of STORY_CHAPTERS) {
    expect(isChapterUnlocked(p, c), `${c.id} opens in turn`).toBe(true);
    p = { ...p, ...markIntroSeen(p, c.id) };
    for (const l of c.levels) {
      expect(isLevelUnlocked(p, l), `${l.id} opens in turn`).toBe(true);
      const r = play(p, l);
      p = r.p;
      if (r.outcome.firstClear) firstClears++;
    }
    expect(isChapterComplete(p, c), c.id).toBe(true);
  }
  return { profile: p, firstClears };
}

const allLines = (): { where: string; chapter: number; line: DialogueLine }[] =>
  STORY_CHAPTERS.flatMap((c) =>
    [
      { where: `${c.id} intro`, lines: c.intro },
      ...c.levels.flatMap((l) => [
        { where: `${l.id} intro`, lines: l.intro },
        ...(l.puzzle
          ? [
              { where: `${l.id} puzzle hints`, lines: l.puzzle.hints },
              { where: `${l.id} puzzle solved`, lines: l.puzzle.solved },
            ]
          : []),
        { where: `${l.id} outro`, lines: l.outro },
      ]),
      { where: `${c.id} outro`, lines: c.outro },
    ].flatMap(({ where, lines }) => lines.map((line) => ({ where, chapter: c.index, line }))),
  );

describe('the full nine-chapter story', () => {
  it('plays from Chapter 1 to the end in order, with no dead end', () => {
    const { profile, firstClears } = playThrough();
    expect(firstClears).toBe(45);
    expect(isCampaignComplete(profile)).toBe(true);
    expect(profile.storyChapter).toBe(9);
    expect(currentObjective(profile)).toBeNull();
    expect(worldMap(profile).map((s) => s.state)).toEqual(Array(9).fill('completed'));
    // No chapter is a preview any more: the "adventure continues" screen is never reached.
    expect(journalOf(profile).preview).toBeNull();
  });

  it('opens one place at a time, and every open chapter is playable', () => {
    let p = createDefaultProfile();
    for (const [i, c] of STORY_CHAPTERS.entries()) {
      const states = STORY_CHAPTERS.map((x) => locationState(p, x));
      expect(states[i], `${c.id} before it is played`).toBe('available');
      // Only the next place is shown as locked; everything past it stays hidden.
      if (i + 1 < 9) expect(states[i + 1]).toBe('locked');
      for (const later of states.slice(i + 2)) expect(later).toBe('undiscovered');
      expect(states.includes('preview')).toBe(false);
      for (const l of c.levels) p = play(p, l).p;
    }
  });

  it('pays the final rewards once: deck, board, all nine stamps and the campaign achievements', () => {
    const { profile } = playThrough();
    expect(profile.unlockedDecks).toContain('washington_ghost');
    expect(profile.unlockedBoards).toContain('washington_final_table');
    expect(new Set(storyOf(profile).stamps)).toEqual(new Set(STAMPS.map((s) => s.id)));
    // Every chapter's deck and board reward exists and is owned at the end.
    for (const c of STORY_CHAPTERS)
      for (const r of c.rewards) {
        if (r.kind === 'deck') expect(getDeck(r.id) && profile.unlockedDecks.includes(r.id), r.id).toBe(true);
        if (r.kind === 'board') expect(getBoard(r.id) && profile.unlockedBoards.includes(r.id), r.id).toBe(true);
      }
    const earned = unlockEarned(profile).earned;
    for (const id of ['story-ch3', 'halfway-home', 'story-ch5', 'story-ch6', 'chronicles-complete', 'story-35'])
      expect(earned, id).toContain(id);
    // Replaying every challenge pays nothing more.
    let again = profile;
    for (const l of ALL_LEVELS) {
      const r = play(again, l);
      expect(r.outcome.levelRewards, l.id).toEqual([]);
      expect(r.outcome.chapterRewards, l.id).toEqual([]);
      again = r.p;
    }
    expect(again.credits).toBe(profile.credits);
    expect(again.xp).toBe(profile.xp);
  });
});

describe('clue continuity', () => {
  it('collects every clue by the end, each in its own chapter', () => {
    const { profile } = playThrough();
    expect(new Set(storyOf(profile).evidence)).toEqual(new Set(EVIDENCE.map((e) => e.id)));
    expect(journalOf(profile).clues).toHaveLength(EVIDENCE.length);
    // Every chapter adds at least one key clue.
    for (const c of STORY_CHAPTERS)
      expect(EVIDENCE.filter((e) => e.chapter === c.id && e.importance === 'key').length, c.id).toBeGreaterThan(0);
  });

  it('finds the four suit marks before the door that needs them, one per chapter from 2 to 5', () => {
    expect(['club-mark', 'heart-mark', 'diamond-mark', 'spade-mark'].map((id) => getEvidence(id)!.chapter)).toEqual([
      'th-2',
      'th-3',
      'th-4',
      'th-5',
    ]);
  });

  /** Each clue leads somewhere: a later scene names what it showed. */
  const used: [clue: string, laterChapter: number, mention: RegExp][] = [
    ['returned-envelope', 3, /envelope|heron card/i],
    ['commission-form', 9, /commission/i],
    ['monster-card', 9, /General Monsterton/],
    ['cardistry-receipt', 5, /card case/i],
    ['redacted-reply', 5, /Operation Thirteenth Hand/i],
    ['thirteenth-hand-dossier', 6, /survey/i],
    ['sophia-river-map', 6, /map/i],
    ['lodge-sketchbook-page', 8, /diagram/i],
    ['ledger-impression', 7, /Ask Mother/i],
    ['ledger-of-twelve', 7, /ledger/i],
    ['mary-letter', 9, /You owe me a hand/],
    ['kenmore-iron-key', 8, /iron key/i],
    ['neon-tunnel-map', 8, /way out|find our way/i],
    ['four-suit-puzzle', 9, /card room/i],
  ];

  it.each(used)('%s is found, then used in Chapter %i', (clue, later, mention) => {
    const found = getChapter(getEvidence(clue)!.chapter)!.index;
    expect(found).toBeLessThanOrEqual(later);
    const text = allLines()
      .filter((x) => x.chapter >= Math.max(found, later) && x.chapter <= later)
      .map((x) => x.line.text)
      .join('\n');
    expect(text).toMatch(mention);
  });

  it('opens the door with the order Steve reads from the evidence, not the order the marks were found', () => {
    const door = getLevel('th-8-5')!;
    expect(door.puzzle).toBeDefined();
    const puzzle = door.puzzle!;
    expect(puzzle.answer).toEqual(['spades', 'diamonds', 'hearts', 'clubs']);
    // Steve's diagram (a clue the player carries) states the same order.
    expect(getEvidence('lodge-sketchbook-page')!.description).toMatch(/spade, diamond, heart, club/i);
    // The tempting wrong answers don't open it: the order found, and Jak's new deck order.
    expect(checkSuitOrder(puzzle, FOUND_ORDER)).toBe(false);
    expect(checkSuitOrder(puzzle, ['spades', 'diamonds', 'clubs', 'hearts'])).toBe(false);
    expect(checkSuitOrder(puzzle, ['spades', 'diamonds', 'hearts'])).toBe(false);
    expect(checkSuitOrder(puzzle, puzzle.answer)).toBe(true);
  });

  it('never lets the puzzle block the story: the hints end by giving the answer, and keep giving it', () => {
    const puzzle = getLevel('th-8-5')!.puzzle!;
    const last = puzzleHint(puzzle, puzzle.hints.length - 1);
    expect(puzzleHint(puzzle, 99)).toBe(last);
    const names = puzzle.answer.map((s) => SUIT_NAME[s]);
    let at = -1;
    for (const n of names) {
      const i = last.text.toLowerCase().indexOf(n.toLowerCase());
      expect(i, n).toBeGreaterThan(at);
      at = i;
    }
    // Only the Chapter 8 door has a puzzle.
    expect(ALL_LEVELS.filter((l) => l.puzzle).map((l) => l.id)).toEqual(['th-8-5']);
  });
});

describe('characters', () => {
  it('lets only each chapter’s cast speak, and every cast member speaks', () => {
    for (const c of STORY_CHAPTERS) {
      const speakers = new Set(
        allLines()
          .filter((x) => x.chapter === c.index && x.line.who !== NARRATOR)
          .map((x) => x.line.who),
      );
      for (const who of speakers) expect(c.cast, `${c.id}: ${who}`).toContain(who);
      for (const who of c.cast) expect(speakers.has(who), `${c.id}: ${who} speaks`).toBe(true);
    }
  });

  it('seats each chapter’s own characters at its tables', () => {
    for (const c of STORY_CHAPTERS)
      for (const l of c.levels) {
        const o = l.setup.options ?? {};
        for (const id of [o.opponent, ...(o.opponents ?? [])].filter(Boolean) as string[]) {
          const who = (STORY_OPPONENTS.some((p) => p.id === id) || id === 'jak_gold') && getCharacter(id);
          expect(who && c.cast.includes(id), `${l.id}: ${id}`).toBe(true);
          expect(getPersonality(id).id).toBe(id);
        }
      }
  });

  it('changes expressions: every chapter with a portrait sheet uses several poses', () => {
    for (const c of STORY_CHAPTERS) {
      const poses = new Set(
        allLines()
          .filter((x) => x.chapter === c.index && x.line.pose && getCharacter(x.line.who)?.portrait?.sheet)
          .map((x) => `${x.line.who}/${x.line.pose}`),
      );
      expect(poses.size, c.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps the player silent in every puzzle line and the epilogue too', () => {
    for (const { where, line } of [
      ...allLines(),
      ...EPILOGUE.map((line) => ({ where: 'epilogue', chapter: 10, line })),
    ]) {
      expect(getCharacter(line.who), `${where}: ${line.who}`).toBeDefined();
      if (line.who === NARRATOR) {
        expect(line.narration, where).toBe(true);
        expect(line.text, where).toMatch(/\b(you|your)\b/i);
        expect(line.text, where).not.toMatch(/\byou (say|said|ask|asked|reply|replied|tell|told)\b/i);
      }
    }
  });

  it('brings the whole cast back for the epilogue, which opens the ghost rematches', () => {
    const who = new Set(EPILOGUE.map((l) => l.who));
    for (const id of ['cheryl', 'sophia', 'dante', 'jak_gold', 'mrs_gray', 'steve_gonzales', 'george_washington'])
      expect(who.has(id), id).toBe(true);
    expect(EPILOGUE.at(-1)!.text).toMatch(/rematches/i);
  });

  it('marks history apart from the legend: every history field note has a source', () => {
    const notes = STORY_CHAPTERS.flatMap((c) => [...(c.info ?? []), ...c.levels.flatMap((l) => l.info ?? [])]);
    expect(notes.length).toBeGreaterThanOrEqual(25);
    for (const n of notes) if (n.kind === 'history' || n.kind === 'wildlife') expect(n.source, n.id).toBeTruthy();
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
    // Kenmore was Betty and Fielding Lewis's home: the story never has Mary living there.
    const kenmore = allLines()
      .filter((x) => x.chapter === 7)
      .map((x) => x.line.text)
      .join(' ');
    expect(kenmore).toMatch(/I did not live here/);
    expect(kenmore).toMatch(/Charles Street/);
  });
});

describe('saved progress', () => {
  it('a save from the two-chapter demo carries on into Chapter 3 with nothing lost', () => {
    let demo = createDefaultProfile();
    for (const c of STORY_CHAPTERS.slice(0, 2)) {
      demo = { ...demo, ...markIntroSeen(demo, c.id) };
      for (const l of c.levels) demo = play(demo, l).p;
    }
    // As written by the demo build and loaded again.
    const loaded: Profile = { ...createDefaultProfile(), ...migrateProfile(JSON.parse(JSON.stringify(demo))) };
    expect(storyOf(loaded).completed).toEqual(storyOf(demo).completed);
    expect(storyOf(loaded).evidence).toEqual(storyOf(demo).evidence);
    expect(storyOf(loaded).stamps).toEqual(storyOf(demo).stamps);
    expect(loaded.credits).toBe(demo.credits);
    expect(locationState(loaded, getChapter('th-3')!)).toBe('available');
    expect(currentObjective(loaded)?.level.id).toBe('th-3-1');
    // Finishing Chapter 3 pays its rewards once, on top of what the demo already paid.
    let p = loaded;
    for (const l of getChapter('th-3')!.levels) p = play(p, l).p;
    expect(p.unlockedDecks).toContain('dantes_world');
    expect(storyOf(p).stamps).toContain('th-neon-monster');
  });
});

describe('replays and rematches', () => {
  it('offers every scene seen, and the epilogue only once the story is finished', () => {
    let p = createDefaultProfile();
    for (const c of STORY_CHAPTERS.slice(0, 8)) {
      p = { ...p, ...markIntroSeen(p, c.id) };
      for (const l of c.levels) p = play(p, l).p;
    }
    expect(replayableScenes(p).some((s) => s.id === 'epilogue')).toBe(false);
    const { profile } = playThrough();
    const scenes = replayableScenes(profile);
    for (const c of STORY_CHAPTERS) {
      expect(
        scenes.some((s) => s.id === `${c.id}:intro`),
        c.id,
      ).toBe(true);
      expect(
        scenes.some((s) => s.id === `${c.id}:outro`),
        c.id,
      ).toBe(true);
      for (const l of c.levels)
        if (l.outro.length)
          expect(
            scenes.some((s) => s.id === `${l.id}:outro`),
            l.id,
          ).toBe(true);
    }
    expect(scenes.at(-1)!.id).toBe('epilogue');
  });

  it('opens the ghost rematches with the end of the story, against real opponents on owned tables', () => {
    let p = createDefaultProfile();
    for (const c of STORY_CHAPTERS.slice(0, 8)) for (const l of c.levels) p = play(p, l).p;
    expect(rematchesUnlocked(p)).toBe(false);
    expect(unlockedGhostOpponents(p)).toEqual([]);
    for (const l of getChapter('th-9')!.levels) p = play(p, l).p;
    expect(rematchesUnlocked(p)).toBe(true);
    expect(unlockedGhostOpponents(p)).toEqual(['george_washington', 'mary_ball_washington']);
    for (const r of GHOST_REMATCHES) {
      expect(getPersonality(r.opponent).id).toBe(r.opponent);
      expect(p.unlockedDecks, r.deckId).toContain(r.deckId);
      expect(p.unlockedBoards, r.boardId).toContain(r.boardId);
    }
  });
});

describe('the script document', () => {
  it('docs/STORY_SCRIPT_COMPLETE.md is generated from the current campaign (npm run story:script)', () => {
    expect(readFileSync('docs/STORY_SCRIPT_COMPLETE.md', 'utf8')).toBe(storyScriptMarkdown());
  });
});
