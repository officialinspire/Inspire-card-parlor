# Card artwork

Each deck has its own folder (`<deck_id>/`). Adult-themed decks live under `mature/<deck_id>/`
so they stay isolated: the game never requests anything in `mature/` unless the player has
switched on **Settings → Content → Mature decks**, and their artwork never appears in ordinary
previews (menus, catalog thumbnails). Commissioned artwork is uploaded separately. Until a deck's
`assets.status` is `'ready'`, the game draws a procedural card in the deck's fallback colours.

`_placeholder/` holds a plain, labelled template (not deck artwork). Turn on
**Settings → Content → Placeholder artwork** to see it on every pending deck and check the sprite-sheet
pipeline end to end.

## Supported layouts

Set these in the deck's definition, `src/decks/definitions/<deck_id>.ts`.

| Layout                      | `faces` setting                                                                        | Files                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Grid sprite sheet (default) | `{ type: 'atlas', image: { path: 'faces' }, grid: { columns: 13, rows: 4 } }`          | `faces.webp` / `faces.png`: columns A…K, rows ♠ ♥ ♦ ♣. Optional `margin`, `spacing`, `suitOrder`, `rankOrder`, `backCell`. |
| Packed sprite sheet         | `{ type: 'atlas', image: { path: 'faces' }, metaPath: 'faces.json' }`                  | TexturePacker "JSON (Hash)" with frames named `AS`, `10H`, `KD`, … and optionally `back`.                                  |
| Explicit frames             | `{ type: 'atlas', image, frames: { AS: { x, y, w, h }, … }, size: { width, height } }` | One sheet; frames in the definition.                                                                                       |
| Individual images           | `{ type: 'individual', pattern: 'faces/{code}' }`                                      | `faces/AS.webp` … `faces/KC.webp` (52 files).                                                                              |

Backs are `back.webp|png`, or `{ atlasFrame: 'back' }` to take the back from the sheet.
Every deck also needs `preview.webp|png` for the catalog.

WebP is preferred where the browser supports it; PNG is used otherwise, or when the WebP file is missing.

## Alternate artwork

Collectible variants go in a deck's `variants` list. A variant can replace the back, the whole face sheet,
or individual cards (`overrides: { QH: { path: 'alt/queen-of-hearts' } }`). Variants are cosmetic only:
ranks, suits and the 52-card composition never change.

## Checking a deck

```
npm run validate:decks
```

This reports every required file per deck. Missing files are warnings while artwork is pending and
errors once a deck is marked `ready`. Add `--strict` to treat pending decks as errors.

Regenerate the placeholder template and per-deck READMEs with `npm run assets:placeholders`.
