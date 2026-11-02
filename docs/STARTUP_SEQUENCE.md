# Startup sequence

The opening of INSPIRE CARD PARLOR — THE THIRTEENTH HAND (Prompt 29).

| Stage          | What you see                                                                                                                     | Ends when         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Black          | A true black screen. The first frame is black before any stylesheet loads (inline style in `index.html`).                        | 0.45 s            |
| Presents       | “INSPIRE SOFTWARE · OFFICIAL INSPIRE · ♠ ♥ ♦ ♣ · presents”, gold lettering with one slow sheen.                                  | 2.75 s, or a skip |
| Title          | The game logo, “THE THIRTEENTH HAND”, the shuffle and the real loading progress over the blurred riverfront.                     | Loading finishes  |
| Touch to Start | A large gold **Touch to Start** button. A tap anywhere, Enter or Space also starts.                                              | The player starts |
| Leaving        | The title fades to black (0.42 s). The main menu then rises out of black (1.1 s), its usual entrance playing as the black lifts. | —                 |

- **No separate studio mark.** The studio has no intro logo among the
  game's assets, so the presents card is a text treatment in the game's
  display face. No new logo was drawn.
- **Real loading only.** Loading runs from the first frame, and every step
  is real work (`src/core/boot.ts`):
  - storage;
  - the artwork list;
  - the logo and the menu painting, each capped so a slow image can't hold
    up the start;
  - fonts.
    The old fixed waits are gone.
- **No start before loading finishes.** Touch to Start appears only once
  loading has finished. Until then, taps and keys do nothing.

## Skipping and starting

- **Skipping:** a tap, Enter, Space, Escape or the **Skip intro** button
  jumps from the black or presents stage straight to the title. A skip never
  starts the game; starting needs its own tap or key.
- **Starting:** the start runs once, however fast the taps come. Inside the
  gesture it:
  1. unlocks Web Audio (as Safari on iPhone requires);
  2. plays the soft synthesized chime;
  3. starts the menu music, unless music is paused;
  4. counts the visit.
     The riverfront's ambient motion begins with the menu.

## Which version plays

Settings → Display → **Startup intro**:

- **Auto** (the default): the full intro on the first launch on a device.
  After that, and on a quick refresh in the same tab, the brief version
  opens at the title.
- **Full:** the full intro on every launch (still skippable).
- **Brief:** always the brief version.

Launch history is kept outside the save, under `icp:intro-seen` and the
session key `icp:intro-played`, so resetting progress doesn't change it.

## Never replayed, never trapped

- **Never replayed:** the intro is reachable only from launch. Returning
  from a game, or from any screen, goes to the main menu.
- **Browser back:** the browser's Back (or Android's back gesture) steps
  back inside the parlor (`src/core/browserBack.ts`). It closes a dialog
  first, and a game still asks before leaving the table. From the main menu,
  Back leaves normally, and it never returns to the intro.
- **Hidden tab:** the sequence pauses its timeline and animations while the
  tab is hidden, and resumes where it was.
- **Teardown:** every timer and listener is released when the screen goes.

## Motion

- **Default:** short opacity fades with a very slight scale on the presents
  card and the existing logo reveal, a slow sheen on the studio name, and a
  gentle glow on Touch to Start.
- **Reduced motion** (the setting, or the system preference on first
  launch): the same stages as quick cuts, with no sheen, shine, motes or
  glow.
- **Low effects:** no motes or logo shine.

## Tests

- **Unit** (`tests/unit/intro.test.ts`):
  - which version plays;
  - the stage timings;
  - the pausable timeline.
- **End to end** (`tests/e2e/intro.spec.ts`):
  - fresh launch (black first frame, stage order, start only when ready,
    target size, the fade to and from black);
  - skipping, quick refresh, returning launch and the setting;
  - slow artwork and images;
  - keyboard start, rapid taps, mute and reduced motion;
  - a hidden tab;
  - an iPhone-like touch context;
  - browser Back.
- **Helper:** `tests/e2e/helpers.ts` `enterParlor` presses Skip when the
  intro is playing.
