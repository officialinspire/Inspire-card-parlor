# Uploaded artwork inventory

Every file uploaded for INSPIRE CARD PARLOR. The originals live, unmodified, in `art/sources/` (they are not shipped);
the game uses derived WebP/PNG files built by `npm run art:cards` and `npm run art:images`.

| Source file                                      | Size (px) | Purpose                                                                                   | Integration                                                                                                                                                              |
| ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Dante's World Neon Monster Card Atlas.png`      | 1658×949  | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **Dante's World** (`dantes_world`), complete, 52/52 faces verified, 2 artwork notes → `public/assets/cards/dantes_world/`                                           |
| `Downtown Fredericksburg Collector Deck.png`     | 1536×1024 | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **Downtown Fredericksburg Collector** (`fredericksburg_downtown`), complete, 52/52 faces verified, 2 artwork notes → `public/assets/cards/fredericksburg_downtown/` |
| `Eastern Woodland Playing Card Sprite Sheet.png` | 1536×1024 | Card sprite sheet: 52 faces, 0 jokers, 2 back(s)                                          | Deck **Eastern Woodlands** (`eastern_woodlands`), complete, 52/52 faces verified, 4 artwork notes → `public/assets/cards/eastern_woodlands/`                             |
| `Fredericksburg Heritage Playing Card Sheet.png` | 1659×948  | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **Fredericksburg Heritage** (`fredericksburg`), complete, 52/52 faces verified, 1 artwork note → `public/assets/cards/fredericksburg/`                              |
| `Fredericksburg Riverfront at Midnight.png`      | 1672×941  | Menu background (night theme)                                                             | Main menu hero at night → `public/assets/backgrounds/menu/night.webp`                                                                                                    |
| `Inspire Card Parlor Transparent Logo.png`       | 1536×1024 | Branding: logo                                                                            | Title screen and main-menu header → `public/assets/branding/logo.webp`                                                                                                   |
| `Inspire Emerald Felt Game Table.png`            | 1448×1086 | Gameboard                                                                                 | Backroom Card Table → `public/assets/backgrounds/backroom_card_table/`                                                                                                   |
| `Inspire Picnic Tabletop for Card Games.png`     | 1448×1086 | Gameboard                                                                                 | Picnic Table → `public/assets/backgrounds/picnic_table/`                                                                                                                 |
| `Rappahannock River Woven Game Mat.png`          | 1448×1086 | Gameboard                                                                                 | Rappahannock Riverside → `public/assets/backgrounds/rappahannock_riverside/`                                                                                             |
| `Sunlit Rappahannock Riverfront.png`             | 1672×941  | Menu background (day theme)                                                               | Main menu hero by day → `public/assets/backgrounds/menu/day.webp`                                                                                                        |
| `Vintage spycraft playing card sprite sheet.png` | 1659×948  | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **Spycraft** (`spycraft`), complete, 52/52 faces verified, 1 artwork note → `public/assets/cards/spycraft/`                                                         |
| `blackjak-cards-inspire-theme.png`               | 1448×1086 | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **BlackJak INSPIRE** (`inspire`), complete, 52/52 faces verified, 5 artwork notes → `public/assets/cards/inspire/`                                                  |
| `blackjak-cards-jak-theme.png`                   | 1448×1086 | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **BlackJak Jak Gold** (`jak_gold`), complete, 52/52 faces verified, 1 artwork note → `public/assets/cards/jak_gold/`                                                |
| `blackjak-cards-standard.png`                    | 1448×1086 | Card sprite sheet: 52 faces, 2 jokers, 1 back(s)                                          | Deck **BlackJak Standard** (`classic`), complete, 52/52 faces verified, 0 artwork notes → `public/assets/cards/classic/`                                                 |
| `inspire-card-parlor.png`                        | 1536×1024 | Branding: logo (near-identical copy of the transparent logo; differs only in edge pixels) | App icons → `public/assets/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`                                                          |

Per-deck artwork notes (cards with wrong pip counts, malformed indices, etc.) are listed in each deck folder's
`README.md` and `atlas.json`, and summarised by `npm run validate:decks`.

## Card sheet layouts

| Deck                              | Sheet                                            | Source row order                | Background                 | Extras row           |
| --------------------------------- | ------------------------------------------------ | ------------------------------- | -------------------------- | -------------------- |
| BlackJak Standard                 | `blackjak-cards-standard.png`                    | hearts, diamonds, clubs, spades | transparent                | joker1, joker2, back |
| BlackJak INSPIRE                  | `blackjak-cards-inspire-theme.png`               | spades, hearts, clubs, diamonds | transparent                | joker1, joker2, back |
| BlackJak Jak Gold                 | `blackjak-cards-jak-theme.png`                   | hearts, diamonds, clubs, spades | transparent                | joker1, joker2, back |
| Dante's World                     | `Dante's World Neon Monster Card Atlas.png`      | hearts, diamonds, clubs, spades | solid colour rgb(10,10,4)  | joker1, joker2, back |
| Fredericksburg Heritage           | `Fredericksburg Heritage Playing Card Sheet.png` | hearts, diamonds, clubs, spades | transparent                | joker1, joker2, back |
| Downtown Fredericksburg Collector | `Downtown Fredericksburg Collector Deck.png`     | clubs, diamonds, hearts, spades | solid colour rgb(27,85,48) | joker1, joker2, back |
| Eastern Woodlands                 | `Eastern Woodland Playing Card Sprite Sheet.png` | spades, hearts, diamonds, clubs | solid colour rgb(8,8,8)    | back, back_turtle    |
| Spycraft                          | `Vintage spycraft playing card sprite sheet.png` | hearts, diamonds, clubs, spades | transparent                | joker1, joker2, back |

Card sizes differ slightly within each sheet (a few pixels), and court cards are often wider than pip cards,
so card boundaries are found from the gaps in each row rather than a fixed grid.
