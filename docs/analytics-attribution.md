# INSPIRE promotional links and gameplay attribution

V2 links connect `game_cta_clicked` → `game_opened` → `game_started` using a fresh random `launch_id`. This correlates launches, not cross-device people, and does not identify or merge visitors. `game_id` is the stable app identifier; Card Parlor retains its individual mode in `game`.

Attribution expires after 30 minutes, survives reload in the current tab, and is isolated per game path. The handoff ID travels in the URL fragment and is removed after consumption. No email, save data, login token or persistent website visitor ID is put in the link. DNT, GPC, game preferences and Shopify analytics consent remain respected.

Website CTAs automatically retain incoming campaign tags, or default to source `inspireclothing.art`, medium `website`, campaign `inspire_arcade`, and content for the clicked placement/game. A modal click is recorded separately from its Continue navigation and from actual gameplay.

For promotions use lowercase UTM tags. Use `utm_source=newsletter&utm_medium=email` for email, `utm_source=instagram&utm_medium=social` for Instagram, and `utm_source=facebook&utm_medium=social` for Facebook. Change `utm_campaign` for each release; never put personal data in tags.

| Game                         | Newsletter link                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRIDLOCK                     | https://officialinspire.github.io/GRIDLOCK/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=gridlock                                         |
| SHELLS-FEATHERS              | https://officialinspire.github.io/SHELLS-FEATHERS/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=shells-feathers                           |
| EMOJI-ELEMENTS-BETA-VERSION- | https://officialinspire.github.io/EMOJI-ELEMENTS-BETA-VERSION-/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=emoji-elements-beta-version- |
| Inspire-card-parlor          | https://officialinspire.github.io/Inspire-card-parlor/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=inspire-card-parlor                   |
| sudoku-by-inspire-v1         | https://officialinspire.github.io/sudoku-by-inspire-v1/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=sudoku-by-inspire-v1                 |
| DEJA-VU-MEMORY-GAME          | https://officialinspire.github.io/DEJA-VU-MEMORY-GAME/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=deja-vu-memory-game                   |
| Bird-Mahjong                 | https://officialinspire.github.io/Bird-Mahjong/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=bird-mahjong                                 |
| BlackJak                     | https://officialinspire.github.io/BlackJak/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=blackjak                                         |
| I-SPY                        | https://officialinspire.github.io/I-SPY/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=i-spy                                               |
| SPIRITBALL                   | https://officialinspire.github.io/SPIRITBALL/?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=spiritball                                     |

Website-first newsletter link: https://www.inspireclothing.art/pages/play?utm_source=newsletter&utm_medium=email&utm_campaign=inspire_games_2026_11&utm_content=arcade_directory

The saved PostHog report is https://us.posthog.com/project/651810/insights/15Cp01ja . Historical events cannot be retroactively connected. Direct promotional links retain campaign attribution but have no website launch ID unless someone actually clicks through the website.

## Verification

`node scripts/verify-storefront-attribution.mjs` verifies consent gating, modal Continue, new IDs per click and campaign propagation without sending production events. The shared helper tests are in GRIDLOCK `tests/unit/attribution.test.mjs`. Existing analytics tests verify deduplication, sanitized fields and network failures. Emoji Elements emits a start only after a valid battle is prepared; GRIDLOCK emits it after match creation; Shells distinguishes `game_resumed` from a new match.

Shopify live theme: INSPIRE – Game Attribution – Nov 14 (188570206426), verified published on November 14, 2026.
