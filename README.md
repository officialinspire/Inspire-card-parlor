# INSPIRE CARD PARLOR

A cozy collection of classic playing-card games featuring collectible illustrated decks, customizable gameboards, relaxing music, achievements and a story mode.

**Developer:** OFFICIAL INSPIRE · [www.inspireclothing.art](https://www.inspireclothing.art)

> **Status: v0.1.0 — application shell.** Navigation, state management, menus, collection, settings, audio and persistence are in place. Game rules are not implemented yet; the table screen is a placeholder.

## Games (planned)

| Game               | Players      | Status      |
| ------------------ | ------------ | ----------- |
| Klondike Solitaire | Solo         | Coming soon |
| Spider Solitaire   | Solo         | Coming soon |
| FreeCell           | Solo         | Coming soon |
| War                | 1 vs CPU     | Coming soon |
| Go Fish            | 1 vs 1–3 CPU | Coming soon |

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

| Script                 | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the dev server (LAN-accessible for phone testing) |
| `npm run build`        | Type-check, then build to `dist/`                       |
| `npm run preview`      | Serve the production build locally                      |
| `npm run typecheck`    | Run `tsc --noEmit`                                      |
| `npm run format`       | Format with Prettier                                    |
| `npm run format:check` | Check formatting                                        |

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. In the repository settings, set **Pages → Source** to **GitHub Actions**. The build uses a relative base path, so it works on both `https://<user>.github.io/<repo>/` and a custom domain.

## Architecture

### Application states

All navigation flows through a single centralized store (`src/core/store.ts`). The current screen is `state.screen`, one of:

```
BOOT → INITIALIZATION → MAIN_MENU
MAIN_MENU ⇄ GAME_SELECTION → DECK_SELECTION → BOARD_SELECTION → GAMEPLAY
MAIN_MENU ⇄ STORY_MODE → GAMEPLAY
MAIN_MENU ⇄ COLLECTION | ACHIEVEMENTS | SETTINGS | STATISTICS
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

### Design principles

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
