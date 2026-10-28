# Eastern Woodlands — extracted deck

Built by `scripts/art/extract_cards.py` from `art/sources/Eastern Woodland Playing Card Sprite Sheet.png` (1536×1024). Do not edit these files by hand; replace the source sheet and run `npm run art:cards`.

| File               | Contents                                                     |
| ------------------ | ------------------------------------------------------------ |
| `faces.webp`       | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), 141×209 px cells       |
| `back.webp`        | card back                                                    |
| `back_turtle.webp` | alternate back                                               |
| `preview.webp`     | catalog preview fan                                          |
| `atlas.json`       | source frame of every card, identity checks and review notes |

Source row order: spades, hearts, diamonds, clubs. Faces verified: 52/52.

## Artwork notes

- QS: Bottom-right index reads "0" instead of Q.
- KS: Bottom-right index reads "X" instead of K.
- 3H: Bottom-right index 3 is malformed.
- Both card backs are drawn landscape and are turned upright for play. The sheet has no jokers.
