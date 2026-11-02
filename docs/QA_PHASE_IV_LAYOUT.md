# QA Phase IV — typography, text overflow and menu UX

Prompt 28. This pass changes layout and typography only. No game engine or
story text changed: long dialogue lines are paced into panels when shown,
and the campaign data is untouched.

## How the defects were found

The work started from a measured baseline, not from guesses.

- **The audit.** A Playwright audit of the production build rendered 70+
  states at eight viewports:
  - phones in portrait: 320×568, 360×640, 390×844, 430×932;
  - phones in landscape: 667×375, 844×390;
  - tablet: 768×1024;
  - desktop: 1440×900.
- **The states covered:**
  - every navigation screen and Settings tab;
  - the story map, a chapter, every line of a long arrival scene, the
    challenge brief and the versus card;
  - results after a loss and after the finale, the journal tabs and a clue;
  - the Chapter 8 door, the finale's closing scene, the chapter-complete
    panel, the epilogue and the rematches;
  - the War and Go Fish deal dialogs, and all five tables.
- **What each state was checked for:**
  - page overflow;
  - clipped and overlapping text;
  - truncated headings;
  - type under 11 px;
  - text contrast under WCAG AA;
  - controls that are off-screen, covered or under 28 px;
  - dialogs that leave the viewport or whose body has to scroll.
- **A like-for-like count.** The same audit, unchanged, ran on the previous
  commit (`0b65df2`) and on this one.

| Finding                                   | Before | After |
| ----------------------------------------- | -----: | ----: |
| UI text under 11 px                       |    962 |     0 |
| Text contrast under AA (4.5:1, 3:1 large) |    798 |   8 ¹ |
| Truncated headings                        |     45 |     0 |
| Dialog bodies that scroll                 |     11 |   1 ² |
| Overlapping text                          |     10 |     0 |
| Controls off-screen and unreachable       |      9 |     0 |
| Controls under 28 px                      |      8 |     0 |
| Controls covered by other elements        |      3 |     0 |
| Text clipped without an ellipsis          |      3 |     0 |
| **Total**                                 |  1,849 |     9 |

¹ The Collection's favourite star (☆) reads at 4.50:1. It is an icon-only
control, so the requirement is 3:1; the audit applies the text threshold to
it.

² The finale's results on a 320×568 phone list ten rewards, and the body
scrolls. The scrolling is intentional, and a fade marks where more continues.
At 360 px and up, and in every other result, everything fits.

Before/after screenshots are in `docs/qa/phase-iv/`.

## Defects fixed

### Shared tokens and components

1. **Tiny type everywhere.**
   - **Problem:**
     - Labels were sized in nested `em`s down to 9–10.9 px: menu tiles, setup
       steps, stat captions, rarity badges, map tile states, the toolbar.
     - The existing floor was `max(10px, …)`, used inconsistently.
   - **Fix:**
     - A `--fs-min: 12px` token in `tokens.css`.
     - All 80+ small sizes now use `max(var(--fs-min), …em)`, so text still
       scales with its context but never drops below 12 px.
2. **Contrast.** Fixed at the token level:
   - Day `--ink-faint` goes from #9a8e80 (2.4–3.0:1) to #71665a (4.4–5.2:1).
   - Night `--ink-faint` goes from #8a8697 to #a7a3b3.
   - `--accent` (terracotta) goes from #c8643f to #b4562f. That takes
     button text from 3.72:1 to 4.62:1, and terracotta text on the surface
     from 3.64:1 to about 4.6:1.
   - New `--gold-text`, `--sage-text` and `--success-text` tokens are used
     wherever those colours are text; the bright gold fills stay.
   - Day rarity colours are darker, at 4.5:1 or more on their badges.
   - The music player's subtitle uses `--ink-soft` on the sunk panel.
3. **Screen headers.**
   - **Problem:** titles were single-line with an ellipsis, so story screens
     with five header buttons showed "Story M…" or even "3. …".
   - **Fix:** titles wrap to two lines. On phones, a header with four or
     more buttons puts the title on its own row under them.
4. **Settings rows overlapping.**
   - **Problem:** a control's `min-height: 54px` replaced the grid's content
     minimum, so on short screens taller rows (segmented controls) shrank
     and spilled into the next row. At 320 px this covered the War speed
     buttons.
   - **Fix:** `.settings-panel { grid-auto-rows: max-content }`. The panel
     scrolls instead.
5. **Stat captions overflowing.** Passport and Card Games stat captions
   were single-line, uppercase and widely tracked ("AVORITE GAM"). They now
   wrap at word boundaries with tighter tracking.
6. **Dialogs on short screens.**
   - **Problem:** on a 375 px-tall phone in landscape, headers and footers
     left about 185 px for the body. Results, rematches and challenge briefs
     were cut off.
   - **Fixes:**
     - Tighter frames below 520 px tall.
     - Wider panels in landscape.
     - Scene dialogs with a brief or rewards lay out in two columns.
     - Results and rematches widen; rematches sit side by side.
7. **Scrolling looked like clipping.** A dialog body that must scroll now
   fades at the edges where more continues (`data-more-start/end`, the same
   approach as the tab strips), and scroll stays inside the dialog.
8. **Taps falling through a closing dialog.**
   - **Problem:** a closing dialog goes inert at once, so a fast second tap
     during its fade reached the control underneath.
   - **Fix:** a transparent shield over the closed panel catches that tap
     for 320 ms. Input anywhere else passes.
9. **Focus lost after a dialog.** If the control that opened a dialog is
   gone when it closes (opening a chapter replaces the map), focus now moves
   to the screen's title instead of `<body>`.

### Dialogue

10. **Nameplate clipped; portrait squeezing the text.**
    - **Problem:**
      - The nameplate hung over the speech box's top edge, where the stage
        clipped it.
      - The role under the name was cut to "Psychedelic …" at about 10 px.
      - On phones, the 82–124 px portrait left the line a narrow column of
        6–7 short lines.
    - **Fix:**
      - The nameplate is now in the normal flow and the role wraps.
      - Below 420 px, the portrait is a 52 px thumbnail beside the
        nameplate, and the line uses the dialog's full width.
11. **Controls jumping between lines.** The stage is now sized once, when
    the scene opens, to its tallest panel (capped, then it scrolls inside).
    Back, Next, Skip and the actions stay put; a test checks that Next
    doesn't move.
12. **Long passages.**
    - A line over 180 characters shows as consecutive panels, split between
      sentences (`src/story/dialogue.ts`).
    - The speaker and pose carry over, and a discovered clue appears with
      the last panel.
    - A very short closing sentence is kept with the panel before it.
13. **Continue is obvious.** The Next arrow is now a labelled **Next**
    button.
14. **Text reveal.** There is no typing effect: each line appears in full
    at once. The only motion is a 220 ms fade, which Reduced motion and Low
    effects turn off. Replay from the journal is unchanged.

### Screens

15. **Main menu at 320 px.**
    - "Collection" and "Statistics" get short labels ("Decks", "Stats").
    - The tiles give their whole width to the label.
    - The card fan no longer covers "Continue Story".
    - The Quick Play deck and board chips show their art alone (names stay
      in their labels), and "QUICK PLAY" no longer spills onto the deck
      chip.
    - The music title, which had no room, is hidden; the play and next
      buttons remain.
16. **Main menu at 667×375.** Fixed in Prompt 26, and covered here by the
    orientation test.
17. **Map tile names.** Long names ("Rappahannock", "Fredericksburg
    Masonic Lodge No. 4") use up to three lines, in the narrower body face
    on small phones, without mid-word breaks. The state label meets the type
    floor.
18. **Journal chapter cards.**
    - **Problem:** summaries were cut mid-line under the "Solved" badge.
    - **Fix:**
      - Each card shows as many whole lines as its height allows (container
        queries: 3, 2, 1 or none).
      - The card is a button that opens the full summary in a dialog, with
        a "Read ›" cue.
19. **Results.**
    - **Problem:** the art was stacked above the text even in landscape,
      because a shared rule's `column` direction leaked in.
    - **Fix:** art and text sit side by side in landscape. On phones, a
      small portrait sits beside the kicker and title, with the rewards
      full width below.
    - The chapter-complete panel no longer repeats the reward list on short
      screens.
20. **Settings → Music.**
    - **Problem:** the panel had `overflow: hidden`, which clipped the track
      library in landscape. The side-by-side layout also started only at
      700 px wide.
    - **Fix:**
      - The panel scrolls if it must.
      - The side-by-side layout starts at 600 px.
      - In short landscape, the playlists scroll sideways in one row.
      - Touch chips are 36 px tall.
21. **Collection tiles.** The "Art by …" line was squashed to a few pixels
    under the title. Text lines no longer shrink, and a tile too short for
    the credit drops it whole.
22. **Game toolbar.**
    - On phones, two-word labels wrap rather than spill.
    - On a phone in landscape, the side rail is two columns of 44 px
      buttons. With 12 px labels, a single column pushed **More** off-screen
      at 667×375.
23. **Link target.** The Settings → Data link has a 40 px tap target
    instead of 16 px.

## Automated checks

`tests/e2e/layout.spec.ts`, using the in-page checker in
`tests/e2e/layout-checks.ts`, runs on the phone, small-phone,
phone-landscape, tablet and desktop projects.

- **Every screen:** each navigation screen, Settings tab, the chapter view,
  the journal tabs and a chapter summary is checked for:
  - horizontal overflow and page scroll;
  - text clipped without an ellipsis or clamp;
  - text spilling past its button;
  - controls off-screen (unless they are in an on-screen scroll
    container), covered or under 24 px;
  - UI text under 11 px.
- **Every story dialog:**
  - each line of an arrival scene, with no portrait over the text and Next
    never moving;
  - the challenge brief, versus card, door puzzle and results (loss and
    finale);
  - chapter-complete, the epilogue and the rematches.

  Each must fit the viewport and pass the same checks.

- **Focus and stray taps:**
  - Tab and Shift+Tab stay inside an open dialog (focus trap).
  - Escape returns focus to the screen.
  - A second tap at a closed dialog's button lands on the shield.
- **Turning the phone:** the menu at the project size, rotated, and back:
  - nothing overflows;
  - no tile label is cut;
  - the painting is above the panel in portrait and beside it in landscape.

`tests/unit/dialogue.test.ts` covers the dialogue pacing, including every
scene of the campaign.

## Known limits

- The finale's results on a 320×568 phone scroll inside the dialog, with a
  fade (see ² above).
- Hyphenation isn't used: this Chromium has no dictionary for it, so tile
  names wrap at word boundaries and switch to a narrower face instead.
