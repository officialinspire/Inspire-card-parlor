# Freemasonry — extracted deck

Built by `scripts/art/extract_cards.py` from `art/sources/story/decks/Engraved Georgian 52-card deck atlas.png` (1846×852). Do not edit these files by hand; replace the source sheet and run `npm run art:cards`.

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `faces.webp`   | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), 147×204 px cells       |
| `back.webp`    | card back                                                    |
| `preview.webp` | catalog preview fan                                          |
| `atlas.json`   | source frame of every card, identity checks and review notes |

Source row order: spades, hearts, diamonds, clubs. Faces verified: 52/52.

## Artwork notes

- 5S, 5H, 5D, 5C: Four pips instead of five (indices are correct).
- 9S, 9H, 9D, 9C: Bottom-right index printed as "3"; corrected in the build with the card's own top-left index, rotated (see indexFixes).
- KS: Bottom-right index printed as "J"; corrected in the build with the card's own top-left index, rotated (see indexFixes).
- Sheet file name is "Engraved Georgian 52-card deck atlas"; its aces carry the square and compasses, so it is used as the Freemasonry deck faces with the navy-gold square-and-compasses back. Confirm this pairing.
