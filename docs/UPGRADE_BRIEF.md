# Upgrade brief: The Thirteenth Hand, incremental quality series

This brief governs a series of incremental quality prompts. It is an upgrade,
not a rewrite: each prompt improves what exists and keeps everything listed
under **Guardrails** working exactly as it does now.

## 1. Where the series starts

|                  |                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository       | `officialinspire/Inspire-card-parlor`                                                                                                                                              |
| Upgrade branch   | `claude/happy-brahmagupta-8bw5sp`, reused for the whole series                                                                                                                     |
| Branch base      | `origin/main` at `d04b0aa` ("Fix Actions failures and polish menu audio and Story Mode (#4)"), merged in, so the branch's tree matched `main` exactly before this prompt's changes |
| Released version | 1.2.0 (`package.json`); the live site serves cache `icp-1.2.0-052740d9c0`                                                                                                          |
| Public site      | https://officialinspire.github.io/Inspire-card-parlor/ (HTTP 200 on 2026-11-03)                                                                                                    |
| `AGENTS.md`      | none in the repository. This brief and the docs it links are the working agreement                                                                                                 |
| Merge policy     | do not merge to `main` until asked                                                                                                                                                 |

**Since 1.2.0, `main` gained:**

- PR #3: offline storage protection and Pages release validation
  (`npm run test:release`);
- PR #4: Actions fixes, menu audio and Story Mode polish.

The branch's earlier history (the 1.2.0 release, and a Jekyll workflow added
and then removed) is already in `main` or nets to nothing.

**Known test status to resolve early in the series.** The last local full
end-to-end run was on the 1.2.0 release code (before PRs #3 and #4). A worker
restart cut it off at 712 of 1,078 tests. Up to that point it had one
repeatable failure, `tests/e2e/quick-play.spec.ts:61` ("locked decks explain
how to unlock them"), on phone-portrait, small-phone and phone-landscape.
Whether it still fails on current `main` has not been checked yet. Treat it as
open until it is reproduced or cleared.

## 2. Guardrails (apply to every later prompt)

Preserve, unchanged in behavior:

- **All nine chapters**, `th-1` … `th-9`. Check the actual code; don't trust
  legacy comments.
- **All 45 challenge ids** (`th-N-M`) and the **campaign and save ids**:
  `CAMPAIGN_ID = 'thirteenth-hand'` and `CAMPAIGN_VERSION = 2` in
  `src/story/ids.ts`.
  - Story progress keys: `completed`, `rewarded` (`level:<id>`,
    `chapter:<id>`), `stamps`, `introsSeen`, `attempts`, `evidence`.
  - Profile schema 3, and the legacy archive in `profile.legacyStory`.
  - If the meaning of any id must change, bump `CAMPAIGN_VERSION` and add a
    migration.
- **Every verified seed, game, option and objective** (table below). Never
  swap a deal for one that hasn't been verified.
- **One-time rewards:** level and chapter rewards are paid once
  (`story.rewarded`), and games are recorded once per key.
- **Every clue discovery** (the evidence ids below, 23 in all), at the same
  beats, so saves keep their journals.
- **The Chapter 8 puzzle answer:** spades, diamonds, hearts, clubs (on
  `th-8-5`), and the hint ladder that ends by giving the answer.
- **The silent player:**
  - no line belongs to the player;
  - narration addresses "you";
  - no narration reports the player speaking.
- **The five game engines** (Klondike, Spider, FreeCell, War, Go Fish):
  rules, scoring and saves.
- **Accessibility:**
  - keyboard play, focus order and visible focus;
  - dialog focus trap and restore;
  - screen-reader labels;
  - reduced motion, Low effects, contrast tokens and the 12 px type floor;
  - pinch zoom.
- **Mature-content gates:** adult decks and boards stay compiled out of the
  public build and gated in the mature build. The adult-rated iSMOKESHOP boards
  are never used in story scenes.
- **Service worker:**
  - its scope;
  - release-stamped caches;
  - network-first navigation and data files;
  - the offline-storage protections from PR #3;
  - Repair offline files.
- **Pages checks:** CI, deploy and `npm run test:release` stay green.
- **No new framework** and no broad dependency changes.

**Challenge inventory, generated from `src/story/campaign.ts` at the start of
this series.** The last column is the evidence each challenge's scenes
discover. The chapter arrival of `th-1` also discovers `thirteenth-hand-card`.

| Challenge | Game     | Seed            | Options                                | Objective | Clue found              |
| --------- | -------- | --------------- | -------------------------------------- | --------- | ----------------------- |
| `th-1-1`  | war      | 2007            | vs cheryl                              | win       | estate-sale-receipt     |
| `th-1-2`  | klondike | 1008            | draw 1                                 | win       | ledger-of-twelve        |
| `th-1-3`  | go-fish  | fresh (Go Fish) | vs cheryl, easy                        | win       | —                       |
| `th-1-4`  | freecell | 1001            | —                                      | win       | river-postcard          |
| `th-1-5`  | spider   | 1035            | 1 suit                                 | win       | —                       |
| `th-2-1`  | go-fish  | fresh (Go Fish) | vs sophia, easy                        | ≥3 books  | field-journal-page      |
| `th-2-2`  | klondike | 3101            | draw 1                                 | win       | club-mark               |
| `th-2-3`  | freecell | 1016            | —                                      | win       | sophia-river-map        |
| `th-2-4`  | spider   | 1002            | 1 suit                                 | win       | returned-envelope       |
| `th-2-5`  | war      | 2001            | vs sophia                              | win       | —                       |
| `th-3-1`  | klondike | 1013            | draw 1                                 | win       | commission-form         |
| `th-3-2`  | war      | 2026            | vs dante                               | win       | —                       |
| `th-3-3`  | freecell | 1018            | —                                      | win       | monster-card            |
| `th-3-4`  | go-fish  | fresh (Go Fish) | vs dante, easy                         | win       | —                       |
| `th-3-5`  | spider   | 1003            | 1 suit                                 | win       | heart-mark              |
| `th-4-1`  | war      | 2030            | vs jak_gold                            | win       | —                       |
| `th-4-2`  | klondike | 1010            | draw 3                                 | win       | cardistry-receipt       |
| `th-4-3`  | go-fish  | fresh (Go Fish) | vs jak_gold, easy                      | ≥3 books  | redacted-reply          |
| `th-4-4`  | freecell | 3310            | —                                      | win       | —                       |
| `th-4-5`  | spider   | 3415            | 1 suit                                 | win       | diamond-mark            |
| `th-5-1`  | freecell | 1017            | —                                      | win       | —                       |
| `th-5-2`  | war      | 2010            | vs mrs_gray                            | win       | —                       |
| `th-5-3`  | klondike | 3205            | draw 3                                 | win       | thirteenth-hand-dossier |
| `th-5-4`  | go-fish  | fresh (Go Fish) | vs mrs_gray, easy                      | ≥3 books  | —                       |
| `th-5-5`  | spider   | 1009            | 1 suit                                 | win       | spade-mark              |
| `th-6-1`  | klondike | 1021            | draw 1                                 | win       | —                       |
| `th-6-2`  | war      | 2021            | vs steve_gonzales                      | win       | —                       |
| `th-6-3`  | go-fish  | fresh (Go Fish) | vs steve_gonzales+sophia, easy         | ≥3 books  | —                       |
| `th-6-4`  | freecell | 1009            | —                                      | win       | lodge-sketchbook-page   |
| `th-6-5`  | spider   | 1014            | 1 suit                                 | win       | ledger-impression       |
| `th-7-1`  | klondike | 3206            | draw 3                                 | win       | —                       |
| `th-7-2`  | go-fish  | fresh (Go Fish) | vs mary_ball_washington, easy          | ≥3 books  | —                       |
| `th-7-3`  | war      | 3506            | vs mary_ball_washington                | win       | —                       |
| `th-7-4`  | freecell | 1019            | —                                      | win       | mary-letter             |
| `th-7-5`  | spider   | 3405            | 1 suit                                 | win       | kenmore-iron-key        |
| `th-8-1`  | freecell | 3300            | —                                      | win       | —                       |
| `th-8-2`  | go-fish  | fresh (Go Fish) | vs jak_gold+steve_gonzales+dante, easy | ≥2 books  | —                       |
| `th-8-3`  | war      | 2024            | vs jak_gold                            | win       | —                       |
| `th-8-4`  | klondike | 1018            | draw 3                                 | win       | neon-tunnel-map         |
| `th-8-5`  | spider   | 1001            | 1 suit                                 | win       | four-suit-puzzle        |
| `th-9-1`  | war      | 2035            | vs george_washington                   | win       | —                       |
| `th-9-2`  | klondike | 3200            | draw 3                                 | win       | —                       |
| `th-9-3`  | freecell | 3302            | —                                      | win       | —                       |
| `th-9-4`  | spider   | 3400            | 1 suit                                 | win       | —                       |
| `th-9-5`  | go-fish  | fresh (Go Fish) | vs george_washington, easy             | win       | awakened-card           |

**Chapter rewards (once each).** Each chapter pays credits and XP, and:

| Chapter | Passport stamp        | Also                                          |
| ------- | --------------------- | --------------------------------------------- |
| 1       | `th-antique-shop`     |                                               |
| 2       | `th-river-station`    |                                               |
| 3       | `th-neon-monster`     | deck `dantes_world`, board `artists_studio`   |
| 4       | `th-cards-camera`     |                                               |
| 5       | `th-dossier`          |                                               |
| 6       | `th-square-compasses` |                                               |
| 7       | `th-kenmore`          | deck `fredericksburg`, board `kenmore_parlor` |
| 8       | `th-lantern-cellar`   | board `underground_tunnels`                   |
| 9       | `th-spectral-tricorn` | the `chronicles-complete` achievement         |

**Verification for every prompt.** Run:

- `npm run typecheck`;
- `npm test`, which includes the script-document freshness test: regenerate
  with `npm run story:script` after any story data change;
- `npm run validate:decks`, `npm run validate:story`, `npm run format:check`;
- `npm run build`;
- the story e2e specs, plus `npm run test:release` for anything touching the
  service worker or Pages.

## 3. Creative direction

**Audience and genre.** A smart supernatural Fredericksburg mystery for older
teens and twenty-somethings. The town is real, the history is checked, and the
supernatural is played straight enough to be eerie.

**Tone:**

- **Dry comedy.** Humor comes from character and situation: Cheryl pricing
  the supernatural, Mrs. Gray answering questions with questions, George
  refusing to concede. It is not a punchline at the end of every line. Most
  lines should simply be true to the speaker. Let a scene have one laugh, and
  let some have none.
- **Credible relationships.** People have history and friction that doesn't
  resolve on cue:
  - Sophia doesn't like being filmed at work;
  - Cheryl doesn't trust anything she can't invoice;
  - Steve and Sophia agree about evidence and disagree about legend;
  - Mary and George are a mother and son who have been disappointed in each
    other for two centuries.
- **Strange discoveries.** Each clue should feel found, not handed over. The
  story already has the right instruments: black light, 240 fps footage,
  raking light, an older survey under a ranger's map. Lean on how
  perception works.
- **Questions about authority, perception and reputation.**
  - **Authority:** who holds the records, who decides what is redacted, who
    may film where, who keeps the lodge's history, whom a ghost commands.
  - **Perception:** what the eye misses and the instrument catches, and what
    a reputation hides.
  - **Reputation:** George's legend against the man, Jak's channel against
    his diligence, Cheryl's price against an object's worth, Mary's
    indifference to fame.

**Avoid:**

- **Childish exposition:** a character explaining what the player can see, or
  narrating feelings ("This is the most romantic crime I've ever been part
  of").
- **Forced slang**, and dialogue that winks at the audience.
- **Exclamation-mark enthusiasm as personality.** Dante can be warm and
  excited without "Hi! Welcome! Wait —".
- **A joke as every line's last beat.** Candidates for that review include
  several of George's asides ("…And soup."), the "smoothie stain" beat, and
  stacked one-liners in chapter departures.
- **Lecturing.** Field notes carry the facts; characters carry opinions.

**What already works and stays:**

- the silent second-person observer;
- Cheryl's economy ("We close at five. It's ten to.");
- Mrs. Gray's deadpan;
- the clue chain (every clue leads somewhere);
- the history/fiction split;
- the door puzzle that can't block the story;
- George's sulking resolved by his mother's letter.

## 4. Facts, history and lore

`docs/STORY_SOURCES.md` is the fact base. It holds each claim, its exact
source URL and publisher, the intended scene and a verification status, with
history, interpretation and invented lore separated. Rules:

- A `history` field note states only what a source marked **Read** (or
  **Search-confirmed**, once checked by hand) supports, and names that source.
- Characters may hold opinions and readings (interpretation), but a
  character's claim about law or history is correct, or is corrected on
  screen.
- Invented lore is never presented as history. Location `fiction` notes and
  `note` cards say what is invented.
- **Living communities:**
  - the Rappahannock Tribe is a living nation;
  - Fredericksburg Lodge No. 4 still meets;
  - Kenmore and the Washington Heritage Museums are operating historic sites.

  Write about them factually and respectfully. Invent no Tribal lore, no
  Masonic ritual, and nothing about the conduct of real organizations.

- **Real people:** Jak Gold and Steve Gonzales are fictionalized real people,
  portrayed through public, positive traits only.

## 5. Changes made by this prompt

- **Virginia FOIA claim corrected** (`src/story/locations.ts`). "Anyone may
  request public records from Virginia public bodies…" was wrong: Code of
  Virginia § 2.2-3704(A) and the Virginia FOIA Council give access to citizens
  of the Commonwealth and to in-state media. It is replaced by two notes:
  - "Public records in Virginia": who may request; that a custodian may ask
    for name and address; that federal agencies answer under the federal FOIA,
    open to any person.
  - "Filming in public": a First Amendment question, not FOIA, with the
    Fourth Circuit's 2023 _Sharpe_ decision and the limits in non-public
    spaces.
- **Field note `foia-1966` clarified** (`th-4-3`). The federal Act covers
  federal agencies, and a Virginia city answers under the state Act with its
  own exclusions. Jak's request went to the city.
- **Kenmore's dates corrected** from "built in the 1770s" to "from 1769 to
  1775", per the George Washington Foundation.
- **`tests/unit/storySources.test.ts`** keeps these corrections in place.
- **`tests/e2e/demo.spec.ts` fixed: an intermittent failure.**
  - It failed once in four desktop runs: during a beat change the narration
    and the host's portrait are briefly both visible, and the test's `.or()`
    locator rejected matching two elements.
  - It now asserts that either is visible (`.first()`).
  - Game behavior is unchanged.
- **`docs/STORY_SCRIPT_COMPLETE.md` regenerated.**
- **New docs:** `docs/STORY_SOURCES.md` and this brief.
- **`docs/STORY_CAMPAIGN.md` updated:** its fact-check open item now points
  to the sources doc.

No challenge id, seed, objective, reward, clue, puzzle answer, engine or
save format changed.

## 6. Suggested order for the rest of the series

1. **Test baseline.** Reproduce or clear the `quick-play.spec.ts:61` phone
   failure on current `main`, and record a full e2e run.
2. **Fact pass.**
   - Check every "Not yet checked" row in `STORY_SOURCES.md`.
   - Soften the pigpen and "psychonaut" attributions, or source them.
   - Add present-day Rappahannock context only from the Tribe's or federal
     sources.
3. **Voice pass, chapter by chapter**, against the creative direction above.
   Dialogue only, keeping every beat that carries a `discovers`, every pose
   key and every challenge's setup.
4. **Relationship threads:** small recurring beats (Sophia and Jak's
   filming, Steve and Sophia's history versus legend, Mary and George) that
   pay off in the epilogue.
5. **Discovery staging:** make each clue's moment of perception land, using
   the existing VFX and items; no new art pipeline.
6. **Documentation:** after each step, update `docs/STORY_CAMPAIGN.md`,
   regenerate the script, and record results.

## 7. Progress log

**Voice pass, Chapters 1–4.**

- **Where:** `src/story/campaign.ts`, `src/story/cast.ts`,
  `src/games/cpu/storyOpponents.ts` (Cheryl, Sophia, Dante), and one Jak
  greeting in `src/games/cpu/personalities.ts`.
- **"Play before I talk" removed.** Each host now has a reason of their own:
  - Cheryl's inventory before a collector's visit;
  - Sophia's shift, school group and log;
  - Dante's commission deadline;
  - Jak's edit, for which he wants someone who isn't his audience.

  The existing challenges are those tasks.

- **Guardrails verified by script:**
  - discovery beats (index and id) are identical to before;
  - challenge ids, games, setups, objectives, rewards and unlocks are
    identical;
  - no Chapter 1–4 beat exceeds 180 characters;
  - Chapter 1's arrival keeps the beat order the e2e test relies on;
  - all narration addresses "you".
- **Mobile fit:** the new `tests/e2e/dialogue-fit.spec.ts` checks every line
  of every Chapter 1–4 scene at 320×568 and 667×375: arrivals, each
  challenge's opening with its brief, closing scenes and departures. All 8
  tests (four chapters at two sizes) pass.
- **Facts:** the Fones Cliffs line uses STORY_SOURCES T2 (Read); Jak's lines
  follow section 1 of the sources doc. See `docs/STORY_CAMPAIGN.md` for the
  per-character summary.

**Voice pass, Chapters 5–9 and the epilogue.**

- **Where:** `src/story/campaign.ts` (dialogue, outline beats, five new
  field notes), `src/story/cast.ts` and `src/games/cpu/storyOpponents.ts`
  (Mrs. Gray, Steve, Mary, George). See `docs/STORY_CAMPAIGN.md` for the
  per-character summary.
- **New sources** (`docs/STORY_SOURCES.md`):
  - K9–K11: Kenmore's enslaved household (Billy), the ropemakers, and Mary's
    widowhood at Ferry Farm;
  - M4–M6: the working tools, as two Grand Lodges explain them publicly;
  - B1: Burning Man's Ten Principles.

  K8 is now Read.

- **New field notes:**
  - `working-tools` (6-1);
  - `burning-man-principles` (6-4);
  - `kenmore-household` (7-1);
  - `ropewalks` (8-1).

  The chapter note `lodge-history-vs-story` now separates Freemasonry, tarot
  suit lore and the game's own magic.

- **Cast:** Steve's bio drops "military-intelligence connections" (his
  interest is intelligence history, which he studied); Mary's and George's
  bios carry their new motives.
- **Guardrails verified by script:**
  - discovery beats (index and id) are identical to before;
  - every challenge id, game, setup, objective, reward and unlock is
    identical;
  - the door puzzle's prompt, answer, hints and solved lines are identical;
  - no Chapter 5–9 or epilogue beat exceeds 180 characters;
  - all narration addresses "you";
  - the e2e strings ("set the four marks", "Ghost rematches are open") are
    unchanged.
