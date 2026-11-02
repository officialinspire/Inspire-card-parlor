# Gameplay interaction

How the card tables take input and give feedback (Prompt 31). The game rules,
saves, achievements and deck/board choices are unchanged.

## Solitaire input (`src/games/solitaire/SolitaireView.ts`)

**Pointers**

- One pointer at a time.
- Primary pointer, main button only: a right-click or a second finger never
  lifts a card.

**Taps versus drags**

- A press becomes a drag only after it travels past the slop: 10 px for a
  finger, 5 px for a mouse. A slightly shaky tap is still a tap.
- A press on a card that can't be picked up and then slides away does
  nothing. It never becomes a stray tap somewhere else.
- **Double tap:** the second tap must land on the same card within 350 ms
  of the tap that selected it. The card then goes to its best spot.
- **No ghost clicks:** a tap that only completed a move never arms a
  double tap.

**Interrupted drags**

- A cancelled touch (`pointercancel`), a lost pointer capture, Pause or
  leaving the table all send carried cards home.
- None of these makes a move or plays an error sound, and no card is left
  half-dragged.

**Aiming a drop**

- The landing pile is the one under the finger. Failing that, it's the one
  under the middle of the carried card, since fingers hold cards by their
  top edge.
- A legal destination wins over an illegal one.
- The legal landing spot is outlined while carrying (`data-drop`).
- Dropping on open felt is a quiet snap home.

**Performance**

- Dragging paints once per animation frame.
- The carried card's start box is read once when it is lifted, so there are
  no layout reads during the drag.

**Busy states**

- A tap during the opening deal skips the deal and then acts.
- Auto-finish blocks input only while it runs.

## War and Go Fish

**Animation waits:** every wait on an animation is capped (`settle()` in
`src/games/session.ts`). A cancelled, throttled (hidden-tab) or detached
animation can't hold a round or a CPU turn.

**War:** a flip that is interrupted still leaves the card face up.

**Go Fish CPU turns:**

- The CPU loop is capped, and it stops if three asks in a row change
  nothing, rather than spinning. The engine always advances, so this is a
  safety net.
- One request dialog at a time: a double tap on a card can't open two.

## Opponent reactions (`src/components/Avatar.ts`)

`setAvatarMood()` shows a table mood. Each mood maps to one of the
expression-sheet poses that Story Mode already uses:

| Mood     | Pose                | When                                                               |
| -------- | ------------------- | ------------------------------------------------------------------ |
| neutral  | `portrait-neutral`  | Resting.                                                           |
| talk     | `portrait-talk`     | Greeting, asking, "Go fish!".                                      |
| think    | `portrait-think`    | A Go Fish CPU choosing its ask.                                    |
| surprise | `portrait-surprise` | War declared; a lucky draw.                                        |
| win      | `portrait-greet`    | Winning a war or a book; receiving cards; winning the game (held). |
| lose     | `portrait-doubt`    | Losing a war; giving cards away; losing the game (held).           |

- **How long:** reactions last about a second, then return to neutral.
- **Preloading:** the small pose thumbnails are fetched when the table
  opens, so a change of face never waits on a download.
- **Opponents without a sheet** keep their portrait and show the mood as
  one small motion. There is none under reduced motion.
- **The player's side:** no lines are written for the player beyond the
  existing ask and "Here you go" labels for their own actions.

## Sound and haptics

**Sound** (`src/audio/gameSounds.ts`):

- Rate limits per event, and merging within one action, are as before.
- A quick run of the same sound now gets gradually softer, down to 55 %.
  Wins always play in full.
- Volumes, mute and the sound-effects slider all still apply, through the
  sfx bus.

**Haptics** (`src/utils/haptics.ts`):

- The same pattern buzzes at most every 140 ms.
- No buzz comes within 60 ms of another.
- A long cascade never becomes a continuous vibration.
- Haptics are still off unless the setting is on and the device supports
  vibration.

## Rewards and story

**Once per game:**

- Every game is recorded with a key: the game, its seed and its start time.
- A second report of the same game pays nothing and returns the first
  summary.
- Story rewards were already once-only (`story.rewarded`).

**Story progress:**

- Clues and rewards are written when the game is recorded, before any
  closing scene. Skipping a scene can't lose a discovery.
- A loss only counts an attempt. Retrying can't lower progress.

**Return to the chapter:** leaving a challenge returns to its chapter, with
that challenge on screen. This holds for a finish, Back, Home or the
browser's Back (`setStoryReturn` in `src/story/session.ts`).

**Result dialogs:** the solitaire win dialog now shows XP and credits, like
War and Go Fish.

## Tests

- **End to end** (`tests/e2e/interaction.spec.ts`):
  - touch/mouse parity and the drop highlight;
  - shaky taps;
  - cancelled, lost and paused drags;
  - drop aiming and open felt;
  - right-click;
  - rapid input on all three solitaires;
  - War expressions to the result;
  - Go Fish thinking and turn hand-back, and the single request dialog;
  - story return.
- **Unit** (`tests/unit/interaction.test.ts`):
  - once-only payouts;
  - story loss, retry and skip safety;
  - haptic and sound rate limits;
  - capped animation waits;
  - table moods.
