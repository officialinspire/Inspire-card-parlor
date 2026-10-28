# BlackJak INSPIRE — extracted deck

Built by `scripts/art/extract_cards.py` from `art/sources/blackjak-cards-inspire-theme.png` (1448×1086). Do not edit these files by hand; replace the source sheet and run `npm run art:cards`.

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `faces.webp`   | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), 121×177 px cells       |
| `back.webp`    | card back                                                    |
| `extras.webp`  | jokers (not used by the five games)                          |
| `preview.webp` | catalog preview fan                                          |
| `atlas.json`   | source frame of every card, identity checks and review notes |

Source row order: spades, hearts, clubs, diamonds. Faces verified: 52/52.

## Artwork notes

- AH, 2H, 3H, 4H, 5H, 6H, 7H, 8H, 9H, 10H, JH, QH, KH, AD, 2D, 3D, 4D, 5D, 6D, 7D, 8D, 9D, 10D, JD, QD, KD: Hearts and diamonds are printed in black, so red and black suits can only be told apart by shape. Solitaire colour rules still work, but red versions are recommended.
- 7S, 7H, 7C: Six pips instead of seven, and the bottom index reads "Z" instead of an inverted 7.
- AS: Bottom-right index letter is malformed.
- JH, QH, KH: Bottom-right suit symbol is a spade instead of a heart (top-left index is correct).
- 7D: Bottom index 7 is not inverted like the other cards.
