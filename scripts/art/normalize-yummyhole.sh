#!/usr/bin/env bash
# Normalize the generated art to the BlackJak Standard deck's exact cell size.
# Requires ImageMagick 6 (convert/identify). No runtime dependencies change.
set -euo pipefail
cd "$(dirname "$0")/../.."
asset_dir=art/sources/story/decks/yummyhole
task_tmp=$(mktemp -d)
trap 'rm -rf "$task_tmp"' EXIT

# Generated borders are not uniformly spaced: crop each whole card first.
xs=(0 174 331 484 637 790 941 1090 1237 1384 1530 1670 1800 1921)
ys=(0 203 407 606 819)
for row in {0..3}; do
  row_cards=()
  for col in {0..12}; do
    tile="$task_tmp/card-$row-$col.png"
    convert "$asset_dir/source-faces.png" \
      -crop "$((xs[col+1]-xs[col]))x$((ys[row+1]-ys[row]))+${xs[col]}+${ys[row]}" \
      +repage -resize '139x192!' "$tile"
    row_cards+=("$tile")
  done
  convert "${row_cards[@]}" +append "$task_tmp/row-$row.png"
done
convert "$task_tmp/row-0.png" "$task_tmp/row-1.png" \
  "$task_tmp/row-2.png" "$task_tmp/row-3.png" -append "$asset_dir/faces.png"

# The original sheet's first cell of row five contains the complete back.
convert "$asset_dir/source-original.png" -crop 191x164+0+610 +repage \
  -resize '139x192!' "$asset_dir/back.png"
test "$(identify -format '%wx%h' "$asset_dir/faces.png")" = 1807x768
test "$(identify -format '%wx%h' "$asset_dir/back.png")" = 139x192
echo 'YummyHole: 52 cells at 139x192; faces 1807x768; back 139x192.'
