# Card Parlor app emblem

The v2 icon uses a large ivory I inside a gold spade, two ivory cards and a dark emerald felt background. It replaces the small full-wordmark launcher image and the unrelated SVG fallback.

Approved master: `art/sources/inspire-card-parlor-app-icon.webp`. Regenerate with `python3 scripts/art/build_icons.py` (Pillow). The general artwork rebuild also calls this exporter, so it cannot restore the old icon.

Exports include 192/512px PWA icons, an opaque full-bleed 512px maskable icon, a 180px Apple touch icon and a 32px favicon. The primary emblem is within the central 80%-diameter safe circle; no rounded corners are baked into the artwork. SVG fallbacks embed the same emblem without external file dependencies. Legacy PNG paths are retained as aliases for older pages. Versioned PNG filenames and SVG URLs let install surfaces discover the new artwork. Existing home-screen icons may refresh on the browser/OS schedule; Apple may require removing and adding the home-screen shortcut again.
