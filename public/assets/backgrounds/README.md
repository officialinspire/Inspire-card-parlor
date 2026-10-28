# Gameboard artwork

Each gameboard has a folder named after its id. Until a board's artwork is marked ready, the game
draws its CSS surface (colours and patterns only, no artwork).

Artwork is referenced, never altered: images are displayed with `cover` (aspect ratio preserved),
and a separate translucent scrim layer keeps cards and text readable on busy or bright art.

## Wiring artwork in without code changes

Add `public/assets/artwork.json`:

```json
{
  "version": 1,
  "boards": {
    "picnic_table": { "status": "ready", "artist": { "name": "Artist Name", "url": "https://…" } }
  },
  "decks": {
    "jak_gold": {
      "status": "ready",
      "artist": { "name": "Artist Name", "url": "https://…" },
      "faces": { "type": "atlas", "image": { "path": "faces" }, "grid": { "columns": 13, "rows": 4 } },
      "variants": [
        {
          "id": "gilded",
          "name": "Gilded",
          "description": "…",
          "artist": { "name": "Artist Name" },
          "rarity": "epic",
          "unlock": { "type": "credits", "value": 300 },
          "assets": { "status": "ready", "back": { "path": "gilded-back" } }
        }
      ]
    }
  }
}
```

Every entry is validated when the game starts; invalid entries are skipped and reported in the
browser console. A board or deck marked ready must carry an artist credit. Adult-only artwork must
live under `assets/cards/mature/` and is only shipped in editions built with
`VITE_ENABLE_MATURE_CONTENT=true`.
