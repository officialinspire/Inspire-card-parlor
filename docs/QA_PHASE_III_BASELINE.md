# QA Phase III baseline

Baseline for the 1.1.0 demo, "The Thirteenth Hand", on branch
`claude/happy-brahmagupta-8bw5sp`.

- Audited commit: `8349adc`.
- Fixes in this pass are in the commit that adds this file.
- Nothing is merged or deployed.

## How this was run

- **Gates.** The project scripts, run locally (results below).
- **Visual and layout audit.** A Playwright script against a production build
  (`vite build` plus `vite preview`), in Chromium with touch and mobile
  emulation.
  - 8 viewports:
    - 320×568
    - 360×640
    - 390×844
    - 430×932
    - 667×375
    - 844×390
    - 768×1024
    - 1440×900
  - Seeded profile: Chapter 1 complete and Chapter 2 started (1 of 5).
  - Screens covered at every viewport (27 each):
    - Initialization.
    - Main menu.
    - Game, deck and board selection.
    - Collection, gameboards, achievements, passport, statistics.
    - Settings, with all six tabs.
    - Story map, chapter, scene dialog, versus card and journal.
    - A dealt table of each of the five games.
  - What it recorded on each screen:
    - Page scroll.
    - Buttons and links smaller than 32 px.
    - Buttons outside the viewport.
    - Text clipped without an ellipsis.
    - Console errors and page errors.
    - Failed requests and HTTP responses of 400 or higher.
- **Coverage of the other audit areas.** Areas 10–15 (quests and XP,
  music/SFX/mute, save/load and migration, PWA/offline, accessibility) were
  covered by the existing e2e and unit suites, not by new manual passes. Those
  suites run in 8 Playwright projects: phone portrait, small phone, phone
  landscape, tablet portrait, tablet landscape, desktop, the mature edition and
  a GitHub Pages sub-path build. The table below names the specs for each area.

Screenshot references are in `docs/qa/phase-iii/`. The full 216-screenshot
audit set is not committed; regenerate it with the audit script described
above.

## Gate results

| Check                    | Result                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`      | pass                                                                                                     |
| `npm run test`           | 409 / 409 pass, 21 files (2 tests added in this phase)                                                   |
| `npm run validate:decks` | 12 decks, 0 errors                                                                                       |
| `npm run validate:story` | 51 sheets, 279 sprites, 0 errors, 39 artwork warnings (listed in `ART_ASSET_AUDIT.md`)                   |
| `npm run format:check`   | pass                                                                                                     |
| `npm run build`          | pass                                                                                                     |
| `npm run test:e2e`       | full run in progress at this commit; result recorded in the next commit                                  |
| CI on the release commit | Run 45 (`2dbb16d`) **passed**, the first green CI since run 37. Earlier red runs are fixed (D-07, D-08). |

The audit found **0 console errors, 0 page errors, 0 failed requests and 0
HTTP errors** on all 27 screens at all 8 viewports, and no page-level scroll on
any navigation screen.

## Defect summary

| ID   | Sev | Area                       | Title                                                                                                                | Status                       |
| ---- | --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| D-01 | P1  | Games: Spider              | 10th column and stock run off the felt on 320 px phones                                                              | **Fixed**                    |
| D-02 | P1  | Navigation: pagination     | Pager arrows pushed off screen at 320 px when a gallery has many pages                                               | **Fixed**                    |
| D-03 | P2  | Main menu: phone landscape | Labels truncate on short landscape phones ("Collec…", "Klon…", music title 11 px wide)                               | **Fixed**                    |
| D-04 | P2  | Main menu: 320 px          | Status pills slide under the logo                                                                                    | **Fixed**                    |
| D-05 | P2  | Achievements               | The achievement earned at the table could be hidden behind older queued toasts                                       | **Fixed** (this phase)       |
| D-06 | P2  | Release / deploy           | GitHub Pages not enabled; the public URL returns 404                                                                 | Open: needs a repo admin     |
| D-07 | P2  | CI                         | Small-phone music track list tests failed in CI (run 38 onward)                                                      | **Fixed** (`2dbb16d`)        |
| D-08 | P3  | Tests                      | War first-round e2e raced the 650 ms sweep                                                                           | **Fixed** (`8349adc`)        |
| D-09 | P3  | Tests                      | Quick-play reload test exceeds the 30 s budget under load                                                            | **Fixed** (marked slow)      |
| D-10 | P3  | Tests                      | FreeCell full tap game: one tap not registered (desktop, under load)                                                 | Open: root cause unconfirmed |
| D-11 | P3  | Tests                      | Klondike sound-hooks test: 6 sounds where ≤2 expected (phone landscape)                                              | Open: diagnostic added       |
| D-12 | P3  | Tests                      | Go Fish keyboard ask and deck placeholder-art tests: rare failures under load                                        | Open: not reproduced         |
| D-13 | P3  | Story header (≤360 px)     | Story map and chapter titles truncate to "S…" / "2…" beside four buttons                                             | Open                         |
| D-14 | P3  | Settings → Music           | Track chips are 30 px tall (below 44 px target)                                                                      | Open                         |
| D-15 | P3  | Settings → Data            | inspireclothing.art link is 16–20 px tall                                                                            | Open                         |
| D-16 | P3  | Main menu: 320 px portrait | Continue Story title partly under the card fan; Quick Play chips truncate                                            | Open                         |
| D-17 | P3  | Release                    | `window.__ICP__` test hooks ship in production                                                                       | Open (documented)            |
| D-18 | P3  | Content / art              | Known art gaps: no Jak expression sheet, no Fredericksburg base map, Yummyhole placeholder decks, Chapters 3–9 draft | Open (documented)            |

There are no open P0 or P1 defects.

### What the audit flagged that is not a defect

- **"Page N of M" and story map descriptions reported as clipped.** These are
  screen-reader-only (`sr-only`) text, 1 px wide by design.
- **"Journal" reported as clipped on narrow story headers.** This is the
  visually hidden label of an icon button.

## Defects in detail

### D-01 (P1, fixed): Spider columns run off the felt at 320 px

- **Screen:** Spider game table, 320×568 (iPhone SE / 5 class).
- **Steps:**
  1. Set a 320 px wide viewport.
  2. Choose Spider, then Deal.
- **Expected:** All ten columns and the stock sit on the felt.
- **Actual:**
  - The 10th column and the stock extended to x = 319, past the board's right
    edge at 306.
  - Their rank corners were cut off by the board's `overflow: hidden`.
  - The layout was also off-centre: 11 px of margin on the left, −13 px on the
    right.
- **Reference:** `docs/qa/phase-iii/spider-320x568-before-after.jpg`.
- **Root cause:**
  - `SolitaireView.measure()` clamped the card width to at least 28 px.
  - Ten 28 px cards plus 2.5 px gutters need 307 px; the board is 292 px wide.
  - `originX` was then clamped to 0, so the overflow went entirely to the right.
- **Fix:**
  - The 28 px floor now applies only when it fits with 1.5 px gutters.
  - When a layout still overflows, gutters shrink to fit.
  - Result at 320 px: 27.5 px cards from x = 16 to x = 304.
  - At 360 px and wider, and in every other game, the layout is unchanged
    (gutters only shrink on overflow).

### D-02 (P1, fixed): pager arrows pushed off screen at 320 px

- **Screen:** Gameboards and Board selection at 320×568 (9 pages). The same
  rule applies to any pager.
- **Steps:**
  1. Set a 320 px wide viewport.
  2. Open Gameboards.
- **Expected:** The previous and next arrows are fully on screen.
- **Actual:**
  - 9 dots × 30 px plus two 44 px arrows needed 378 px in a 296 px row.
  - The arrows were cut in half at the screen edges (24 px of each visible).
  - Up to 9 pages, the code shows every dot regardless of width.
- **Reference:** `docs/qa/phase-iii/pager-320x568-before-after.jpg`.
- **Root cause:** `MAX_DOTS = 9` was a fixed count, not tied to the row's
  width.
- **Fix:**
  - `maxDotsFor(width)` sizes the dot row to the space beside the arrows
    (5–9 dots).
  - `pageDots()` falls back to the ends-plus-neighbourhood window, with "…"
    gaps, when the dots don't all fit.
  - Unit test added (`tests/unit/logic.test.ts`).

### D-03 (P2, fixed): main menu truncates on short landscape phones

- **Screen:** Main menu, 667×375.
- **Actual:**
  - The panel column was `min(46%, 460px)`, which is 290 px.
  - Labels truncated: "Collec…", "Passp…", "Trophi…", "Statist…", "Klon…",
    "Continue Sto…".
  - The now-playing button was 11 px wide.
- **Expected:** Full labels.
- **Fix:** On landscape screens up to 540 px tall, the panel takes
  `min(60%, 460px)`.
  - Result at 667×375: all tile labels and the story title fit, and the music
    title shows.
  - "Quick Play" eyebrow text is still tight.
  - At 844×390 the panel reaches its 460 px cap.
- **Reference:** `docs/qa/phase-iii/menu-667x375-before-after.jpg`.

### D-04 (P2, fixed): status pills under the logo at 320 px

- **Screen:** Main menu, 320×568.
- **Actual:** The status bar needed 250 px but had 220 px. It overflowed
  leftwards and covered the level ring with the logo.
- **Fix:** Below 340 px wide, the status bar uses smaller gaps and padding and
  28 px rings. It now starts at x = 80, after the logo ends at 78.
- **Reference:** `docs/qa/phase-iii/menu-320x568-before-after.jpg`.

### D-05 (P2, fixed this phase): table achievement hidden by older toasts

- **Steps:**
  1. Start a fresh profile, so the boot achievements are queued.
  2. Earn an achievement during a hand.
  3. Finish the hand.
- **Expected:** The toast with the medal is the achievement just earned.
- **Actual:** The held burst was flushed oldest-first, so a boot achievement
  took the medal slot and the new one was folded into "N achievements earned".
- **First fix (`8349adc`), a regression:** That commit led with the _most
  recent_ achievement.
  - The full e2e run then failed this test in 5 of 6 projects, every time.
  - The routine game-end achievements (such as a first War win) are queued
    after the one earned mid-hand, so they took the slot instead.
- **Fix:** A burst now leads with the first achievement earned since the hand
  started.
  - Achievements still waiting from before the deal can't take the slot.
  - Neither can the routine ones that arrive as the hand ends.
  - The unit test covers both cases: it fails under either earlier rule.
  - The e2e test passes in all 6 projects.
- **Note:** This supersedes the "War loss toast" item in the 1.1.0 release
  notes. Losing was never the cause.

### D-06 (P2, open): GitHub Pages not enabled

- The only deploy run failed at `actions/configure-pages`.
- https://officialinspire.github.io/Inspire-card-parlor/ returns 404.
- **Fix (needs a repo admin):**
  1. Go to Settings → Pages → Source and choose "GitHub Actions".
  2. Merge to `main`, or run the Deploy workflow.

### D-07 (P2, fixed in `2dbb16d`): CI red on the small-phone music list

- **Root cause:**
  - The narrow-card slider rule stacked labels at container widths up to
    320 px.
  - On CI's fonts this took the space from the track list, so the target track
    landed on page 2.
- **Fix:**
  - The rule now applies only up to 250 px.
  - The tests page to their track with `clickInPager` instead of assuming page 1.
- **Status:** CI run 45 is green.

### D-08 / D-09 (P3, fixed): test timing

- **D-08, War first-round test:** The test made several awaits after the
  banner appeared, but the battle cards are swept 650 ms later. It now checks
  the banner and both faces in a single in-page `waitForFunction`. There is no
  fixed sleep.
- **D-09, quick-play reload test:** Two full set-ups, a deal and a reload with
  boot take about 22 s alone and over 30 s on a loaded runner. Marked
  `test.slow()`, which triples its budget; it has no added waits.

### D-10 (P3, open): FreeCell full tap game, one tap lost

- **Where:** Desktop project, full-suite parallel run only.
- **What happened:**
  - At move 924 of a long solver line, one tap did not register, and the test
    timed out waiting for the next state.
  - It passes when run alone.
- **Suspected cause (unconfirmed):** Under CPU load, two taps on the same card
  can fall inside the 350 ms double-tap window and be read as a double-tap
  auto-move.
- **Recommended fix:** In the test driver, wait for the move counter to change
  after each tap instead of tapping on a timer. Alternatively, let the test hook
  disable the double-tap window.

### D-11 (P3, open): Klondike sound-hooks count

- **Where:** Phone-landscape project, once, in the full suite.
- **What happened:**
  - The test expected at most 2 error/move sounds from a scripted sequence and
    saw 6.
  - It did not reproduce in 8 isolated repeats.
- **Diagnostic:** The test now prints the sound log (`SOUND-LOG`) when it
  fails, so the next occurrence shows which sounds fired.
- **Suspected cause:** Late deal-animation sounds counted in the window.

### D-12 (P3, open): rare e2e failures not reproduced

- **Go Fish keyboard ask:**
  - Investigated: no auto-reopen of the picker, and the table's Enter handler
    is guarded by the modal check.
  - Passed 3/3 when run on its own.
- **Deck placeholder-art test:** Passed 3/3 when run on its own.
- **Next step:** Keep watching. Capture a trace on the next failure
  (`trace: 'retain-on-failure'` is already set).

### D-13 to D-16 (P3, open): layout polish

- **D-13, story header:** The map and chapter titles truncate on screens up to
  360 px wide. Four 44 px header buttons leave about 70 px.
  - Recommended fix: move the music and journal buttons into the story's own
    toolbar, or wrap the title onto a second line at those widths.
  - Reference: `docs/qa/phase-iii/story-320x568.jpg`.
- **D-14, Settings → Music:** Track chips are 30 px tall.
  - Recommended fix: a 44 px minimum height on touch devices, which costs one
    row of chips per page.
- **D-15, Settings → Data:** The brand link's text box is 16–20 px tall. Its
  padding gives a larger hit area in the footer, but not in Settings.
  - Recommended fix: the same padding rule.
- **D-16, main menu at 320 px:** The card fan overlaps the end of "Continue
  Story", and the Quick Play deck and board chips truncate to "Bla… / Sta…".
  - Recommended fix: hide the fan below 340 px and let the chips show icons
    only.

### D-17 / D-18 (P3, documented)

- **D-17, test hooks:** `window.__ICP__` is how the e2e suite drives the built
  site, so it ships in production.
  - Recommended fix: gate it behind a build flag, with a separate test build.
- **D-18, art gaps:**
  - Jak Gold uses his avatar (no expression sheet).
  - There is no illustrated Fredericksburg base map; the trail layout stands
    in.
  - The Yummyhole decks use labelled placeholder art.
  - Chapters 3–9 are drafts and are shown only as "Coming soon" previews.
  - All are disclosed in-app and in `RELEASE_NOTES.md`.

## Audit areas

| #   | Area                                   | Result                                                                                                | Evidence                                                 |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Initialization and menu transitions    | Pass. Boots to the menu at all 8 viewports with no errors.                                            | audit; `title.spec`, `main-menu.spec`                    |
| 2   | Navigation, pagination and dialogs     | Pass after the D-02 fix. No page scroll on any navigation screen. Dialogs are reachable.              | audit; `screens.spec`, `main-menu.spec`                  |
| 3   | Typography and clipping                | D-03 and D-04 fixed; D-13 and D-16 open (P3).                                                         | audit screenshots                                        |
| 4   | Story map usability                    | Pass. Undiscovered places are hidden, locked and completed states are clear, the preview is marked.   | audit; `story.spec`, `demo.spec`                         |
| 5   | Dialogue and journal text              | Pass. Scenes page and the journal paginates at 320 px.                                                | audit; `story.spec`                                      |
| 6   | Sprite scaling                         | Pass. Portraits and location tiles scale at all viewports.                                            | audit; `story-art.spec`                                  |
| 7   | Deck and board galleries               | Pass after D-02.                                                                                      | audit; `decks.spec`, `tables.spec`, `customization.spec` |
| 8   | The five game engines                  | Pass after D-01. All five deal and render at all 8 viewports.                                         | audit; `games.spec`, `solitaire*.spec`                   |
| 9   | Touch input                            | Pass (suite); D-10 open (P3, test-only).                                                              | `solitaire.spec`, `games.spec` (touch projects)          |
| 10  | Quests, XP, unlocks and achievements   | Pass; D-05 fixed.                                                                                     | `progression.spec`, `demo.spec`, unit tests              |
| 11  | Music, SFX and mute                    | Pass: one track at a time, mute is respected, the player's pick wins.                                 | `story-audio.spec`, `toolbar.spec`, unit `music.test`    |
| 12  | Save/load and legacy migration         | Pass: archive, remap, rewards paid once.                                                              | unit migrate tests; `progression.spec`                   |
| 13  | PWA and offline                        | Pass locally: precache, offline reload, sub-path build. Not checked on the public URL (D-06).         | `pwa.spec`, `assets.pages.spec`                          |
| 14  | Console errors and broken assets       | Pass: 0 at all viewports.                                                                             | audit; `artwork.spec`                                    |
| 15  | Accessibility, keyboard, focus, motion | Pass: focus rings, keyboard play, reduced motion and low effects. D-14 and D-15 (small targets) open. | `main-menu.spec`, `games.spec`, `customization.spec`     |

## Remaining QA backlog (priority order)

1. D-06: enable GitHub Pages (admin). Then verify the public URL, including
   offline install.
2. D-10 and D-11: make the tap and sound tests wait on state, not time.
3. D-13 and D-16: story header and 320 px menu polish.
4. D-14 and D-15: 44 px targets in Settings.
5. D-17: gate the test hooks behind a build flag.
6. D-18: art for Jak's expressions and a base map, before Chapter 3 content.
