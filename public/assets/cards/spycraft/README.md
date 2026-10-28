# Spycraft — extracted deck

Built by `scripts/art/extract_cards.py` from `art/sources/Vintage spycraft playing card sprite sheet.png` (1659×948). Do not edit these files by hand; replace the source sheet and run `npm run art:cards`.

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `faces.webp`   | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), 146×181 px cells       |
| `back.webp`    | card back                                                    |
| `extras.webp`  | jokers (not used by the five games)                          |
| `preview.webp` | catalog preview fan                                          |
| `atlas.json`   | source frame of every card, identity checks and review notes |

Source row order: hearts, diamonds, clubs, spades. Faces verified: 52/52.

## Artwork notes

- 10S: Eight pips instead of ten (indices are correct).
