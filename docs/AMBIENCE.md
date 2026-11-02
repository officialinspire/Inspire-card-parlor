# Riverfront ambience and environmental effects

The title and main-menu backgrounds are the uploaded day and night paintings
of downtown Fredericksburg across the Rappahannock. They are never replaced or
altered. Prompt 30 adds two things on top: a quiet sound scene, and light
effects placed on what is painted.

## Sources and licensing

| Sound                                                      | Source                                                                                      | Licence                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| River wash and babble, breeze, distant town hum            | Original procedural audio made in the browser from filtered noise (`src/audio/ambience.ts`) | Original work of this project. |
| Leaves, a car far across the river, water lapping at night | Original procedural one-shots, from filtered noise                                          | Original work of this project. |
| Night insects (placeholder)                                | A very soft, sparse synthesized chirp, used only until a recording is supplied              | Original work of this project. |
| Birdsong (day)                                             | **None yet.** A replaceable recording slot exists; no oscillator imitation is used.         | —                              |
| Ambience recordings                                        | **None supplied.** No ambience audio files ship with the game, and none are downloaded.     | —                              |

The five owned music recordings in `public/assets/music/` are not used by the
ambience.

### Adding recordings

`RECORDING_SLOTS` in `src/audio/ambience.ts` lists recordings that replace a
procedural fallback:

- `day-birds` replaces silence with occasional birdsong;
- `night-insects` replaces the placeholder chirp.

Each slot is a list of paths under `public/assets/ambience/`, played at random
as occasional one-shots: panned a little, at 35–60 % level.

To add one:

1. Put a short, clean recording (a few seconds, AAC/M4A or Ogg, mono is fine)
   in `public/assets/ambience/`.
2. Add its path to the slot.
3. Record its source and licence in the table above.

Only add files that are owned or properly licensed for this use.

While a slot is empty nothing is fetched. A file that fails to load (offline,
missing) is skipped for the session, and the fallback stays.

## Levels

- **Its own bus:** ambience has a bus under the master gain, so **Mute all**
  and **Master volume** apply. Its own volume is
  `Ambience volume × 0.22`, below the music bus (`Music volume × 0.35`). Both
  pass through the master limiter, so the combination cannot clip.
- **Quiet by design:** the beds are filtered noise at modest gains, and the
  one-shots peak lower than the beds.
- **Where it plays:**
  - full on the main menu;
  - 35 % on other menu screens (Settings, Collection, Passport…);
  - silent in Story Mode (dialogue and the story soundtrack) and at the card
    table.
- **Settings → Audio:**
  - **Riverfront ambience** turns it on or off;
  - **Ambience volume** sets its level;
  - music has its own volume and pause.
    So music-only and ambience-only are both possible.

## Behaviour

- **No sound before Touch to Start.** No audio context exists before the
  first gesture, and the title screen is silent even after one (skipping the
  intro is a gesture).
- **Fades:**
  - Ambience fades in over 2.4 s as the menu rises from black.
  - Day ↔ night crossfades over 3 s.
  - Leaving for a game or Story Mode fades it out over 1.2 s and releases
    every source.
  - Coming back to the menu within that fade picks the same scene back up
    instead of starting a second one.
- **One scene at a time.** At most two instances exist, briefly, during a
  crossfade. Repeated navigation never stacks loops; the e2e test makes 20
  fast round trips.
- **No clicks.** Every fade starts from the gain's current value
  (`rampParam`), so an interrupted fade never jumps. The bed loops are white
  noise filtered after the loop point, which has no audible seam.
- **Hidden tab.** The audio context suspends with the page. One-shots aren't
  scheduled while it's hidden, so nothing piles up for when it returns.
- **Offline.** The procedural ambience needs no network.

## Visual effects

The effects sit in `.env-frame`, which `src/components/environment.ts` lays
exactly over the painting as it is shown (cover-fit, cropped to the screen).
Percentages are therefore the painting's own coordinates, and the effects stay
on the painted features at any screen shape.

| Day                                                                                             | Night                                                                                         |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Light moving on the river (the lower band)                                                      | The lit windows along the skyline breathe slowly                                              |
| A faint warm sunlit glow in the sky                                                             | A soft halo on the painted moon (top right)                                                   |
| Five leaves leaving the framing trees on long, staggered cycles; one or two are ever in the air | A faint cool glint on the water under it; warm reflections shimmer                            |
|                                                                                                 | Stars in the open sky (clear of the moon); six warm motes drifting on the wind over the water |

- **No new objects.** Nothing is drawn into the scene that isn't painted:
  light, glints, a few leaves from painted trees, and motes.
- **Never over controls.** Everything is behind the menu and ignores pointer
  input.
- **On the title screen,** which blurs the painting, only the light effects
  show; leaves and motes are left off.
- **Turned off by** reduced motion, Low effects, data saver, or a low-memory
  or low-core device. The scene then stays still, and the sound is unaffected.
- **Cost:** CSS only: transforms and opacity, under 40 small elements, no
  canvas.

## Tests

- **Unit** (`tests/unit/ambience.test.ts`):
  - where it plays;
  - the controller (fade in, duck, fade out, return, one crossfade, nothing
    restarted during rapid navigation);
  - click-free ramps;
  - defaults;
  - empty recording slots.
- **End to end** (`tests/e2e/ambience.spec.ts`):
  - nothing before Touch to Start;
  - the day scene with the menu;
  - day/night crossfade and smooth level changes;
  - mute, music-only and ambience-only;
  - a game silences it and the menu brings it back;
  - rapid navigation;
  - hidden-tab suspend and resume;
  - offline, with no recording fetched;
  - mobile autoplay rules;
  - Low effects stills the scene.
