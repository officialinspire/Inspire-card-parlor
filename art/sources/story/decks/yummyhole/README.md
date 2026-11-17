# YummyHole Moonlit deck — dimension-corrected artwork

- `faces.png`: **1807 × 768 px**, exactly **13 columns × 4 rows**.
- Each face cell: **139 × 192 px**, matching the shipped BlackJak Standard
  (`public/assets/cards/classic/atlas.json`, `cell`). The existing decks have
  varying export sizes; BlackJak Standard is the explicit size reference here.
- Rows: **spades, hearts, diamonds, clubs** (the engine's default order).
- Columns: **A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K**.
- `back.png`: **139 × 192 px**, separate from the 52 faces.
- No grid spacing, sheet margin, extra row or joker cells.

The generated sources are retained as `source-faces.png` and
`source-original.png`. Rebuild the dimension-corrected images with:

```sh
bash scripts/art/normalize-yummyhole.sh
```

Each illustrated card is cut at its actual border and resized independently;
resizing the entire generated image would put borders inside adjacent frames.
The initial generation had near-square cards; the corrected generation restores
portrait composition, and the build fixes the final pixel dimensions exactly.

## Artwork status

This is an asset preparation update, not an activation of the pending deck in
the game. The generated art still needs a card-identity cleanup before runtime
integration: diamond A/J/Q/K corner symbols include hearts, lower spade pips
sometimes resemble hearts, and some higher number cards have incorrect pip
counts. Do not treat the layout metadata as verification of those illustrations.
The pending deck definitions and current playable decks are unchanged.

Art direction: YummyHole reference illustrations supplied by the studio;
AI-generated adaptation for INSPIRE CARD PARLOR. No nudity.
