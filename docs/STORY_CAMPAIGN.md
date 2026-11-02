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

## Story Mode screens

Story Mode is one screen with three views and its own back stack: journal →
chapter → map → main menu. The header's Back button, Escape and Backspace all
go back one view.

Scenes, the versus card and results open as dialogs over these views. Progress
is saved as it happens, so leaving any of them loses nothing. The screens read
everything from the campaign data; no character or place is written into a
component.

| Piece                       | Code                                                               | Artwork used                                                                      |
| --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| World map                   | `src/components/story/map.ts`, state rules in `src/story/world.ts` | Nine location tiles; padlock, map pin, wax seal and mystery-emblem icons; compass |
| Chapter and challenge cards | `src/components/screens/StoryMode.ts`                              | Location tile; opponent portraits                                                 |
| Dialogue engine             | `src/components/story/scene.ts`                                    | Expression sheets (the pose changes with each line)                               |
| Versus card                 | `src/components/story/versus.ts`                                   | Opponent portraits, crest emblem, real deck back                                  |
| Quest journal               | `src/components/story/journal.ts`                                  | Quest-item and illustration sprites; quest scroll and open book                   |
| Results                     | `src/components/story/results.ts`                                  | Crest emblem, quest scroll, suit confetti, spectral wisp                          |
| Passport stamps             | `src/components/passportStamps.ts`                                 | The nine chapter stamps                                                           |

**Map states.** Chapter 1 is open from the start. The next place is
_discovered but locked_. Places beyond that are _undiscovered_, with their name
and art hidden. Finished places are _completed_ and can still be revisited.

**Dialogue.**

- Narration is shown on parchment with no portrait and no speaker.
- Characters speak beside their portrait, under a nameplate.
- To advance, tap the scene or press →, Space or Enter; ← or the Back button
  goes back. Skip ends the scene.
- Beats that reveal a clue show it, marked "Added to your journal".
- Scenes already seen can be replayed from the journal.

**Failure-safe artwork.**

- Every sprite is decorative.
- If the manifest or an image is missing, the screens fall back to shapes,
  monograms and plain text, and play continues. A Playwright test blocks all
  story artwork and still plays a challenge.

**Asset check (Prompt 22).**

- All 51 source images listed in the manifest exist, as do every sprite and
  thumbnail.
- There is no illustrated base map of Fredericksburg. The only map art is
  Sophia's annotated river trail map, which shows no town geography. The world
  map therefore uses the brief's fallback: the location tiles on a parchment
  trail in story order, which makes no claim about where the places are. Pan
  and zoom are not needed, because all nine places fit every layout.
- Jak Gold still has no expression sheet, so his opponent avatar stands in.

## The playable demo (Prompt 23)

Chapters 1 and 2 form the demo.

| Chapter                        | Challenge order                                                                    | Table                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1 · Cheryl's Antique Shop      | War vs Cheryl → Klondike (Draw 1) → Go Fish vs Cheryl → FreeCell → Spider (1 suit) | Cheryl's Antique Shop board, Fredericksburg Heritage deck |
| 2 · Rappahannock River Station | Go Fish vs Sophia → Klondike (Draw 1) → FreeCell → Spider (1 suit) → War vs Sophia | Rappahannock Riverside board, Eastern Woodlands deck      |

Every seeded deal is proven winnable, and Go Fish is dealt at an Easy table.

The Thirteenth Hand card appears in Cheryl's opening scene, not as a reward
pop-up. Each clue (the receipt, the ledger, the postcard, Sophia's annotated
river map, the returned envelope addressed to Dante) is found in a closing
scene and saved to the journal.

**Field notes.** Short, optional cards on real wildlife and local history,
each with a source: the great blue heron, the fall line, American shad and the
removal of the Embrey Dam, bald eagles, and the river's name. A note says the
Eastern Woodlands deck is a visual theme of the region's wildlife and plants,
and that the story's clues do not represent Native spirituality or traditions.

**The end of the demo.** Finishing Chapter 2 opens THE ADVENTURE CONTINUES…, a
preview of Dante's iSMOKESHOP. Chapter 3 is unlocked in the save, but its scenes
are still outlines, so the map shows it as **Coming soon** (state `preview`)
and never opens it as playable. Places beyond it stay undiscovered. The main
menu reads "Chapter 3 coming soon · 10/10 challenges · 2/2 stamps". The
progress counts cover written chapters only.

**Campaign data version 2.** Chapter 2's challenges were reordered. Saved
progress is remapped by game, not by position (Klondike `th-2-1→th-2-2`, War
`2→5`, Go Fish `3→1`, FreeCell `4→3`, Spider `5→4`). This applies to completed
challenges, paid rewards and attempts. The river-map clue is renamed
`old-river-map → sophia-river-map`. No win is lost and nothing pays twice.

## Sound, expressions and effects (Prompt 24)

**Story audio director** (`src/audio/director.ts`). Every id is checked
against the track library by the tests.

| Where                                               | Track                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| Menu and world map                                  | The player's own music                                           |
| Chapter 1: scenes, then the table                   | Downtown FXBG Saturday Walk, then Silent Study Hours             |
| Chapter 2: scenes, then the table                   | River at Dawn, then Turtle Creek (synthesized)                   |
| The adventure continues…                            | Downtown Fredericksburg After Dark                               |
| Later chapters (assigned for when they are written) | Tape Deck Shuffle, High Roller, Shadows of the Occult and others |

- The director sets a _context_ track and never overwrites the player's
  saved choice. If the player picks a track during a Story Mode visit, their
  pick wins until they leave Story Mode.
- Settings → Music → **Story soundtrack** turns the director off. Pause, mute
  and volume always apply.
- Only one track plays at a time. Story changes settle for about 0.2 s and
  then crossfade once, so passing through several screens doesn't stack
  fades.
- Music starts only after a gesture, so browsers allow it.
- The music player shows what is actually playing, and labels the story
  soundtrack as such.

**Expressions.**

- Characters use the same mood → pose mapping, because every expression
  sheet shares one pose layout: speak = talk, think, surprise, victory = greet,
  defeat = doubt, frustration = arms crossed.
- Scenes default to the speaking pose.
- The results panel shows the opponent's reaction: doubt after losing to the
  player, arms crossed after losing a finale, pleased when they win.
- Story characters' portraits now appear at the card table too.

**Effects** (`src/components/story/vfx.ts`, sprites from the Thirteenth Hand
VFX atlas):

- a sparkle for a discovered clue;
- a spectral wisp for the Thirteenth Hand card;
- a wax ring for a passport stamp;
- a card-fan swirl for a deck reward;
- a suit wheel for a newly opened place.

They never appear at a card table and are never needed to follow what
happened. Low effects (Settings → Display) or reduced motion switches them
off.

**Haptics** (only with Haptic feedback on, on supporting devices): a light
tap when a card is picked up and when a move lands, a success pattern for a
discovery, and a celebration for a finished chapter. Achievements keep their
existing feedback.

**Loading.**

- Story Mode shows only cut sprites and thumbnails, never source atlases.
- The story manifest loads when the browser is idle after boot.
- Story Mode warms only the current chapter's portraits and the next place's
  map tile.
- Undiscovered places load nothing.
- A Playwright test enforces this budget.
