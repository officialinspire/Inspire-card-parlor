# THE THIRTEENTH HAND — story campaign

The story campaign is data. The code reads it; it never plays a game differently.

| What                                                       | Where                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| Chapters, challenges and scenes                            | `src/story/campaign.ts`                               |
| Shapes of everything below                                 | `src/story/types.ts`                                  |
| Cast: roles, voice, portraits, theme music, opponent link  | `src/story/cast.ts`                                   |
| Characters as War / Go Fish opponents                      | `src/games/cpu/storyOpponents.ts`                     |
| Locations, with documented history kept apart from fiction | `src/story/locations.ts`                              |
| Collectible evidence                                       | `src/story/evidence.ts`                               |
| Progress rules: unlocks, objectives, one-time rewards      | `src/story/progress.ts`                               |
| Save migration from the first campaign                     | `src/story/migrate.ts`, `src/story/legacy.ts`         |
| Tests                                                      | `tests/unit/story.test.ts`, `tests/e2e/story.spec.ts` |

## The player

The player is an unnamed, silent observer and never speaks. Characters talk to
them, and narration describes what they see and do in the second person:
"You examine the old ledger." Narration lines use `who: 'narrator'`. The tests
check that no line belongs to the player, that every narration line addresses
"you", and that no narration reports the player speaking ("you ask…").

## The mystery

An estate-sale box (Lot 13) brings Cheryl a card with no suit and no rank,
titled THE THIRTEENTH HAND. It comes with a ledger of twelve recorded hands
whose thirteenth line is blank. The card's four blank corners are shaped for
suit marks. One mark is found in each of chapters 2–5:

- clubs, on a trail marker at the river;
- hearts, in Dante's anonymous commission;
- diamonds, in Jak's slow-motion footage;
- spades, in Mrs. Gray's dossier.

Steve shows which parts of the legend are documented and which were invented
later. Mary Ball Washington's ghost hands over the key. Jak, Steve and Dante
open the four-suit door. George Washington's ghost finally plays the hand he
walked away from, loses it, and does not take it well.

| #   | Chapter                   | Location                            | Host                         | Status      | Adds to the mystery                                                |
| --- | ------------------------- | ----------------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------ |
| 1   | The Card Without a Suit   | Cheryl's Antique Shop               | Cheryl                       | **written** | The card, the receipt, the ledger of twelve, the river postcard    |
| 2   | The Heron's Bend          | Rappahannock River Station          | Sophia                       | **written** | ♣ mark, a returned envelope to Dante, an old map with four marks   |
| 3   | Neon Commission           | iSMOKESHOP                          | Dante                        | outline     | Anonymous commission; ♥ mark                                       |
| 4   | On the Record             | Jak's Backroom Card Parlor          | Jak Gold                     | outline     | Records request names the (fictional) operation; ♦ mark            |
| 5   | Operation Thirteenth Hand | Mrs. Gray's Intelligence Safehouse  | Mrs. Gray                    | outline     | The operation borrowed a local legend as cover; ♠ mark             |
| 6   | Square and Compasses      | Fredericksburg Masonic Lodge No. 4  | Steve Gonzales               | outline     | Real lodge history vs. the invented cipher; the order of the suits |
| 7   | A Mother's Opinion        | Kenmore                             | Mary Ball Washington (ghost) | outline     | The legend of the unfinished game; the iron key                    |
| 8   | Four Suits Below          | The Underground Tunnels (fictional) | Steve, with Jak and Dante    | outline     | The four-suit door opens                                           |
| 9   | The Thirteenth Hand       | Washington's Spectral Card Parlor   | George Washington (ghost)    | outline     | The final game; the card is complete                               |

Each chapter has five challenges and plays all five games once: Klondike,
Spider, FreeCell, War and Go Fish. Solitaire and War challenges use fixed
deals, each proven winnable by the solver or by simulating the whole game.
Go Fish deals fresh on every try at an Easy table; the tests check that its
objective is met on a good share of deals.

### Outlined chapters (3–9)

Their plot beats, mystery thread, location, cast, music, rewards and all five
challenges are defined. Their scenes are short narration, each line marked
`status: 'draft'`. No character is given dialogue that has not been written
and approved. The chapter card shows "Story in development" until the scenes
are written.

Table talk ("Go fish!") for Dante, Mrs. Gray, Steve and both ghosts is generic
and marked `linesStatus: 'draft'` in `storyOpponents.ts`. Cheryl's and
Sophia's table talk is written in character.

## History and fiction

Every location says whether it is a real place, an invented one or a
supernatural one, and carries notes of two kinds:

- `history`: documented facts, each with a source to check. Examples:
  Washington's initiation at the Fredericksburg lodge on 4 November 1752;
  Kenmore built for Fielding and Betty Washington Lewis; Mary Ball Washington's
  own house on Charles Street; the Culper Ring.
- `fiction`: what the story invents, such as Operation Thirteenth Hand, the
  tunnels, the ghosts, the cipher, the shops and the ranger station.

The tests check that no history note mentions the invented elements, and that
every location has a fiction note.

## Save migration

The first campaign, The Card Parlor Chronicles (ids `chapter-N`,
`chapter-N-M`), has been replaced. Its chapters meant different things, so an
old win is never counted as a win in the new campaign. The profile schema goes
from version 2 to 3:

1. **Archive.** A first-campaign story block is copied unchanged into
   `profile.legacyStory`. That covers completed challenges, paid rewards,
   stamps, intros seen, attempts, and the old `storyChapter` count. The
   pre-upgrade save is also kept in `localStorage` as `icp:profile-backup-v2`.
2. **Fresh start.** `profile.story` starts empty for The Thirteenth Hand,
   stamped `campaign: 'thirteenth-hand'` and `version: 1`. `storyChapter`
   restarts at 0; it now counts this campaign's chapters.
3. **Keep what was earned.** Decks, boards, alternate art, credits, XP, level
   and achievements stay as they are.
4. **Keep old unlocks.** Story unlock rules name the old chapter they used to
   need (`{ type: 'story', value: 'th-9', legacy: 'chapter-7' }`), so finishing
   that chapter still counts. This applies to Dante's World, Eastern
   Woodlands, George Washington's Ghost, Rappahannock Riverside and
   Washington's Final Table.
5. **Achievements.** General story achievements ("clear N challenges", "first
   try") also count old clears. Chapter achievements and "all 45 challenges"
   count only the new campaign. Achievements already earned are never removed.

The migration is idempotent and runs on every load. It never overwrites an
archive, and it never touches progress already marked for this campaign.

Campaign ids start with `th-`. If the meaning of an existing id ever changes,
bump `CAMPAIGN_VERSION` in `src/story/ids.ts` and add a migration step.

## Open items

- Write the scenes for chapters 3–9, then set each chapter's `status` to
  `'final'`. Also mark its evidence `'final'`, and its characters' table talk
  `linesStatus: 'final'`.
- Jak Gold has no character sprite sheet, so his portrait falls back to his
  avatar.
- Chapter 3 is set at Dante's art counter and is about his artwork. The story
  stays family-friendly: no smoke-shop products or psychonaut material
  appear, and the adult-rated iSMOKESHOP boards are never used. Decide whether
  that framing is right.
- The new UI (evidence board, map, location notes, character sheets) is not
  built yet. The data is ready for it.
- Old passport stamps are kept in the archive, but the passport only shows the
  nine new stamps.
