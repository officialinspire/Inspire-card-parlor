# Release notes

## Unreleased — The Thirteenth Hand, complete

All nine chapters are written and playable, on the development branch.
Nothing is merged or deployed.

- **Chapters 3–9.** Dante's neon commission, Jak's records request, Mrs.
  Gray's dossier, Steve at Lodge No. 4, Mary Ball Washington at Kenmore, the
  tunnels, and George Washington's ghost at the spectral card table. Each
  chapter has an arrival scene, scenes before and after all five challenges,
  and a departure.
- **The clue chain.** Every clue leads somewhere: the four suit marks, the
  order Steve reads from them, “Kenmore — ask Mother” on the ledger's blank
  line, Mary's letter, and the iron key.
- **The four-suit door.** In Chapter 8 you set the four marks in order before
  the last challenge. Wrong tries earn hints, the last of which gives the
  answer, and the card games themselves are unchanged.
- **The ending.** The finale, an epilogue with the whole cast, and **ghost
  rematches**: free-play War tables against George or Mary, who also join
  the War table's opponent list.
- **Table talk.** Dante, Mrs. Gray, Steve and both ghosts now have their own
  written lines.
- **Field notes.** New notes on history (each with a source) and notes that
  say what the story invents.
- **The full script.** `docs/STORY_SCRIPT_COMPLETE.md` is generated from the
  game data (`npm run story:script`).
- **Saves.** The demo's saves carry straight on into Chapter 3. Level ids and
  deals are unchanged, so nothing is migrated or paid twice.

## 1.1.0 — The Thirteenth Hand: first playable mobile demo

The first playable Story Mode: **Chapter 1, Cheryl's Antique Shop** and
**Chapter 2, Sophia's Rappahannock River Station**. Each has five challenges,
and the demo ends with a preview of Chapter 3 (Dante's iSMOKESHOP) marked
"Coming soon". Every free-play game is unchanged and still available from the
main menu.

### What's new

- **Story Mode, rebuilt as an illustrated adventure.**
  - A world map of nine places. Only the places you have reached are shown;
    later ones stay undiscovered.
  - Chapter and challenge cards.
  - A dialogue engine with character expressions. The player is a silent
    observer and never speaks.
  - A "you vs" card before each challenge.
  - A quest journal: clues, chapter summaries, scene replay.
  - Illustrated results, and passport stamps drawn from the uploaded art.
- **Chapters 1 and 2, written and playable.**
  - Ten challenges across all five games. Every fixed deal is proven
    winnable, and Go Fish is set to Easy.
  - Eight clues to collect.
  - Optional field notes on real wildlife and local history, each with a
    source.
  - Two passport stamps.
  - The Eastern Woodlands deck and two story gameboards as rewards.
- **Campaign data for all nine chapters.** Chapters 3–9 are outlined (plot,
  challenges, rewards) but not yet written, and the game never offers them as
  playable.
- **Saves upgraded safely.**
  - Progress from the old campaign (The Card Parlor Chronicles) is archived,
    never counted as new-campaign wins.
  - Everything earned stays owned.
  - Rewards are paid once.
  - Chapter 2's reordered challenges are remapped by game.
- **New decks and boards:** Freemasonry, George Washington's Ghost, and ten
  story gameboards. Adult-rated boards stay behind the existing gate.
- **Mobile-first menu and screens:**
  - Story Mode is featured on the main menu, with one-tap Quick Play.
  - Navigation screens never scroll the page.
  - Larger tap targets and denser galleries.
- **Sound and atmosphere:**
  - A story soundtrack: owned recordings first, and your own pick always
    wins.
  - One track at a time.
  - Story effects from the VFX art (off with reduced motion or the new **Low
    effects** setting).
  - Optional haptics.
- **Performance:**
  - The story art manifest loads when the browser is idle.
  - Story Mode warms only the current chapter and the next place.
  - Map tiles use thumbnails.

### Verification

| Check                    | Result                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run typecheck`      | pass                                                                                     |
| `npm run test`           | 407 / 407 unit tests pass                                                                |
| `npm run validate:decks` | 12 decks, 0 errors; every playable deck has 52 faces                                     |
| `npm run validate:story` | 51 story sheets, 279 sprites, 0 errors (39 artwork notes, see `docs/ART_ASSET_AUDIT.md`) |
| `npm run format:check`   | pass                                                                                     |
| `npm run build`          | pass                                                                                     |
| `npm run test:e2e`       | see the release report                                                                   |

### Known issues

- An achievement earned **during** a War game that you then lose may not show
  its toast. The achievement is still awarded. This predates the demo.
- A few end-to-end tests are timing-sensitive under heavy parallel load and
  pass on re-run: Go Fish keyboard asking, the FreeCell full tap game, deck
  memory across reloads, and a War table on the small phone.
- Jak Gold has no character expression sheet yet. His avatar stands in.
- No illustrated base map of Fredericksburg exists. The world map shows the
  location tiles on a trail in story order.
- The Yummyhole decks still use placeholder artwork, labelled as pending.
- The test hooks on `window.__ICP__` ship in the production build. The
  end-to-end suite drives the built site through them; they show nothing on
  screen.

### Next for Chapters 3–9

See `docs/STORY_CAMPAIGN.md`, "Open items".
