# Performance, accessibility and PWA QA (Prompt 32)

Every number below was measured. Nothing is estimated, and single runs are
called single runs.

**How it was measured**

- **Browser and tools:** Chromium 1243 (Playwright), driven over the Chrome
  DevTools Protocol:
  - `Performance.getMetrics`;
  - `HeapProfiler` (forced GC and heap snapshots);
  - `Network.*` with `Emulation.setCPUThrottlingRate`;
  - axe-core 4.10.3 for the accessibility audit.
- **Server:** the production build, served by a small static server that
  sends GitHub Pages-like headers (`Cache-Control: max-age=600`, ETag, gzip
  for text).
- **Low-end phone profile:** 390×844, CPU slowed 4×, 150 ms latency,
  1.6 Mbit/s down, 0.75 Mbit/s up, no service worker, brief intro.

The measurement scripts live outside the repository (session scratch space).
The leak check, the opening's load order and the axe audit are repeated as
tests (below).

## 1. What profiling found

### 1.1 Every screen leaked: fixed

After a forced GC, measured after each cycle. One cycle = Settings,
Collection, Passport, Story map, and a Klondike table, back to the menu after
each.

| After         | DOM nodes (before → after) | JS event listeners (before → after) | JS heap (before → after) |
| ------------- | -------------------------- | ----------------------------------- | ------------------------ |
| launch        | 440 → 440                  | 78 → 78                             | 3.04 MB → 3.05 MB        |
| 1 cycle       | 2,988 → 955                | 367 → 140                           | 3.66 MB → 3.63 MB        |
| 10 cycles     | 26,191 → 1,163             | 2,950 → 185                         | 4.71 MB → 4.16 MB        |
| **20 cycles** | **52,041 → 1,463**         | **5,820 → 235**                     | **5.35 MB → 4.22 MB**    |

**Per screen.** Before the fix, five round trips per screen, menu ↔ screen,
average per trip after GC:

| Screen         | Nodes leaked | Listeners leaked |
| -------------- | ------------ | ---------------- |
| Settings       | 373          | 52               |
| Collection     | 434          | 61               |
| Passport       | 544          | 31               |
| Story Mode     | 683          | 91               |
| Game selection | 397          | 41               |
| Achievements   | 668          | 70               |
| Statistics     | 351          | 41               |
| Gameboards     | 489          | 46               |
| Table          | 548          | 47               |

After the fix, every screen nets 0 per round trip. Story Mode and Game
selection showed +82 and −82 in consecutive rows: one screen still on its way
out at the moment of measuring, not a leak.

**The cause, found with a heap-snapshot retainer path:**

> `window.__ICP__ → store → listeners Set → closure → … → <span class="pill pill-credits">`

The `live()` helper (credit counters, now-playing chips in every screen
header) unsubscribed only when its store value next changed after the element
had left the page. A credit total that never changes again kept its
subscription for ever. Because a detached child still points to its parent, it
also kept its whole screen.

**The fix** (`src/components/live.ts`):

- Live widgets are tracked.
- `sweepLive()` releases those no longer on the page. It runs whenever a
  screen (`ScreenManager`) or a dialog (`Dialog`) is removed.

After 8 full cycles a heap snapshot holds 27 detached nodes in total: the last
few header pills awaiting the next sweep, which is bounded.

**Stayed flat throughout, before and after:**

- live intervals: 3;
- `window` and `document` listeners: 30 and 8;
- music voices: 1;
- ambience: 1 instance with 3–4 sources.

There were no duplicate timers or audio sources to fix.

### 1.2 The opening downloaded a deck's face sheet it didn't show: fixed

**Before.** On the title, the shuffle shows card backs only, yet drawing any
back loaded the deck's whole artwork bundle, faces included (`faces.webp`,
328 KB). On a slow connection that sheet competed with the title painting.
The "Lighting the riverfront…" step then hit its 3-second cap: painting
finished at 5.68 s, step released at 5.36 s.

**The fix** (`AssetManager.deferFacesUntil`):

- During the opening, a deck loads and shows its back first.
- Its face sheet starts as soon as loading has finished.
- After the opening nothing changes, and the total download is the same.

**Touch to Start appears.** Measured inside the page from navigation start,
low-end phone profile, 7 runs each:

|        | runs (ms)                                | median       | transferred |
| ------ | ---------------------------------------- | ------------ | ----------- |
| before | 5157, 5362, 5314, 5176, 5151, 5183, 5422 | **5,183 ms** | 985 KB      |
| after  | 4235, 4101, 4508, 4311, 4432, 4114, 4406 | **4,311 ms** | 985 KB      |

After the fix, the painting step took 1.37 s (2.53 s → 3.90 s) instead of
running into its cap.

**Corrections to my own method, recorded so the numbers can be trusted:**

- An early version timed Touch to Start with `page.goto()`, which waits for
  the `load` event (every image, including the face sheet after the change).
  The figures above are measured in the page.
- Playwright request interception turns off the HTTP cache. Blocked-URL
  comparisons therefore used CDP's `Network.setBlockedURLs`.
- Vite's preview server sends `Cache-Control: no-cache`. That produced
  duplicate parallel logo downloads not seen with production headers.

**Script cost.** One cold-launch run each:

| Build  | Script | Task  | Long tasks      |
| ------ | ------ | ----- | --------------- |
| before | 129 ms | 4.5 s | 4, total 503 ms |
| after  | 204 ms | 4.6 s | 7, total 997 ms |

These are single runs on a 4×-throttled CPU, with timings that vary run to run;
I don't read a difference into them.

### 1.3 Looked at, measured, no change needed

- **Story art is already lazy.** Fresh profile, story bytes per step:

  | Step                                               | Story assets |
  | -------------------------------------------------- | ------------ |
  | launch + menu (manifest only)                      | 19 KB        |
  | story map (including the next chapter's portraits) | 376 KB       |
  | chapter 1                                          | 21 KB        |
  | chapter 2                                          | 16 KB        |
  | chapter 3                                          | 20 KB        |
  | back to the map                                    | 0 KB         |

  No NPC sprites load at start-up. Each chapter brings only its own art, and
  the map warms the next scene.

- **Music** (5 tracks, 18 MB) is never downloaded at start. It streams when
  played and is left to the browser's media cache.
- **Background effects** are CSS transforms and opacity only (Prompt 30). The
  launch showed no long task from them.

**Transfer sizes** (production build):

| Item                | Raw      | Gzip     | Note                                         |
| ------------------- | -------- | -------- | -------------------------------------------- |
| JavaScript          | 414.6 KB | 136.8 KB | one bundle                                   |
| CSS                 | 149.5 KB | 31.2 KB  |                                              |
| Launch total        | 985 KB   | n/a      | low-end profile; night painting, 15 requests |
| Offline precache    | 2.16 MB  | n/a      | 18 files                                     |
| Story art on disk   | 21 MB    | n/a      | 577 files, on demand                         |
| Card art on disk    | 5.5 MB   | n/a      | 63 files, on demand                          |
| Backgrounds on disk | 3.4 MB   | n/a      | 33 files, on demand                          |
| Music on disk       | 18 MB    | n/a      | on demand                                    |

## 2. PWA

| Check                                                | Result                                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service worker registers; manifest and icons install | existing `pwa.spec.ts`                                                                                                                                          |
| Offline start after one visit, progress kept         | existing `pwa.spec.ts`; `hardening.spec.ts` (offline)                                                                                                           |
| Update after a deploy                                | simulated with two real builds (below)                                                                                                                          |
| No stale data with new scripts                       | **changed**: `*.json` (artwork list, card atlases, story manifest) is now network-first, cache as fallback                                                      |
| Story Mode offline from the first visit              | **changed**: the story manifest is precached                                                                                                                    |
| Recovering from an old or broken copy                | **new**: Settings → Data → **Repair offline files**; and the start-up recovery panel                                                                            |
| Offline music and images                             | music falls back to the built-in synthesized tunes and keeps playing; story pictures show their labelled placeholder; layout stays intact (`hardening.spec.ts`) |

**Why the JSON change.** Scripts and styles carry content hashes in their
names. Data files don't, and they were served cache-first.

**Simulated deployment.** A returning visitor holds release A's offline copy
(`index-VEBuoBKT.js`, cache `icp-1.1.0-c2acfa184f`). Release B then goes live:

1. **First reload after the deploy:** runs B's script (`index-BrO1w3aP.js`).
   Navigation is network-first.
2. **Caches:** B's worker activates and deletes A's cache. Only
   `icp-1.1.0-eeccb59239` and the font cache remain.
3. **Next start, and an offline start:** both run B from B's cache.
4. **Mixing:** no page ran A's script against B's cache, or the reverse.

A tab left open across a deploy keeps A's worker and cache until it navigates,
so it stays self-consistent. When B's worker takes over a running page, the
player sees "The parlor has been updated to the newest version."

## 3. Error handling

| Case                                                            | Before                                                     | Now                                                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The game's script fails to download (404, a broken copy)        | black screen                                               | Recovery panel "The parlor didn't open" (focus on **Try again**; **Repair offline files**; 48 px buttons), from an inline watchdog in `index.html` that needs no app code |
| The script loads but start-up throws, or never starts           | black screen                                               | Same panel (`main.ts` catch; a 30 s watchdog)                                                                                                                             |
| Uncaught error during play                                      | console only                                               | Logged (`console.error`), counted (`__ICP__.errors()`), one notice per session ("…your progress is safe…"); if no screen is left, the recovery panel                      |
| Rejected promise                                                | console only                                               | Logged and counted; media refusals are not shown to the player                                                                                                            |
| Progress can't be saved (storage full, blocked, private window) | silent                                                     | Notice "Not saving" once, and "Saving works again" on recovery (`src/storage/health.ts`)                                                                                  |
| A game can't be saved (IndexedDB abort or closed)               | silent; a closed database could throw                      | Reported the same way; never throws                                                                                                                                       |
| The browser refuses audio (`new AudioContext()` throws)         | unhandled rejection on every tap                           | Sound stays off, play continues, no error                                                                                                                                 |
| Broken artwork                                                  | already: labelled placeholders, drawn card faces and backs | unchanged; verified offline                                                                                                                                               |

## 4. Accessibility

**Automated audit.** axe-core, WCAG 2.0/2.1 A and AA rules. It covers the
title, the menu, every menu screen, all six Settings tabs, the story map, a
chapter, the arrival scene, the challenge brief, the versus card, and the War,
Klondike and Go Fish tables.

| Rule                                                                   | Before   | After                                               |
| ---------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `aria-allowed-attr` (music tracks: `aria-checked` lost its radio role) | 12       | 0                                                   |
| `aria-progressbar-name` (Statistics)                                   | 1        | 0                                                   |
| `aria-prohibited-attr` (Go Fish "Your books")                          | 1        | 0                                                   |
| `color-contrast`                                                       | 78 nodes | 60 nodes, all checked against rendered pixels below |

**The role fix behind `aria-allowed-attr`.** The paginator forced
`role="listitem"` onto every tile. That also stripped the button role from
every paginated tile button: challenges, decks, boards and tracks. Now:

- a tile that is a control keeps its role, and its page becomes a labelled
  group;
- plain tiles stay list items.

**Contrast.** Fixed:

- **Night accent text** (active tabs, chosen options, slider values): 4.3:1 →
  5.2:1, using `--accent-text: #ec8d68` on the night panels (6.0:1 on sunken
  panels). Day mode is unchanged.
- **Night "danger" button:** 3.2:1 → 5.1:1, with dark ink on the red.

The remaining axe contrast reports all name a black background. That's what
axe assumes when it can't see through gradients, images and translucent
panels. Each was re-measured against the rendered pixels (text hidden,
background averaged):

| Element                  | Ratio  | Background  |
| ------------------------ | ------ | ----------- |
| Touch to Start sub-label | 8.2:1  | gold button |
| Locked-tile labels       | 6.5:1  |             |
| Board ambience note      | 4.9:1  |             |
| Map place names          | 12.4:1 | parchment   |
| Chapter tile kicker      | 7.1:1  |             |
| Challenge objective      | 6.5:1  |             |
| Challenge rewards        | 6.1:1  |             |

The title sub-label was flagged only because axe sampled it mid fade-in. The
in-test audit therefore runs every rule except `color-contrast`, which is
covered by this pixel check.

**Keyboard, new.** The solitaire tables can now be played from the keyboard.
Before, only undo, hint, pause and deal had keys; there was no way to pick up
or place a card.

- Tab focuses the table, which shows a gold outline.
- The arrow keys move a visible cursor between piles and through a column's
  face-up run.
- Enter or Space acts like a tap (pick up, put down, deal); Escape cancels.
- Every step is announced through a polite live region, for example "Holding
  7 of hearts. Column 4: 8 of clubs." and "Moved."

War and Go Fish were already keyboard-playable (Space, A, S, P, R; rank keys
and arrows in the ask dialog).

**Zoom, restored.** The viewport no longer sets `maximum-scale=1,
user-scalable=no`, and the iOS pinch blocker is gone, so low-vision players
can zoom.

- Double-tap zoom stays off (`touch-action: manipulation`).
- The card tables keep `touch-action: none`, so play feels the same.

**Already in place and re-verified:**

- visible `:focus-visible` outlines everywhere;
- dialog focus trapping and restoration (`layout.spec.ts`);
- reduced motion and Low effects (Prompts 24, 28–31);
- adjustable master, music, effects and ambience volumes;
- the 12 px type floor and text wrapping (Prompt 28);
- 44–48 px touch targets (layout checks).

## 5. Seven sizes, whole journey

At 320×568, 360×640, 390×844, 430×932, 667×375, 844×390 and 768×1024
(`hardening.spec.ts`):

- launch and the menu;
- Chapters 1 and 2 and the later Chapter 7;
- a Chapter 7 story table;
- the challenge result (reward);
- the return to its chapter;
- Klondike, Spider and War sessions;
- three Settings tabs;
- Back to the menu.

Each step runs the Prompt 28 layout checks: no overflow, no clipped text, no
covered or off-screen control. No page errors. Result: **7/7 passed**.

## 6. Tests and gates

**New tests:**

- `tests/e2e/hardening.spec.ts`:
  - the leak regression (CDP node count);
  - the opening's load order;
  - the broken-script recovery panel;
  - Repair offline files, keeping progress;
  - save-failure notices;
  - error logging and notice;
  - refused audio;
  - offline start with art and music fallbacks;
  - keyboard solitaire;
  - the axe audit;
  - the seven sizes.
- `tests/unit/hardening.test.ts`:
  - live-widget release;
  - storage health reporting;
  - deferred card faces.

**Results** (recorded in the commit for this prompt):

- typecheck, unit tests, deck validation, story validation, format check,
  build;
- `hardening.spec.ts`: 27/27 on phone and desktop;
- full e2e: see §7.

## 7. Full end-to-end run

Recorded after the run; see the commit message for the final counts.

## Visual loading and offline artwork — November 7, 2026

- After boot, prepare the selected deck/table and the next available story challenge, including chapter dialogue poses. Sprite warming uses two low-priority transfers/decodes at a time; speculative boot warming respects Data Saver.
- Await image decode before publishing card-atlas and board URLs. Concurrent deck requests now await the full deck rather than treating the opening's back-only publication as complete.
- Failed image requests and story-manifest requests can retry; reconnect clears resolved deck fallbacks before warming again.
- Release artwork is cache-first without re-fetching cached images. Fetch events retain cache writes. Release cache hashes include emitted visuals, metadata and worker source, so artwork-only deployments refresh correctly.
- Settings → Data → **Download visuals for offline play** saves the complete standard visual library, including unused story chapters and unlockable decks, without decoding it all. The generated manifest has 673 files / 28.46 MiB in the standard build. Two workers download with per-file timeouts; retries reuse completed files, failures are counted, and success is shown only after all cache writes complete. Mature folders and streamed music are excluded.
- Installing the PWA automatically downloads the visual pack. Installed launches (including iOS home-screen launches), reconnects and worker updates recheck it. A completion marker lives in the release cache, so completed packs are reused and a new release downloads its visuals automatically. Interrupted packs reuse saved files on retry. Download start/completion notices are silent; the Settings button remains available.
- Offline storage is per device and may be evicted by the browser. Installed launches restore missing packs; existing repair and save-transfer controls remain available.

Validation: 538 unit tests; 13 release browser checks covering phone/desktop offline gameplay, saved progress, update/repair isolation, all Pages-path assets, full visual download, offline fetch of every packed file, representative image decoding and repeat download. Deck and story validators reported zero errors (existing artwork warnings remain documented in ART_ASSET_AUDIT.md).

## Preferred deck and atlas repair

The latest deck selection is now shared by Story Mode and Quick Play, including restored hands. Picking another game restores its board, without restoring an older deck. Story table settings expose deck/back choices while keeping the chapter board and game rules. Versus previews use the same selected deck; ghost rematches do not replace it.

Dante V2's shipped and source PNGs contained damaged IDAT data. Recovered its matching original illustration, recorded its uneven source column/row boundaries in `scripts/art/normalize-dante-v2.py`, and rebuilt all 52 cells at 139×192. Compressed runtime WebP faces/backs/previews for Dante V2, Cannabis Nugs and YummyHole now join the offline visual pack. PNG fallbacks remain supported. Existing illustration-level pip/index imperfections are distinct from the repaired image decoding and sprite cuts.

Regression checks cover changing decks during Quick Play and a story challenge, switching modes/games with older per-game memory present, and reloading the saved preference. A browser audit fully decodes every ready general deck sheet, including the three PNG fallbacks, and checks 13×4 cell dimensions. These checks are part of the release gate.
