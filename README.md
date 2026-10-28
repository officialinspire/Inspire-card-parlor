# INSPIRE CARD PARLOR

A cozy collection of classic playing-card games featuring collectible illustrated decks, customizable gameboards, relaxing music, achievements and a story mode.

**Developer:** OFFICIAL INSPIRE · [www.inspireclothing.art](https://www.inspireclothing.art)

> **Status: v0.4.0 — War and Go Fish are playable.** Menus, the card engine, the deck registry, and two complete games with CPU opponents, saved games and statistics. Klondike, Spider and FreeCell deal correctly but their rules are still to come.

## Games

| Game               | Players      | Status                   |
| ------------------ | ------------ | ------------------------ |
| War                | 1 vs CPU     | **Playable**             |
| Go Fish            | 1 vs 1–3 CPU | **Playable**             |
| Klondike Solitaire | Solo         | Deal ready, rules coming |
| Spider Solitaire   | Solo         | Deal ready, rules coming |
| FreeCell           | Solo         | Deal ready, rules coming |

### War

You against a CPU opponent (Jak Gold by default). Controls: **Play Round**, **Auto Play / Pause**, **Speed** (½×, 1×, 2×, Max) and **Restart**; keyboard **Space** plays a round, **A** auto-plays, **S** changes speed, **R** restarts. Card flips, battle and war animations, a round counter, card counts and a victory celebration.

Rules (`src/games/war/WarGame.ts`): 26 cards each; higher card wins (Ace high); ties go to war (three face down, one face up, repeated on further ties); a player short of cards for a war plays all but their last card face down and turns the last one up, and a player with no card to turn loses; winnings are shuffled under the winner's pile; you win by owning all 52 cards (both running out in the same war is a draw).

### Go Fish

You against 1, 2 or 3 CPUs. Tap a card (or press **Enter**) to open the compact rank picker, choose a rank and an opponent, and ask; keyboard: **A 2–9 0 J Q K** pick a rank, **← →** pick an opponent, **Enter** asks. Opponents' cards are only ever shown face down, and requests and replies appear in speech bubbles.

Rules (`src/games/goFish/GoFishGame.ts`, also shown in-game under **How to play**):

- **Deal**: 7 cards each with 2–3 players, 5 with 4.
- **Successful request**: the opponent hands over every card of that rank and you ask again.
- **Go fish**: draw from the pond. Drawing the rank you asked for lets you ask again; any other card ends your turn.
- **Books**: four of a kind are laid down immediately (including from the deal or a draw).
- **Empty hand**: when you need to ask with no cards, draw one and carry on. If the pond is empty too, you sit out the rest of the game. If every opponent's hand is empty, draw instead of asking and your turn ends.
- **Exhausted stock**: going fishing with an empty pond draws nothing and ends your turn.
- **Scoring**: when all 13 books are down, most books wins; ties share the win.

### CPU opponents

`src/games/cpu/personalities.ts` defines **Jak Gold**, **Friendly Local** and **Strategic Opponent**, each with play-style traits (memory, whimsy, pressure on the leader, greed) and their own lines of dialogue. Difficulty (**Easy / Normal / Hard**) limits how much of the game's history a CPU remembers. CPUs decide from a `PlayerView` (`src/games/goFish/view.ts`) that contains only their own hand, card counts, books, the pond size and the public history of requests and replies; other players' cards are never passed in, and a test checks a CPU decides identically whatever the hidden cards are.

Character portraits go in `public/assets/characters/<id>.webp|png`. Until one is uploaded, Jak Gold uses the Jak Gold deck's card back (once that artwork is ready) and otherwise a monogram.

### Saves and statistics

Games save after every round or turn (IndexedDB) and offer **Resume** when you come back. Finished games update per-game statistics (played, wins, streaks, best time, best score), award XP, credits and achievements, and clear the save.

## Tech stack

- [Vite](https://vite.dev) + TypeScript (strict), no UI framework
- HTML5 / CSS3, with custom properties for theming
- Web Audio API (synthesized music and sound effects for now)
- LocalStorage (settings, profile) + IndexedDB (saves, on-device analytics)
- PWA: web manifest + offline service worker
- GitHub Pages deployment via GitHub Actions

## Getting started

Requires Node 20+.

```bash
npm install
```

```bash
npm run dev
```

| Script                        | What it does                                             |
| ----------------------------- | -------------------------------------------------------- |
| `npm run dev`                 | Start the dev server (LAN-accessible for phone testing)  |
| `npm run build`               | Type-check, then build to `dist/`                        |
| `npm run preview`             | Serve the production build locally                       |
| `npm run typecheck`           | Run `tsc --noEmit`                                       |
| `npm run format`              | Format with Prettier                                     |
| `npm run format:check`        | Check formatting                                         |
| `npm test`                    | Unit tests (Vitest + happy-dom)                          |
| `npm run test:e2e`            | End-to-end tests (Playwright, 4 viewports)               |
| `npm run test:all`            | Type-check, unit and end-to-end tests                    |
| `npm run validate:decks`      | Check every deck's definition and required card assets   |
| `npm run assets:placeholders` | Regenerate the placeholder template and per-deck READMEs |

## Testing

```bash
npm test
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

The end-to-end suite runs every flow on a 390×844 phone, a 360×640 small phone, an 844×390 landscape phone and a 1440×900 desktop. It checks that every navigation button works, the main menu fits without scrolling, choices are remembered across reloads, and dialogs, notifications and fullscreen behave. To reuse an already-installed Chromium, set `PW_CHROMIUM_PATH`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. In the repository settings, set **Pages → Source** to **GitHub Actions**. The build uses a relative base path, so it works on both `https://<user>.github.io/<repo>/` and a custom domain.

## Architecture

### Application states

All navigation flows through a single centralized store (`src/core/store.ts`). The current screen is `state.screen`, one of:

```
BOOT → INITIALIZATION → MAIN_MENU
MAIN_MENU ⇄ GAME_SELECTION → DECK_SELECTION → BOARD_SELECTION → GAMEPLAY
MAIN_MENU ⇄ STORY_MODE → GAMEPLAY
MAIN_MENU ⇄ COLLECTION | GAMEBOARDS | ACHIEVEMENTS | SETTINGS | STATISTICS
```

Allowed transitions are declared in `src/core/states.ts`; the store rejects anything else. A history stack powers "back" (button, Escape key), and returning to the main menu clears it.

### State management

`Store` is a small reducer-based store: `dispatch(action)` → pure `reduce()` → listeners. Subsystems attach to it instead of calling each other:

- `ScreenManager` swaps screens with directional transitions
- `attachPersistence` hydrates and saves settings/profile
- `attachAudio` keeps volumes in sync and pauses audio when the tab is hidden
- `attachAnalytics` logs screen views locally (never sent off-device)
- `attachTheme` reflects settings and orientation onto `<html>` for CSS

### Directory layout

```
src/
  core/          App bootstrap, store, states, boot sequence, config
  games/         Game registry (rules engines will live here)
  components/    UI primitives (frame, tabs, paginator, modal, cards, controls)
    screens/     One module per application state
  decks/         Collectible deck definitions
  boards/        Table/gameboard definitions
  story/         Characters and chapters
  progression/   XP, levels, unlock rules
  achievements/  Achievement definitions
  audio/         Web Audio engine
  storage/       LocalStorage, IndexedDB, persistence
  themes/        Design tokens and stylesheets
  analytics/     On-device event log
  utils/         DOM, math/RNG, device, timing helpers
public/
  assets/{cards,backgrounds,music,sfx,characters,icons}
  manifest.webmanifest, sw.js
```

### Card engine

`src/engine/` is shared by all five games. Card art never affects rules.

| Module         | What it does                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Card`         | Rank, suit, colour, facing; ids unique across multiple decks (`"1:QH"`); asset codes (`AS`, `10H`, `KD`)                     |
| `Deck`         | Standard 52-card decks, multi-deck sets, Spider (1/2/4 suits, 104 cards); Fisher–Yates `shuffle`, `draw`, round-robin `deal` |
| `Pile`         | Ordered stack (stock, waste, tableau, foundation, cell…): take, push, remove, reveal, turn over                              |
| `Hand`         | Player hand for War and Go Fish: ask for a rank, extract books, sort                                                         |
| `random`       | Seedable PRNG (reproducible deals, savable state) and `fisherYates`                                                          |
| `stacking`     | Build rules: descending alternating, same suit, foundations, complete runs, FreeCell supermove                               |
| `moves`        | `moveCards` with rule checks, source reveal and facing; `undoMove`                                                           |
| `Table`        | All piles of a game, move history/undo, `snapshot()` / `Table.restore()` with integrity checks                               |
| `saves`        | `SaveStore` save slots (IndexedDB, or in-memory)                                                                             |
| `CardRenderer` | Card elements from sprite-sheet frames, single images, or procedural fallbacks; upgrades in place when art loads             |
| `CardAnimator` | FLIP moves, flips, deals, reject shake; honours speed and reduced-motion settings                                            |

`src/games/setups.ts` deals the opening table for Klondike, Spider, FreeCell, War and Go Fish. War and Go Fish engines build on these (`src/games/war`, `src/games/goFish`).

### Decks and artwork

- **Registry**: `src/decks/definitions/<deck_id>.ts`, one module per deck, collected in `src/decks/registry.ts`. Each deck has an id, name, description, artist attribution, rarity, unlock requirement, content rating, face/back/preview assets, fallback colours and optional alternate artwork.
- **Artwork is uploaded separately.** Every deck starts as `status: 'pending'` and is drawn procedurally. Drop the files in `public/assets/cards/<deck_id>/` (each folder's README lists them), set `status: 'ready'`, add the artist credit, and run `npm run validate:decks`. See `public/assets/cards/README.md` for sprite-sheet, TexturePacker and individual-image layouts.
- **`AssetManager`** (`src/assets/`) loads WebP (or PNG) sheets and images, caches them and works out atlas frames.
- **`DeckThemeManager`** resolves a deck plus any alternate artwork into a theme, and applies content rules.
- **Mature content**: adult-themed decks live under `public/assets/cards/mature/` and are off by default (**Settings → Content**, with an 18+ confirmation). They are never requested while off and never shown in ordinary previews; menus and catalog tiles use a neutral cover.

### Visual identity

A neighborhood corner parlor drawn in flat, ink-outlined illustration: warm paper, terracotta, sage and mustard by day; dusk blue and lamplight by night (Settings → Display → Parlor lighting; **Auto** follows the player's local clock). Surfaces sit on a thick lower edge, like a well-worn game tile, and press down when tapped. Illustrations are inline SVG colored by CSS variables (`src/components/illustrations.ts`), so both palettes recolor every drawing.

### Reusable components

| Component         | Module                        | Notes                                                                      |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Buttons           | `components/ui.ts`            | `button`, `iconButton`; primary/secondary/ghost/danger/icon                |
| Navigation header | `components/ui.ts`            | `navHeader` / `screenFrame`: back, title, steps, credits, home, fullscreen |
| Tabs              | `components/Tabs.ts`          | Keyboard arrows, lazy panels                                               |
| Pagination        | `components/Paginator.ts`     | Fits tiles to the space; swipe, wheel, keys, dots                          |
| Modals            | `components/Dialog.ts`        | `openDialog` returns a promise; focus trap, Escape, backdrop               |
| Confirmations     | `components/Dialog.ts`        | `confirmDialog` → `Promise<boolean>`                                       |
| Notifications     | `components/Notifications.ts` | `notify(message, { kind })`; store-driven toasts                           |
| Live bindings     | `components/live.ts`          | Widgets that re-render from a store slice and clean up themselves          |

### Design principles

- **Remembered choices.** The last game, deck and board are saved, and each game remembers the deck and board it was last dealt with.
- **Fullscreen.** Header button, Settings toggle or the **F** key (hidden where the browser does not support it, e.g. iPhone Safari).
- **Mobile-first, no scrolling.** Every screen is a fixed-height frame (header / body / footer). Lists use a `paginator` that fits as many tiles as the space allows and pages the rest (buttons, dots, swipe, wheel, PageUp/PageDown). Grouped content uses tabs.
- **Portrait, landscape and desktop.** Layouts adapt by orientation and size; safe-area insets are respected; the real visible height is tracked for mobile browser chrome.
- **Touch and mouse.** 44 px minimum targets, pointer-based swipe, keyboard focus states, Escape for back.
- **Cozy and accessible.** Warm wood and brass palette, reduced-motion support (system setting or in-app toggle), ARIA roles on tabs, pagers, switches and dialogs.

### Adding content

- **Deck:** add an entry to `src/decks/registry.ts`; card art goes in `public/assets/cards/<deck-id>/`.
- **Board:** add an entry to `src/boards/registry.ts`; background art goes in `public/assets/backgrounds/`.
- **Screen:** create `src/components/screens/<Name>.ts`, register it in `screens/index.ts`, and add transitions in `core/states.ts`.

## License

© OFFICIAL INSPIRE. All rights reserved.
