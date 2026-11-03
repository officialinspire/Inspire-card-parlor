import { describe, expect, it } from 'vitest';
import { STORY_CHAPTERS, getLevel, type StoryLevel } from '@/story/campaign';
import { EVIDENCE, getEvidence } from '@/story/evidence';
import { applyStoryResult, isLevelUnlocked, markIntroSeen, storyOf } from '@/story/progress';
import { currentObjective, journalOf, objectiveNote, recapOf, relatedFound, worldMap } from '@/story/world';
import { createDefaultProfile } from '@/core/defaults';
import { migrateProfile } from '@/storage/persistence';
import type { GameResult } from '@/progression/results';
import type { Profile } from '@/core/types';

/**
 * "Where you left off", objectives and clue readings, worked out from the
 * save alone: fresh saves, the middle of the story, replays, losses, reloads,
 * the finished campaign and migrated first-campaign saves.
 */
const result = (level: StoryLevel, outcome: 'win' | 'loss', books = 7): GameResult => ({
  gameId: level.game,
  outcome,
  durationMs: 60_000,
  score: level.game === 'go-fish' ? books : 100,
  details: level.game === 'go-fish' ? { books } : {},
});
const play = (p: Profile, id: string, outcome: 'win' | 'loss' = 'win', books = 7) => {
  const { patch, outcome: o } = applyStoryResult(p, id, result(getLevel(id)!, outcome, books));
  return { p: { ...p, ...patch } as Profile, o };
};
/** Every challenge up to (not including) `stopAt`, intros seen, as the player would play them. */
function playUntil(stopAt: string): Profile {
  let p = createDefaultProfile();
  for (const c of STORY_CHAPTERS) {
    p = { ...p, ...markIntroSeen(p, c.id) };
    for (const l of c.levels) {
      if (l.id === stopAt) return p;
      p = play(p, l.id).p;
    }
  }
  return p;
}
/** Every id a recap or reading names, for spoiler checks. */
const named = (p: Profile) => {
  const r = recapOf(p);
  return [r.lastClue?.id, r.question?.from.id].filter(Boolean) as string[];
};

describe('where you left off', () => {
  it('a fresh save: no clue yet, no question, and the first challenge next', () => {
    const r = recapOf(createDefaultProfile());
    expect(r.lastClue).toBeNull();
    expect(r.question).toBeNull();
    expect(r.next).toMatchObject({ kind: 'challenge', level: { id: 'th-1-1' } });
  });

  it('the middle of the story: the last clue found, its open question, and the next challenge', () => {
    const p = playUntil('th-4-3');
    const r = recapOf(p);
    expect(r.lastClue?.id).toBe((storyOf(p).evidence ?? []).at(-1));
    expect(r.lastClue?.id).toBe('cardistry-receipt');
    expect(r.question?.text).toBe('Whose office has no name on the door?');
    expect(r.next).toMatchObject({ kind: 'challenge', level: { id: 'th-4-3' } });
    // Only clues already found are ever named.
    for (const id of named(p)) expect(storyOf(p).evidence).toContain(id);
  });

  it('a question closes once its answer is found, and the recap moves on', () => {
    const before = recapOf(playUntil('th-6-4'));
    expect(before.question?.text).toBe('In what order do the four marks go?');
    const after = recapOf(playUntil('th-6-5'));
    expect(after.lastClue?.id).toBe('lodge-sketchbook-page');
    expect(after.question?.text).not.toBe('In what order do the four marks go?');
  });

  it('a loss changes nothing but the attempt count; the same challenge is still next', () => {
    const p = playUntil('th-3-2');
    const { p: lost, o } = play(p, 'th-3-2', 'loss');
    expect(o.met).toBe(false);
    expect(recapOf(lost)).toEqual(recapOf(p));
    expect(storyOf(lost).attempts['th-3-2']).toBe(1);
  });

  it('a Go Fish challenge is met by its books, win or lose', () => {
    const lv = getLevel('th-2-1')!;
    expect(lv.objective).toMatchObject({ kind: 'books' });
    expect(objectiveNote(lv)).toMatch(/don’t have to win/);
    const p = playUntil('th-2-1');
    const min = lv.objective.kind === 'books' ? lv.objective.min : 0;
    expect(play(p, 'th-2-1', 'loss', min).o.met).toBe(true);
    expect(play(p, 'th-2-1', 'loss', min - 1).o.met).toBe(false);
    expect(objectiveNote(getLevel('th-2-2')!)).toBeNull();
  });

  it('replays pay nothing twice, add no clue or stamp twice, and leave the recap where it was', () => {
    const p = playUntil('th-6-1');
    const replayed = play(play(p, 'th-5-5').p, 'th-5-5');
    expect(replayed.o.firstClear).toBe(false);
    expect(replayed.o.levelRewards).toEqual([]);
    expect(replayed.o.chapterRewards).toEqual([]);
    const s = storyOf(replayed.p);
    expect(new Set(s.evidence).size).toBe(s.evidence?.length);
    expect(new Set(s.stamps).size).toBe(s.stamps.length);
    expect(s.evidence).toEqual(storyOf(p).evidence);
    expect(replayed.p.credits).toBe(p.credits);
    expect(recapOf(replayed.p)).toEqual(recapOf(p));
  });

  it('survives a reload after rewards: the saved profile gives the same recap', () => {
    const p = playUntil('th-7-3');
    const reloaded = { ...createDefaultProfile(), ...migrateProfile(JSON.parse(JSON.stringify(p))) } as Profile;
    expect(recapOf(reloaded)).toEqual(recapOf(p));
    expect(currentObjective(reloaded)?.level.id).toBe('th-7-3');
  });

  it('the finished campaign: the last clue, no open question, and nothing left to continue', () => {
    let p = playUntil('none');
    const r = recapOf(p);
    expect(r.lastClue?.id).toBe('awakened-card');
    expect(r.question).toBeNull();
    expect(r.next).toEqual({ kind: 'finished' });
    // Every challenge stays replayable (open), without paying again.
    for (const c of STORY_CHAPTERS)
      for (const l of c.levels) {
        expect(isLevelUnlocked(p, l), l.id).toBe(true);
        const again = play(p, l.id);
        expect(again.o.levelRewards, l.id).toEqual([]);
        p = again.p;
      }
  });

  it('a migrated first-campaign save starts fresh, and a raw one reads as fresh too', () => {
    const old = {
      ...createDefaultProfile(),
      schemaVersion: 2,
      storyChapter: 2,
      story: {
        completed: ['chapter-1-1', 'chapter-1-2', 'chapter-2-1'],
        rewarded: ['level:chapter-1-1'],
        stamps: ['hometown'],
        introsSeen: ['chapter-1'],
        attempts: {},
      },
    };
    const migrated = { ...createDefaultProfile(), ...migrateProfile(old as unknown as Profile) } as Profile;
    for (const p of [migrated, old as unknown as Profile]) {
      const r = recapOf(p);
      expect(r.lastClue).toBeNull();
      expect(r.next).toMatchObject({ kind: 'challenge', level: { id: 'th-1-1' } });
    }
  });
});

describe('clue readings', () => {
  it('every clue has a reading; every question has an answer that comes later; links point to real clues', () => {
    const order = EVIDENCE.map((e) => e.id);
    for (const e of EVIDENCE) {
      expect(e.interpretation, e.id).toBeTruthy();
      expect(e.interpretation!.length, e.id).toBeLessThanOrEqual(160);
      if (e.question) {
        expect(e.answeredBy, e.id).toBeTruthy();
        expect(order.indexOf(e.answeredBy!), `${e.id} is answered later`).toBeGreaterThan(order.indexOf(e.id));
      }
      for (const r of e.related ?? []) expect(getEvidence(r), `${e.id} → ${r}`).toBeTruthy();
    }
  });

  it('cross-references only clues already found', () => {
    const p = playUntil('th-5-3');
    const found = new Set(storyOf(p).evidence);
    const dossier = getEvidence('thirteenth-hand-dossier')!; // found at th-5-3: not yet
    expect(found.has(dossier.id)).toBe(false);
    for (const e of EVIDENCE.filter((x) => found.has(x.id)))
      for (const r of relatedFound(p, e)) expect(found.has(r.id), `${e.id} → ${r.id}`).toBe(true);
    // The diagram links to the dossier only once the dossier is found.
    const diagram = getEvidence('lodge-sketchbook-page')!;
    expect(relatedFound(p, diagram).map((x) => x.id)).not.toContain('thirteenth-hand-dossier');
    expect(relatedFound(playUntil('th-6-1'), diagram).map((x) => x.id)).toContain('thirteenth-hand-dossier');
  });

  it('the door puzzle offers only supporting clues, all found by Chapter 8', () => {
    const puzzle = getLevel('th-8-5')!.puzzle!;
    expect(puzzle.clues?.length).toBeGreaterThan(0);
    const p = playUntil('th-8-5');
    for (const id of puzzle.clues!) expect(storyOf(p).evidence, id).toContain(id);
  });
});

describe('no new unlocks', () => {
  it('the recap never opens a place the map keeps hidden', () => {
    for (const stop of ['th-1-1', 'th-3-1', 'th-6-2', 'th-9-1']) {
      const p = playUntil(stop);
      const next = recapOf(p).next;
      if (next.kind !== 'challenge') continue;
      expect(worldMap(p).find((s) => s.chapter.id === next.chapter.id)?.state).toBe('available');
      expect(isLevelUnlocked(p, next.level)).toBe(true);
      expect(journalOf(p).objective?.level.id).toBe(next.level.id);
    }
  });
});
