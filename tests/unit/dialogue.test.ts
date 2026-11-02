import { describe, expect, it } from 'vitest';
import { EPILOGUE, NARRATOR, STORY_CHAPTERS, type DialogueLine } from '@/story/campaign';
import { PANEL_MAX_CHARS, paceDialogue, splitText } from '@/story/dialogue';

const everyScene = (): DialogueLine[][] => [
  ...STORY_CHAPTERS.flatMap((c) => [
    c.intro,
    c.outro,
    ...c.levels.flatMap((l) => [l.intro, l.outro, l.puzzle?.hints ?? [], l.puzzle?.solved ?? []]),
  ]),
  [...EPILOGUE],
];

describe('dialogue pacing', () => {
  it('leaves short lines exactly as written', () => {
    const line: DialogueLine = { who: 'cheryl', text: 'We close at five. It’s ten to.', pose: 'portrait-neutral' };
    expect(paceDialogue([line])).toEqual([line]);
  });

  it('splits a long line between sentences, keeping every word, the speaker and the pose', () => {
    const text =
      'Yes, it was I. The card in Lot 13, the heron, the commission. A general recruits. Twelve hands were played in my mother’s parlor. I was called away before the thirteenth, and I have regretted it for a very long time.';
    expect(text.length).toBeGreaterThan(PANEL_MAX_CHARS);
    const out = paceDialogue([{ who: 'george_washington', text, pose: 'portrait-think' }]);
    expect(out.length).toBeGreaterThan(1);
    for (const l of out) {
      expect(l.text.length).toBeLessThanOrEqual(PANEL_MAX_CHARS);
      expect(l.who).toBe('george_washington');
      expect(l.pose).toBe('portrait-think');
      expect(l.text).toMatch(/[.!?…”’]$/);
    }
    expect(out.map((l) => l.text).join(' ')).toBe(text);
  });

  it('shows a discovered clue with the last panel only', () => {
    const text = `${'You read the long letter carefully. '.repeat(6)}At the bottom is a signature.`;
    const out = paceDialogue([{ who: NARRATOR, narration: true, text, discovers: 'mary-letter' }]);
    expect(out.length).toBeGreaterThan(1);
    expect(out.slice(0, -1).every((l) => !l.discovers)).toBe(true);
    expect(out.at(-1)!.discovers).toBe('mary-letter');
  });

  it('never leaves a tiny last panel, and keeps one long sentence whole', () => {
    expect(splitText(`${'A'.repeat(170)}. Ok.`)).toHaveLength(1);
    const long = `This single sentence keeps going ${'and going '.repeat(25)}until it ends.`;
    expect(splitText(long)).toEqual([long]);
  });

  it('paces every scene of the campaign into panels that fit', () => {
    // A very short closing sentence is kept with the panel before it, so a panel may run a little over.
    for (const scene of everyScene())
      for (const l of paceDialogue(scene)) expect(l.text.length, l.text).toBeLessThanOrEqual(PANEL_MAX_CHARS * 1.25);
  });
});
