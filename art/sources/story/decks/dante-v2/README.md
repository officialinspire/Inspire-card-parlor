# Dante V2 deck artwork

New Dante’s World monster artwork inspired by the supplied red-haired turquoise character drawing. Includes distinct number-card compositions and jester, queen, and king court illustrations, plus a custom two-headed monster back.

- `faces.png`: 1807 × 768 pixels, 13 columns × 4 rows, 52 cells.
- Every cell and `back.png`: 139 × 192 pixels, matching the classic and Cannabis Strains exports.
- Rows: spades, hearts, diamonds, clubs. Columns: A, 2–10, J, Q, K.
- Illustrated cell boundaries were individually normalized into a uniform zero-margin, zero-spacing grid.
- Generated indices contain small illustration inconsistencies (including some inverted suit symbols). Per-card identity and mobile readability review is still required before runtime activation.
- Number-card monster motifs are decorative, not verified pip counts.
- Back is visually balanced; exact pixel rotational symmetry is not guaranteed.

Source artwork only; this does not register or activate a runtime deck. AI-generated using the built-in image generator from the user’s reference. Final prompts requested a complete 13-by-4 ivory-faced monster atlas in red, turquoise, yellow and pink, and a separate black-field two-headed monster card back.

## Runtime repair

The original normalized PNG contained damaged IDAT chunks. Recovered matching artwork from `Turquoise monster 52-card sprite atlas.png`, retained as `source-faces.webp`. `scripts/art/normalize-dante-v2.py` records the uneven source ink-rule boundaries, cuts all 52 cards individually, and exports 139×192 cells to the source/runtime PNGs. It also generates runtime WebP copies for Dante V2, Cannabis Nugs and YummyHole so these decks participate in offline visual downloads. Existing illustration/index inconsistencies remain an artwork limitation, separate from card logic and slicing.
