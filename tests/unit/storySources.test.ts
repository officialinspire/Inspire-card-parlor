import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '@/story/locations';
import { STORY_CHAPTERS } from '@/story/campaign';

/**
 * Corrections recorded in docs/STORY_SOURCES.md stay corrected.
 */
const allText = () => [
  ...LOCATIONS.flatMap((l) => l.notes.map((n) => ({ id: `${l.id}: ${n.title}`, text: n.text }))),
  ...STORY_CHAPTERS.flatMap((c) => [...(c.info ?? []), ...c.levels.flatMap((l) => l.info ?? [])]).map((n) => ({
    id: n.id,
    text: n.text,
  })),
];

describe('public-records facts', () => {
  it('Virginia FOIA is not described as open to anyone: citizens of the Commonwealth and in-state media', () => {
    for (const n of allText()) {
      if (!/Virginia/.test(n.text) || !/Freedom of Information|FOIA/.test(n.text)) continue;
      expect(n.text, n.id).not.toMatch(/\banyone may\b/i);
    }
    const va = LOCATIONS.flatMap((l) => l.notes).find((n) => n.title === 'Public records in Virginia');
    expect(va?.text).toMatch(/citizens of the Commonwealth/);
    expect(va?.source).toMatch(/2\.2-3704/);
  });

  it('keeps records requests, federal FOIA and filming rights apart', () => {
    const notes = LOCATIONS.flatMap((l) => l.notes);
    expect(notes.find((n) => n.title === 'Public records in Virginia')?.text).toMatch(/federal FOIA, which any person/);
    expect(notes.find((n) => n.title === 'Filming in public')?.text).toMatch(/First Amendment, not on FOIA/);
    const federal = STORY_CHAPTERS.flatMap((c) => c.levels.flatMap((l) => l.info ?? [])).find(
      (n) => n.id === 'foia-1966',
    );
    expect(federal?.text).toMatch(/covers federal agencies/);
    expect(federal?.text).toMatch(/Virginia city answers under the state’s own Act/);
  });

  it('dates Kenmore’s construction as its owner does (1769–1775)', () => {
    const kenmore = LOCATIONS.find((l) => l.id === 'kenmore')!.notes.find((n) => n.title === 'Kenmore');
    expect(kenmore?.text).toMatch(/1769 to 1775/);
  });
});
