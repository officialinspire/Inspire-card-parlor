# George Washington's Ghost — extracted deck

Built by `scripts/art/extract_cards.py` from `art/sources/story/decks/Spectral Washington Colonial Playing Card Atlas.png` (1846×852). Do not edit these files by hand; replace the source sheet and run `npm run art:cards`.

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `faces.webp`   | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), 147×203 px cells       |
| `back.webp`    | card back                                                    |
| `preview.webp` | catalog preview fan                                          |
| `atlas.json`   | source frame of every card, identity checks and review notes |

Source row order: spades, hearts, diamonds, clubs. Faces verified: 52/52.

## Artwork notes

- 9S, 9C, 9H, 9D, 5H, 6C, KH: Bottom-right index misprinted (9s read "8" or "6", 5H malformed, 6C reads "5", KH reads "A"); corrected in the build with each card's own top-left index, rotated (see indexFixes).
