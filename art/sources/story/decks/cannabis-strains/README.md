# Cannabis Nugs artwork

Botanical nug illustrations with ivory faces, emerald and gold ornament, and a matching custom back. Runtime deck: `cannabis_nugs`.

The original preparation resized an unevenly spaced sheet to 1807×768. Treating that as 13 equal columns split many illustrations between adjacent cards. `source-faces.webp` preserves that uncropped sheet. `scripts/art/normalize-cannabis.py` cuts the complete illustrated cards at the recorded source borders, then exports 52 uniform 139×192 cells to the source and runtime PNGs and the runtime WebP. `layout.json` records the source coordinates. Rows are spades, hearts, diamonds and clubs; columns are A, 2–10, J, Q, K. Back artwork is unchanged.

The browser pixel regression rejects full-height divider lines inside exported cells (48 failures in the previous sheet, zero in the repair), in addition to verifying decoding and dimensions. Botanical appearances are artistic variations, not verified strain identifications. Illustration-level pip/index imperfections are separate from slicing.
