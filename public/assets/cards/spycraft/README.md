# Spycraft — artwork drop folder

Status: **pending**

Upload the commissioned artwork for this deck here, then set `assets.status` to `'ready'`
and fill in `artist` in `src/decks/definitions/spycraft.ts`.

## Card faces

One sprite sheet, `faces.webp` (PNG accepted as a fallback). Grid of 13 columns × 4 rows: columns A, 2 … 10, J, Q, K; rows ♠ ♥ ♦ ♣. Any cell size works; all cells must be equal.

## Required files

- face sprite sheet: `faces.webp` or `faces.png`
- card back: `back.webp` or `back.png`
- preview image: `preview.webp` or `preview.png`

Check with `npm run validate:decks`. See `public/assets/cards/README.md` for other layouts
(individual images, explicit frames, TexturePacker JSON) and alternate artwork.
