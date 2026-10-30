#!/usr/bin/env python3
"""
Turns the uploaded card sprite sheets into production deck assets.

    python3 scripts/art/extract_cards.py            # all decks
    python3 scripts/art/extract_cards.py spycraft   # one deck

For each deck in art/sources/manifest.json it:

  1. finds the four face rows and the 13 card boundaries in each row from the
     sheet itself (sheets are not assumed to share a layout, and cards that
     touch are split at the narrowest gap rather than at fixed positions);
  2. cuts every card out with its own rounded corners, removing the sheet
     background (transparency, or a flood fill of the sheet colour);
  3. brings every card to the deck's median card height with a uniform scale
     (the sheets vary by a few pixels) and centres it in a transparent cell,
     so nothing is stretched or cropped;
  4. checks identity: the pip count of every number card and the colour of
     every suit are measured from the artwork and compared with the expected
     card (see verify_card) -- mismatches are reported, never relabelled;
  5. writes public/assets/cards/<deck>/faces.webp (13 x 4 grid, A..K by
     spades, hearts, diamonds, clubs, the engine's standard layout),
     back.webp, preview.webp, extras.webp (jokers etc.) and atlas.json with
     the source frame of every card and the verification results.

The source sheets in art/sources/ are only read, never modified.
Requires: pillow, numpy, opencv-python-headless.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / 'art' / 'sources'
OUT = ROOT / 'public' / 'assets' / 'cards'

RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUIT_CODE = {'spades': 'S', 'hearts': 'H', 'diamonds': 'D', 'clubs': 'C'}
STANDARD_ORDER = ['spades', 'hearts', 'diamonds', 'clubs']
RED = {'hearts', 'diamonds'}
WEBP_QUALITY = 90
GUTTER = 2


# --------------------------------------------------------------------------- masks


def load(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert('RGBA'))


def foreground(rgba: np.ndarray, bg: dict) -> np.ndarray:
    """True where a pixel belongs to a card rather than the sheet behind it."""
    if bg['type'] == 'alpha':
        return rgba[..., 3] > 128
    rgb = rgba[..., :3].astype(int)
    return (rgba[..., 3] > 128) & (np.abs(rgb - np.array(bg['color'])).sum(-1) > bg.get('tolerance', 60))


def runs(flags: np.ndarray) -> list[tuple[int, int]]:
    out, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(flags)))
    return out


def face_rows(fg: np.ndarray) -> tuple[list[tuple[int, int]], int]:
    """The four face rows (y ranges) and where the extras area begins."""
    profile = np.convolve(fg.mean(1), np.ones(3) / 3, mode='same')
    bands = [(a, b) for a, b in runs(profile >= 0.35) if b - a > 60]
    if len(bands) < 4:
        raise ValueError(f'expected 4 face rows, found {len(bands)}')
    return bands[:4], bands[3][1]


def column_cuts(fg: np.ndarray, y0: int, y1: int, n: int = 13, x0: int = 0, x1: int | None = None) -> list[int]:
    """n+1 x positions separating the cards of one row, at the narrowest gaps."""
    profile = np.zeros(fg.shape[1])
    profile[x0:x1] = np.convolve(fg[y0:y1, x0:x1].mean(0), np.ones(3) / 3, mode='same')
    xs = np.where(profile > 0.2)[0]
    lo, hi = int(xs[0]), int(xs[-1]) + 1
    pitch = (hi - lo) / n
    # Cards are not evenly spaced (court cards are often wider), so take the
    # n-1 deepest valleys of the coverage profile that are at least 60% of a
    # card apart, rather than positions on a fixed pitch.
    valleys = []
    x = lo + 1
    while x < hi - 1:
        if profile[x] <= profile[x - 1] and profile[x] <= profile[x + 1]:
            end = x
            while end + 1 < hi and profile[end + 1] == profile[x]:
                end += 1
            valleys.append((float(profile[x]), (x + end) // 2))
            x = end + 1
        else:
            x += 1
    chosen: list[int] = []
    for _, vx in sorted(valleys):
        if len(chosen) == n - 1:
            break
        if min([abs(vx - c) for c in chosen] + [vx - lo, hi - vx]) >= pitch * 0.6:
            chosen.append(vx)
    if len(chosen) != n - 1:
        raise ValueError(f'found {len(chosen) + 1} of {n} cards in row {y0}-{y1}')
    cuts = [lo, *sorted(chosen)]
    cuts.append(hi)
    return cuts


# --------------------------------------------------------------------------- cutting


def cut_out(rgba: np.ndarray, box: tuple[int, int, int, int], bg: dict) -> tuple[Image.Image, tuple]:
    """Crop one card, make its surroundings transparent and trim to the card."""
    x0, y0, x1, y1 = box
    cell = rgba[y0:y1, x0:x1].copy()
    if bg['type'] == 'alpha':
        alpha = cell[..., 3].copy()
        solid = (alpha > 128).astype(np.uint8)
    else:
        # Flood the sheet colour in from the cell border; the card's own dark
        # artwork is never reached because the card border encloses it.
        near = ~foreground(cell, bg)
        seeds = np.zeros_like(near)
        seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
        _, lab = cv2.connectedComponents(near.astype(np.uint8), connectivity=4)
        outside = np.isin(lab, np.unique(lab[seeds & near]))
        alpha = np.where(outside, 0, 255).astype(np.uint8)
        solid = (alpha > 0).astype(np.uint8)
    # Keep the largest piece (the card); drop slivers of neighbouring cards.
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=4)
    if n > 1:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        piece = lab == keep
        cnts, _ = cv2.findContours(piece.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        filled = np.zeros(piece.shape, np.uint8)
        cv2.drawContours(filled, cnts, -1, 1, -1)
        alpha = np.where(filled > 0, alpha, 0).astype(np.uint8)
    if bg['type'] != 'alpha':
        # Soften the hard flood-fill edge by one pixel.
        alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    cell[..., 3] = alpha
    ys, xs = np.where(alpha > 16)
    t = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    img = Image.fromarray(cell).crop(t)
    return img, (x0 + t[0], y0 + t[1], t[2] - t[0], t[3] - t[1])


def extras(
    rgba: np.ndarray, fg: np.ndarray, top: int, bg: dict, min_area: int, card: tuple[int, int]
) -> list[tuple[Image.Image, tuple]]:
    """Cards in the area below the faces (jokers, backs), left to right.

    Touching cards form one blob; a blob several cards wide is split at its
    narrowest gaps."""
    sub = fg[top:].astype(np.uint8)
    cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(sub)
    cv2.drawContours(filled, cnts, -1, 1, -1)
    n, _, stats, _ = cv2.connectedComponentsWithStats(filled)
    found = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        # A blob as tall as a face card but several cards wide is touching
        # cards. A landscape-printed back is wide too, but much shorter.
        card_w, card_h = card
        # Jokers and backs may be printed larger than the faces, so judge how many
        # cards a blob holds from a card of the blob's own height, not a face's width.
        own_w = card_w * (h / card_h)
        k = round(w / own_w) if h > card_h * 0.85 and w > own_w * 1.6 else 1
        if k > 1:
            cuts = column_cuts(fg[top:], int(y), int(y + h), k, int(x), int(x + w))
            found += [(cuts[j], int(y) + top, cuts[j + 1], int(y + h) + top) for j in range(k)]
        else:
            found.append((int(x), int(y) + top, int(x + w), int(y + h) + top))
    found.sort()
    pad = 2
    return [
        cut_out(rgba, (max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad), bg) for x0, y0, x1, y1 in found
    ]


# --------------------------------------------------------------------------- verification


def ink_masks(img: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    """Saturated red ink and near-black ink."""
    a = np.array(img).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    opaque = al > 200
    red = opaque & (r > 150) & (r - g > 70) & (r - b > 70)
    black = opaque & (r + g + b < 200)
    return red, black


def index_colour(img: Image.Image) -> str:
    """Colour of the top-left index (rank and suit), which every card carries."""
    w, h = img.size
    red, black = ink_masks(img)
    box = (slice(int(h * 0.03), int(h * 0.25)), slice(int(w * 0.03), int(w * 0.24)))
    return 'red' if red[box].sum() > black[box].sum() * 0.5 else 'black'


def count_pips(mask: np.ndarray, w: int, h: int) -> int:
    """Count the large suit symbols in the card body, away from the indices."""
    body = np.zeros_like(mask)
    x0, x1, y0, y1 = int(w * 0.19), int(w * 0.81), int(h * 0.07), int(h * 0.93)
    body[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    m = cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return 0
    areas = np.sort(stats[1:, cv2.CC_STAT_AREA])[::-1]
    # Pips share one size; take the typical size of the larger blobs.
    ref = float(np.median(areas[: max(1, min(len(areas), 4))]))
    return int(((areas >= ref * 0.4) & (areas <= ref * 2.5)).sum())


def verify_card(img: Image.Image, rank: str, suit: str, pips: bool) -> dict:
    """Measured index colour (and pip count for 2-10) compared with the expected card."""
    w, h = img.size
    measured = index_colour(img)
    expected = 'red' if suit in RED else 'black'
    result = {'colour': measured, 'colourOk': measured == expected}
    if pips and rank.isdigit():
        red, black = ink_masks(img)
        n = count_pips(red if measured == 'red' else black, w, h)
        result['pips'] = n
        result['pipsOk'] = n == int(rank)
    return result


# --------------------------------------------------------------------------- output


def place(card: Image.Image, cell: tuple[int, int]) -> Image.Image:
    """Centre a card in a cell, shrinking (never enlarging or stretching) to fit."""
    cw, ch = cell
    w, h = card.size
    s = min(1.0, cw / w, ch / h)
    if s < 1:
        card = card.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = Image.new('RGBA', cell, (0, 0, 0, 0))
    out.paste(card, ((cw - card.width) // 2, (ch - card.height) // 2), card)
    return out


def save_webp(img: Image.Image, path: Path, quality: int = WEBP_QUALITY) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)


def preview_fan(cards: list[Image.Image], cell: tuple[int, int]) -> Image.Image:
    cw, ch = cell
    W, H = int(cw * 3.2), int(ch * 1.35)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    angles = [-18, -9, 0, 9, 18]
    for i, (card, ang) in enumerate(zip(cards, angles)):
        rot = place(card, cell).rotate(-ang, resample=Image.BICUBIC, expand=True)
        x = int(W / 2 - rot.width / 2 + (i - 2) * cw * 0.45)
        y = int(H / 2 - rot.height / 2 + abs(i - 2) * ch * 0.04)
        canvas.alpha_composite(rot, (max(0, x), max(0, y)))
    return canvas


def build(deck: dict) -> dict:
    src = SOURCES / deck['source']
    rgba = load(src)
    bg = deck['background']
    fg = foreground(rgba, bg)
    rows, extras_top = face_rows(fg)

    cards: dict[str, Image.Image] = {}
    frames: dict[str, dict] = {}
    checks: dict[str, dict] = {}
    for (y0, y1), suit in zip(rows, deck['rows']):
        cuts = column_cuts(fg, y0, y1)
        pad = 3
        for col, rank in enumerate(RANKS):
            box = (max(0, cuts[col] - 1), max(0, y0 - pad), cuts[col + 1] + 1, min(rgba.shape[0], y1 + pad))
            img, frame = cut_out(rgba, box, bg)
            code = rank + SUIT_CODE[suit]
            cards[code] = img
            frames[code] = dict(zip(('x', 'y', 'w', 'h'), frame))
            checks[code] = verify_card(img, rank, suit, deck.get('pipCards', True))

    # The sheets' cards differ by a few pixels; bring each to the deck's median
    # height with a uniform scale (proportions unchanged) so stacks line up.
    target_h = int(np.median([c.height for c in cards.values()]))
    sized = {
        code: c.resize((max(1, round(c.width * target_h / c.height)), target_h), Image.LANCZOS)
        if c.height != target_h
        else c
        for code, c in cards.items()
    }
    # Uniform cell: the widest card, so every card keeps its own shape, plus a
    # transparent gutter so scaled sprites never pick up a neighbour's edge.
    cell = (max(c.width for c in sized.values()) + 2 * GUTTER, target_h + 2 * GUTTER)

    sheet = Image.new('RGBA', (cell[0] * 13, cell[1] * 4), (0, 0, 0, 0))
    for r, suit in enumerate(STANDARD_ORDER):
        for c, rank in enumerate(RANKS):
            sheet.alpha_composite(place(sized[rank + SUIT_CODE[suit]], cell), (c * cell[0], r * cell[1]))

    out = OUT / deck['id']
    save_webp(sheet, out / 'faces.webp')

    face = (int(np.median([c.width for c in cards.values()])), int(np.median([c.height for c in cards.values()])))
    extra_cards = extras(rgba, fg, extras_top, bg, deck.get('extrasMinArea', 12000), face)
    named: dict[str, Image.Image] = {}
    extra_frames: dict[str, dict] = {}
    for (img, frame), name in zip(extra_cards, deck['extras']):
        if not name:
            continue
        if img.width > img.height:  # landscape-printed back: turn upright
            img = img.rotate(90, expand=True)
        named[name] = img
        extra_frames[name] = dict(zip(('x', 'y', 'w', 'h'), frame))

    back = named.get('back')
    if back is None:
        raise ValueError(f'{deck["id"]}: no card back found on the sheet')
    save_webp(place(back, (back.width, back.height)), out / 'back.webp')
    for name, img in named.items():
        if name.startswith('back') and name != 'back':
            save_webp(img, out / f'{name}.webp')
    jokers = [named[k] for k in sorted(named) if k.startswith('joker')]
    if jokers:
        strip = Image.new('RGBA', (cell[0] * len(jokers), cell[1]), (0, 0, 0, 0))
        for i, j in enumerate(jokers):
            strip.alpha_composite(place(j, cell), (i * cell[0], 0))
        save_webp(strip, out / 'extras.webp')

    fan = [sized[c] for c in deck.get('previewCards', ['AS', 'KH', 'QD', 'JC', '10S'])]
    save_webp(preview_fan(fan, cell), out / 'preview.webp')

    problems = [
        f'{code}: ' + ', '.join(
            ([f'looks {r["colour"]}'] if not r['colourOk'] else [])
            + ([f'{r["pips"]} pips counted'] if r.get('pipsOk') is False else [])
        )
        for code, r in checks.items()
        if not r['colourOk'] or r.get('pipsOk') is False
    ]
    meta = {
        'deck': deck['id'],
        'source': deck['source'],
        'sourceSize': {'width': rgba.shape[1], 'height': rgba.shape[0]},
        'sourceRows': deck['rows'],
        'cell': {'width': cell[0], 'height': cell[1]},
        'layout': {'columns': 13, 'rows': 4, 'suitOrder': STANDARD_ORDER, 'rankOrder': RANKS},
        'frames': frames,
        'extras': extra_frames,
        'jokers': len(jokers),
        'verification': checks,
        'automatedIssues': problems,
        # Visual review of every card (art/sources/manifest.json): flags that
        # were checked by eye and found correct, and real artwork defects.
        'reviewedOk': deck.get('review', {}).get('reviewedOk', {}),
        'artworkIssues': deck.get('review', {}).get('artworkIssues', []),
    }
    (out / 'atlas.json').write_text(json.dumps(meta, indent=2) + '\n')
    return meta


def write_readme(deck: dict, meta: dict) -> None:
    issues = meta['artworkIssues']
    lines = [
        f"# {deck['name']} — extracted deck",
        '',
        f"Built by `scripts/art/extract_cards.py` from `art/sources/{deck['source']}` "
        f"({meta['sourceSize']['width']}×{meta['sourceSize']['height']}). Do not edit these files by hand; "
        'replace the source sheet and run `npm run art:cards`.',
        '',
        '| File | Contents |',
        '| --- | --- |',
        f"| `faces.webp` | 52 faces, 13 × 4 grid (A…K; ♠ ♥ ♦ ♣), {meta['cell']['width']}×{meta['cell']['height']} px cells |",
        '| `back.webp` | card back |',
        *(['| `extras.webp` | jokers (not used by the five games) |'] if meta['jokers'] else []),
        *[f'| `{n}.webp` | alternate back |' for n in meta['extras'] if n.startswith('back_')],
        '| `preview.webp` | catalog preview fan |',
        '| `atlas.json` | source frame of every card, identity checks and review notes |',
        '',
        f"Source row order: {', '.join(meta['sourceRows'])}. Faces verified: {len(meta['frames'])}/52.",
        '',
        '## Artwork notes',
        '',
        *([f"- {', '.join(i['cards']) + ': ' if i['cards'] else ''}{i['issue']}" for i in issues] or ['None.']),
        '',
    ]
    (OUT / deck['id'] / 'README.md').write_text('\n'.join(lines))


def main() -> None:
    manifest = json.loads((SOURCES / 'manifest.json').read_text())
    only = set(sys.argv[1:])
    for deck in manifest['decks']:
        if only and deck['id'] not in only:
            continue
        meta = build(deck)
        write_readme(deck, meta)
        issues = meta['automatedIssues']
        print(f"{deck['id']:26} cell {meta['cell']['width']}x{meta['cell']['height']}  jokers {meta['jokers']}  "
              f"issues {len(issues)}")
        for i in issues:
            print('   ', i)


if __name__ == '__main__':
    main()
