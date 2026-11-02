/**
 * THE CARD PARLOR CHRONICLES — the first story campaign (seven chapters,
 * ids "chapter-1" … "chapter-7", challenges "chapter-1-1" … "chapter-7-5").
 *
 * It has been replaced by THE THIRTEENTH HAND, whose chapters mean different
 * things, so old wins are never counted as wins in the new campaign. Instead
 * saves keep the old progress as an archive (`profile.legacyStory`):
 *
 *  - everything it paid out (decks, boards, art, credits, XP, achievements)
 *    stays owned;
 *  - its passport stamps stay in the archive and are listed here by name;
 *  - deck and board unlocks that used to depend on an old chapter still
 *    honour it (see `legacy` on story unlock rules);
 *  - challenges cleared there still count toward the general story
 *    achievements ("clear N story challenges").
 */
export const LEGACY_CAMPAIGN_ID = 'card-parlor-chronicles';

export const LEGACY_CHAPTERS: readonly { id: string; index: number; title: string; stamp: string }[] = [
  { id: 'chapter-1', index: 1, title: 'The Hometown', stamp: 'hometown' },
  { id: 'chapter-2', index: 2, title: 'Jak Gold’s Casino', stamp: 'casino' },
  { id: 'chapter-3', index: 3, title: 'Dante’s World', stamp: 'dantes-world' },
  { id: 'chapter-4', index: 4, title: 'The Woodlands', stamp: 'woodlands' },
  { id: 'chapter-5', index: 5, title: 'The Safehouse', stamp: 'safehouse' },
  { id: 'chapter-6', index: 6, title: 'The Builders', stamp: 'builders' },
  { id: 'chapter-7', index: 7, title: 'Artist’s Alley', stamp: 'artists-alley' },
];

/** Every challenge id the old campaign used. */
export const LEGACY_LEVEL_IDS: readonly string[] = LEGACY_CHAPTERS.flatMap((c) =>
  [1, 2, 3, 4, 5].map((n) => `${c.id}-${n}`),
);

export const isLegacyLevelId = (id: string) => /^chapter-\d+-\d+$/.test(id);
export const isLegacyChapterId = (id: string) => /^chapter-\d+$/.test(id);
