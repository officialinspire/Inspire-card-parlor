#!/usr/bin/env python3
"""
Story artwork pipeline: turns the uploaded story sheets into web sprites.

    npm run art:story            # python3 scripts/art/story_assets.py
    npm run art:story -- --check # verify only: report, write nothing

Reads art/story/sources.json (layouts and sprite names, set by inspecting each
sheet) and the original images in art/sources/story/. Originals are only ever
read; their sha256 is checked against the config so a changed source is
noticed. For every sheet it writes, under public/assets/story/<group>/:

  - grid sheets (characters, items, map icons, stamps, effects): one sprite per
    cell. Pieces are found from the alpha channel and assigned to the cell that
    holds their centre, so effects made of loose particles and paths made of
    separate dots stay whole, and a sprite never picks up a neighbour's pixels;
  - irregular sheets (the UI atlas): one sprite per piece, found by the
    transparent gaps between pieces, in reading order;
  - single images (map tiles, documents): trimmed to their artwork;
  - gameboards: a background and a gallery preview;
  - decks and card backs: audited only (decks are cut by extract_cards.py).

Each sprite also gets a small thumbnail. Everything is described in
public/assets/story/manifest.json (source image, size and checksum, frame
rectangles, transparency, runtime paths, warnings) and summarized in
docs/ART_ASSET_AUDIT.md.

Problems (empty cells, pieces crossing cells, art touching the sheet edge,
missing or changed sources, a count that doesn't match the names) become
warnings in the manifest and the audit: the pipeline never crashes on a bad
sheet, and never marks generated or placeholder art as finished.

Output is deterministic: same sources and config, same files.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'art' / 'story' / 'sources.json'
OUT = ROOT / 'public' / 'assets' / 'story'
RUNTIME = 'assets/story'
AUDIT = ROOT / 'docs' / 'ART_ASSET_AUDIT.md'
PIPELINE_VERSION = 1

ALPHA_SOLID = 24  # alpha at or above this counts as artwork when finding pieces
ALPHA_CUT = 160  # cuts between cells avoid pixels at least this opaque
ALPHA_HAZE = 8  # fainter pixels (shadow haze, glow fringes) are dropped from sprites
SPRITE_MAX = 640  # longest side of a sprite (sources are never enlarged)
THUMB_MAX = 128
SINGLE_MAX = 1600
SINGLE_THUMB = 320
BOARD_MAX = (1672, 1086)
BOARD_PREVIEW = (480, 360)
WEBP_QUALITY = 86
CELL_TOLERANCE = 0.06  # share of a cell a piece may spill into its neighbours
STEEP = 12  # px a cut may step up or down per column (to follow hats, hair and raised hands)
EDGE_MARGIN = 2  # px: artwork this close to the sheet edge may have been cut off


# --------------------------------------------------------------------------- helpers


def warn(store: list, code: str, message: str, level: str = 'warning') -> None:
    store.append({'level': level, 'code': code, 'message': message})


def fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Shrink proportionally to fit; never enlarge."""
    s = min(1.0, max_w / img.width, max_h / img.height)
    if s >= 1:
        return img
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def save_webp(img: Image.Image, path: Path, check: bool) -> None:
    if check:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=WEBP_QUALITY, method=6)


def clean(rgba: np.ndarray) -> np.ndarray:
    """Zero the colour under fully transparent pixels (sheets often keep stray
    colour there, which bleeds into edges when browsers scale the sprite)."""
    out = rgba.copy()
    out[out[..., 3] == 0, :3] = 0
    return out


def to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr, 'RGBA')


def runtime(path: Path) -> str:
    return f'{RUNTIME}/{path.relative_to(OUT).as_posix()}'


def sprite_entry(name: str, sheet_id: str, frame: tuple[int, int, int, int], img: Image.Image, dest: Path,
                 sizes: tuple[int, int], check: bool) -> dict:
    """Saves a sprite (longest side at most sizes[0]) and its thumbnail (sizes[1]); returns its manifest entry."""
    full_max, thumb_max = sizes
    full = fit(img, full_max, full_max)
    thumb = fit(img, thumb_max, thumb_max)
    path = dest / f'{name}.webp'
    tpath = dest / 'thumbs' / f'{name}.webp'
    save_webp(full, path, check)
    save_webp(thumb, tpath, check)
    x, y, w, h = frame
    return {
        'id': f'{sheet_id}/{name}',
        'name': name,
        'frame': {'x': x, 'y': y, 'w': w, 'h': h},
        'src': runtime(path),
        'width': full.width,
        'height': full.height,
        'thumb': runtime(tpath),
        'thumbWidth': thumb.width,
        'thumbHeight': thumb.height,
    }


# --------------------------------------------------------------------------- piece finding


def pieces(alpha: np.ndarray, merge: int) -> tuple[np.ndarray, list[dict]]:
    """Connected pieces of artwork. `merge` px of dilation joins anti-aliased
    fragments (and, for irregular sheets, the parts of one piece)."""
    mask = (alpha >= ALPHA_SOLID).astype(np.uint8)
    if merge > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * merge + 1, 2 * merge + 1))
        mask = cv2.dilate(mask, k)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, connectivity=8)
    found = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in stats[i])
        found.append({'label': i, 'x': x, 'y': y, 'w': w, 'h': h, 'area': area, 'cx': float(cents[i][0]), 'cy': float(cents[i][1])})
    return labels, found


def cut(rgba: np.ndarray, labels: np.ndarray, members: list[int], pad: int = 2) -> tuple[Image.Image, tuple[int, int, int, int], int]:
    """The pixels of the given pieces only (nothing from neighbours), cropped to
    their artwork plus a little padding. Returns image, frame and dropped haze."""
    keep = np.isin(labels, members)
    a = rgba[..., 3]
    own = keep & (a >= ALPHA_HAZE)
    ys, xs = np.nonzero(own)
    if not len(xs):
        return Image.new('RGBA', (1, 1)), (0, 0, 0, 0), 0
    H, W = a.shape
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(W, xs.max() + 1 + pad), min(H, ys.max() + 1 + pad)
    block = rgba[y0:y1, x0:x1].copy()
    block[~own[y0:y1, x0:x1]] = 0
    dropped = int(((a > 0) & (a < ALPHA_HAZE) & keep).sum())
    return to_image(clean(block)), (int(x0), int(y0), int(x1 - x0), int(y1 - y0)), dropped


def touches_edge(frame: tuple[int, int, int, int], W: int, H: int) -> bool:
    x, y, w, h = frame
    return x <= EDGE_MARGIN or y <= EDGE_MARGIN or x + w >= W - EDGE_MARGIN or y + h >= H - EDGE_MARGIN


# --------------------------------------------------------------------------- layouts


def seam(solid: np.ndarray, expected: float, window: float) -> np.ndarray:
    """A cut across the sheet (left to right) between two rows of cells: the path
    near `expected` that crosses the least artwork, moving at most STEEP pixels up
    or down per column so it can wind through the gaps between figures. Returns
    the cut's y for every x. (For columns, call it on the transposed mask.)"""
    H, W = solid.shape
    lo, hi = max(1, int(expected - window)), min(H - 1, int(expected + window))
    band = solid[lo:hi].astype(np.float64)
    # Ink costs a lot; straying from the even grid costs a little (keeps open cuts straight).
    cost = band * 1000.0 + np.abs(np.arange(lo, hi) - expected)[:, None] * 0.01
    acc = cost[:, 0].copy()
    back = np.zeros(band.shape, dtype=np.int8)
    shifts = range(-STEEP, STEEP + 1)
    n = len(acc)
    for x in range(1, W):
        stacked = np.full((len(shifts), n), np.inf)
        for j, d in enumerate(shifts):
            # Candidate: arrive at row y from row y + d in the previous column.
            if d >= 0:
                stacked[j, : n - d] = acc[d:]
            else:
                stacked[j, -d:] = acc[: n + d]
        choice = stacked.argmin(axis=0)
        acc = stacked[choice, np.arange(n)] + cost[:, x] + np.abs(choice - STEEP) * 0.05
        back[:, x] = choice - STEEP
    path = np.empty(W, dtype=np.int64)
    y = int(acc.argmin())
    for x in range(W - 1, -1, -1):
        path[x] = y + lo
        if x > 0:
            y += int(back[y, x])
    return path


def do_grid(sheet: dict, rgba: np.ndarray, warnings: list, check: bool) -> list[dict]:
    """Cells are separated by seams that wind through the transparent gaps between
    pieces (near the even grid). Each sprite is the artwork inside its own cell, so
    loose particles stay with their effect and nothing is taken from a neighbour;
    where pieces truly overlap, the seam crosses as little artwork as possible and
    the crossing is reported."""
    cols, rows = sheet['layout']['cols'], sheet['layout']['rows']
    names = sheet['names']
    H, W = rgba.shape[:2]
    cw, ch = W / cols, H / rows
    if len(names) != cols * rows:
        warn(warnings, 'names-count', f'{len(names)} names for a {cols}x{rows} grid; extra cells get generic names.')
    # Cuts are found on the opaque artwork, so they may pass through soft glows
    # (ghost auras, magic) rather than through a figure.
    solid = rgba[..., 3] >= ALPHA_CUT
    yy, xx = np.mgrid[0:H, 0:W]
    # Rows need not be even (full-body poses are taller than busts): find each gap
    # from the ink profile first, then wind a seam through it.
    profile = np.convolve(solid.sum(axis=1).astype(float), np.ones(9) / 9, mode='same')
    gaps = []
    for k in range(1, rows):
        lo, hi = int(k * ch - ch * 0.45), int(k * ch + ch * 0.45)
        lo = max(lo, gaps[-1] + int(ch * 0.4) if gaps else 1)
        gaps.append(lo + int(profile[lo:hi].argmin()))
    row_cuts = [np.zeros(W, dtype=np.int64)] + [seam(solid, g, ch * 0.15) for g in gaps] + [np.full(W, H)]
    # Label every pixel with its cell.
    cell = np.zeros((H, W), dtype=np.int32)
    for r in range(rows):
        in_row = (yy >= row_cuts[r][None, :]) & (yy < row_cuts[r + 1][None, :])
        band = solid & in_row
        cprof = np.convolve(band.sum(axis=0).astype(float), np.ones(9) / 9, mode='same')
        cgaps = []
        for k in range(1, cols):
            lo, hi = int(k * cw - cw * 0.35), int(k * cw + cw * 0.35)
            lo = max(lo, cgaps[-1] + int(cw * 0.4) if cgaps else 1)
            cgaps.append(lo + int(cprof[lo:hi].argmin()))
        col_cuts = [np.zeros(H, dtype=np.int64)] + [seam(band.T, g, cw * 0.15) for g in cgaps] + [np.full(H, W)]
        for c in range(cols):
            cell[in_row & (xx >= col_cuts[c][:, None]) & (xx < col_cuts[c + 1][:, None])] = r * cols + c
    # Artwork cut in two: neighbouring solid pixels that landed in different cells.
    cuts: dict[tuple[int, int], int] = {}
    for a_, b_, sa, sb in ((cell[:, :-1], cell[:, 1:], solid[:, :-1], solid[:, 1:]), (cell[:-1], cell[1:], solid[:-1], solid[1:])):
        hit = (a_ != b_) & sa & sb
        for i, j in zip(a_[hit].tolist(), b_[hit].tolist()):
            cuts[(i, j)] = cuts.get((i, j), 0) + 1
    def side(i: int, j: int) -> str:
        (ri, ci), (rj, cj) = divmod(i, cols), divmod(j, cols)
        return 'top' if rj < ri else 'bottom' if rj > ri else 'left' if cj < ci else 'right'
    dest = OUT / sheet['group'] / sheet['id']
    sprites = []
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            name = names[i] if i < len(names) else f'cell-{r + 1}-{c + 1}'
            own = (cell == i) & (rgba[..., 3] >= ALPHA_HAZE)
            ys_, xs_ = np.nonzero(own)
            if not len(xs_):
                warn(warnings, 'empty-cell', f'Cell row {r + 1}, column {c + 1} ({name}) has no artwork.')
                continue
            x0, y0, x1, y1 = int(xs_.min()), int(ys_.min()), int(xs_.max()) + 1, int(ys_.max()) + 1
            block = rgba[y0:y1, x0:x1].copy()
            block[~own[y0:y1, x0:x1]] = 0
            img = to_image(clean(block))
            frame = (x0, y0, x1 - x0, y1 - y0)
            entry = sprite_entry(name, sheet['id'], frame, img, dest, (SPRITE_MAX, THUMB_MAX), check)
            if touches_edge(frame, W, H):
                warn(warnings, 'edge', f'{name}: artwork touches the sheet edge and may be cut off in the source.')
                entry['touchesEdge'] = True
            clipped: dict[str, int] = {}
            for (p_, q_), n in cuts.items():
                if i in (p_, q_):
                    other = q_ if p_ == i else p_
                    clipped[side(i, other)] = clipped.get(side(i, other), 0) + n
            clipped = {k: v for k, v in clipped.items() if v >= 8}
            if clipped:
                entry['clipped'] = clipped
                warn(warnings, 'clipped', f'{name}: touches its neighbour; the artwork is cut at the ' + ', '.join(f'{k} ({v} px)' for k, v in sorted(clipped.items())) + '.')
            sprites.append(entry)
    return sprites


def reading_order(blobs: list[dict]) -> list[dict]:
    """Rows top to bottom (pieces whose centres sit within half a typical height), then left to right."""
    if not blobs:
        return []
    typical = float(np.median([b['h'] for b in blobs]))
    rows: list[list[dict]] = []
    for b in sorted(blobs, key=lambda b: b['cy']):
        if rows and abs(b['cy'] - np.mean([x['cy'] for x in rows[-1]])) < typical * 0.5:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row, key=lambda b: b['cx'])]


def do_blobs(sheet: dict, rgba: np.ndarray, warnings: list, check: bool) -> list[dict]:
    lay = sheet['layout']
    names = sheet['names']
    H, W = rgba.shape[:2]
    labels, found = pieces(rgba[..., 3], merge=lay.get('merge', 8))
    big = [p for p in found if p['area'] >= lay.get('minArea', 600)]
    small = [p for p in found if p['area'] < lay.get('minArea', 600)]
    groups = {p['label']: [p['label']] for p in big}
    # Small fragments join the nearest piece (by distance to its box).
    for s in small:
        if not big:
            break
        def dist(b: dict) -> float:
            dx = max(b['x'] - s['cx'], 0, s['cx'] - (b['x'] + b['w']))
            dy = max(b['y'] - s['cy'], 0, s['cy'] - (b['y'] + b['h']))
            return dx * dx + dy * dy
        groups[min(big, key=dist)['label']].append(s['label'])
    ordered = reading_order(big)
    if len(ordered) != len(names):
        warn(warnings, 'count-mismatch', f'Found {len(ordered)} pieces but {len(names)} names; check the sheet and the config.')
    dest = OUT / sheet['group'] / sheet['id']
    sprites = []
    for i, p in enumerate(ordered):
        name = names[i] if i < len(names) else f'piece-{i + 1}'
        img, frame, dropped = cut(rgba, labels, groups[p['label']])
        entry = sprite_entry(name, sheet['id'], frame, img, dest, (SPRITE_MAX, THUMB_MAX), check)
        if touches_edge(frame, W, H):
            warn(warnings, 'edge', f'{name}: artwork touches the sheet edge and may be cut off in the source.')
            entry['touchesEdge'] = True
        if dropped:
            entry['droppedHazePixels'] = dropped
        sprites.append(entry)
    return sprites


def do_single(sheet: dict, rgba: np.ndarray, has_alpha: bool, warnings: list, check: bool) -> list[dict]:
    H, W = rgba.shape[:2]
    if has_alpha:
        a = rgba[..., 3]
        ys, xs = np.nonzero(a >= ALPHA_HAZE)
        if not len(xs):
            warn(warnings, 'blank', 'The image is fully transparent.', 'error')
            return []
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        block = rgba[y0:y1, x0:x1].copy()
        block[block[..., 3] < ALPHA_HAZE] = 0
        img, frame = to_image(clean(block)), (x0, y0, x1 - x0, y1 - y0)
        semi = float(((a > 0) & (a < 240)).sum()) / max(1, int((a > 0).sum()))
        if semi > 0.15:
            warn(warnings, 'soft-alpha', f'{semi:.0%} of the visible pixels are semi-transparent (soft edges or a translucent backdrop); check it over dark and light screens.', 'info')
    else:
        img, frame = to_image(rgba), (0, 0, W, H)
        warn(warnings, 'opaque', 'No transparency: shown as a rectangle.', 'info')
    dest = OUT / sheet['group']
    entry = sprite_entry(sheet['id'], sheet['id'], frame, img, dest, (SINGLE_MAX, SINGLE_THUMB), check)
    if has_alpha and touches_edge(frame, W, H):
        warn(warnings, 'edge', 'Artwork touches the image edge and may be cut off in the source.')
        entry['touchesEdge'] = True
    return [entry]


def do_board(sheet: dict, img: Image.Image, warnings: list, check: bool) -> dict:
    rgb = img.convert('RGB')
    if img.mode == 'RGBA' and np.array(img)[..., 3].min() < 250:
        warn(warnings, 'board-alpha', 'A gameboard should be fully opaque; transparent areas will show the page behind.')
    dest = OUT / 'boards' / sheet['id']
    bg = fit(rgb, *BOARD_MAX)
    prev = fit(rgb, *BOARD_PREVIEW)
    save_webp(bg, dest / 'background.webp', check)
    save_webp(prev, dest / 'preview.webp', check)
    ratio = img.width / img.height
    if abs(ratio - 4 / 3) > 0.02 and abs(ratio - 16 / 9) > 0.03:
        warn(warnings, 'board-ratio', f'Unusual aspect ratio {ratio:.2f} (boards are 4:3 or 16:9).', 'info')
    return {
        'background': runtime(dest / 'background.webp'),
        'backgroundWidth': bg.width,
        'backgroundHeight': bg.height,
        'preview': runtime(dest / 'preview.webp'),
        'previewWidth': prev.width,
        'previewHeight': prev.height,
        'registered': False,
    }


def do_audit(sheet: dict, rgba: np.ndarray, has_alpha: bool, warnings: list) -> dict:
    """Decks and card backs: measure, don't build."""
    H, W = rgba.shape[:2]
    kind = sheet['layout']['kind']
    info: dict = {'kind': kind}
    if kind == 'card-back':
        info['ratio'] = round(W / H, 3)
        if not 0.62 <= W / H <= 0.75:
            warn(warnings, 'back-shape', f'Card back ratio {W / H:.2f}; playing cards are about 0.71.')
        if not has_alpha:
            warn(warnings, 'back-margin', 'Opaque image: the area around the card (if any) must be trimmed before use.', 'info')
        return info
    _, found = pieces(rgba[..., 3], merge=1)
    cards = [p for p in found if p['area'] > (W * H) / 400]
    sizes = sorted((p['w'], p['h']) for p in cards)
    med = sizes[len(sizes) // 2] if sizes else (0, 0)
    face_like = [p for p in cards if abs(p['w'] - med[0]) < med[0] * 0.15 and abs(p['h'] - med[1]) < med[1] * 0.15]
    info.update({'cardsFound': len(cards), 'faceSized': len(face_like), 'typicalCard': {'w': med[0], 'h': med[1]}})
    if len(face_like) < 52:
        warn(warnings, 'deck-count', f'Only {len(face_like)} face-sized cards found; a deck needs 52.')
    if len(cards) == len(face_like):
        warn(warnings, 'deck-back', 'No card back on this sheet; a separate back image is needed.', 'info')
    return info


# --------------------------------------------------------------------------- run


def process(sheet: dict, check: bool) -> dict:
    warnings: list = []
    src = ROOT / sheet['source']
    entry: dict = {
        'id': sheet['id'],
        'title': sheet['title'],
        'group': sheet['group'],
        'layout': sheet['layout'],
        'source': {'path': sheet['source'], 'sha256': sheet.get('sha256')},
        'verified': False,
        'notes': sheet.get('notes'),
    }
    if not src.exists():
        warn(warnings, 'missing-source', f'Source image not found: {sheet["source"]}', 'error')
        entry.update(status='missing', warnings=warnings, sprites=[])
        return entry
    raw = src.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if sheet.get('sha256') and digest != sheet['sha256']:
        warn(warnings, 'source-changed', 'The source image differs from the one this config was written for; re-inspect its layout.')
    try:
        img = Image.open(src)
        img.load()
    except Exception as e:  # a corrupt upload must not stop the other sheets
        warn(warnings, 'unreadable', f'Could not read the image: {e}', 'error')
        entry.update(status='error', warnings=warnings, sprites=[])
        return entry
    has_alpha = img.mode in ('RGBA', 'LA') or 'transparency' in img.info
    rgba = np.array(img.convert('RGBA'))
    a = rgba[..., 3]
    transparent = float((a == 0).mean()) if has_alpha else 0.0
    entry['source'].update(width=img.width, height=img.height, mode=img.mode, hasAlpha=has_alpha,
                           transparentShare=round(transparent, 3), sha256=digest)
    expects_alpha = sheet['layout']['type'] in ('grid', 'blobs')
    if expects_alpha and transparent < 0.05:
        warn(warnings, 'no-alpha', 'A sprite sheet without a transparent background; pieces cannot be separated.', 'error')
        entry.update(status='error', warnings=warnings, sprites=[])
        return entry
    kind = sheet['layout']['type']
    sprites: list = []
    if kind == 'grid':
        sprites = do_grid(sheet, rgba, warnings, check)
    elif kind == 'blobs':
        sprites = do_blobs(sheet, rgba, warnings, check)
    elif kind == 'single':
        sprites = do_single(sheet, rgba, has_alpha, warnings, check)
    elif kind == 'board':
        entry['board'] = do_board(sheet, img, warnings, check)
    elif kind == 'audit':
        entry['audit'] = do_audit(sheet, rgba, has_alpha, warnings)
    entry['sprites'] = sprites
    entry['status'] = 'audit-only' if kind == 'audit' else 'processed'
    entry['warnings'] = warnings
    return entry


def main() -> None:
    check = '--check' in sys.argv
    cfg = json.loads(CONFIG.read_text())
    sheets = [process(s, check) for s in cfg['sheets']]
    manifest = {
        'about': 'Story artwork built by scripts/art/story_assets.py from art/story/sources.json. Do not edit by hand.',
        'pipelineVersion': PIPELINE_VERSION,
        'poseRows': cfg['poseRows'],
        'sheets': sheets,
    }
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + '\n'
    if not check:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'manifest.json').write_text(text)
        write_audit(cfg, sheets)
    counts: dict[str, int] = {}
    for s in sheets:
        counts[s['status']] = counts.get(s['status'], 0) + 1
    n_sprites = sum(len(s['sprites']) for s in sheets)
    n_warn = sum(1 for s in sheets for w in s['warnings'] if w['level'] != 'info')
    print(f'{len(sheets)} sheets ({", ".join(f"{v} {k}" for k, v in sorted(counts.items()))}), {n_sprites} sprites, {n_warn} warnings'
          + (' [check only]' if check else ''))
    for s in sheets:
        for w in s['warnings']:
            if w['level'] != 'info':
                print(f'  {w["level"]:7} {s["id"]}: {w["code"]}: {w["message"]}')
    if any(w['level'] == 'error' for s in sheets for w in s['warnings']):
        print('Some sheets could not be processed (see above); the others were.')


# --------------------------------------------------------------------------- audit document


def write_audit(cfg: dict, sheets: list[dict]) -> None:
    by_group: dict[str, list[dict]] = {}
    for s in sheets:
        by_group.setdefault(s['group'], []).append(s)
    L: list[str] = []
    add = L.append
    add('# Art asset audit')
    add('')
    add('Generated by `npm run art:story` (`scripts/art/story_assets.py`) from `art/story/sources.json`; '
        'the hand-written findings come from `art/story/review.json`. Do not edit this file by hand: change those and re-run.')
    add('')
    total = sum(len(s['sprites']) for s in sheets)
    add(f'- **{len(sheets)} source images** inventoried, all present; originals are kept unmodified in `art/sources/story/` (checked by SHA-256).')
    add(f'- **{total} runtime sprites** generated under `public/assets/story/`, each with a thumbnail, plus {sum(1 for s in sheets if s.get("board"))} gameboard images and previews.')
    add('- Manifest: `public/assets/story/manifest.json` (source, size, checksum, frame rectangles, transparency, runtime paths, warnings).')
    add('- **Nothing here is marked verified**: every sheet is `verified: false` until the artist confirms names and use.')
    add('')
    add('## Found and processed assets')
    add('')
    titles = {'characters': 'Characters (18 poses each)', 'items': 'Quest items', 'map': 'Map icons, river map and location tiles',
              'stamps': 'Passport stamps', 'effects': 'Visual effects', 'ui': 'Story UI', 'illustrations': 'Documents and illustrations',
              'boards': 'Gameboards (processed, not registered)', 'decks': 'Decks and card backs (audited only)'}
    for g in ['characters', 'items', 'map', 'stamps', 'effects', 'ui', 'illustrations', 'boards', 'decks']:
        group = by_group.get(g, [])
        if not group:
            continue
        add(f'### {titles[g]}')
        add('')
        add('| Source | Size | Layout | Output | Runtime path |')
        add('| --- | --- | --- | --- | --- |')
        for s in group:
            src = s['source']
            size = f"{src.get('width', '?')}×{src.get('height', '?')}{' RGBA' if src.get('hasAlpha') else ' opaque'}"
            lay = s['layout']
            layout = {'grid': f"{lay.get('cols')}×{lay.get('rows')} grid", 'blobs': 'irregular pieces', 'single': 'single image',
                      'board': 'gameboard', 'audit': lay.get('kind', 'audit')}[lay['type']]
            if s.get('board'):
                out, path = 'background + preview', s['board']['background'].rsplit('/', 1)[0] + '/'
            elif s['status'] == 'audit-only':
                out, path = 'audit only', '—'
            elif s['layout']['type'] == 'single':
                out, path = '1 image', s['sprites'][0]['src'] if s['sprites'] else '—'
            else:
                out, path = f"{len(s['sprites'])} sprites", f"{RUNTIME}/{s['group']}/{s['id']}/"
            add(f"| `{Path(src['path']).name}` | {size} | {layout} | {out} | `{path}` |")
        add('')
    if by_group.get('characters'):
        add('Character pose slots (same position on every sheet; names are slot conventions, not per-character descriptions):')
        add('')
        for row in cfg['poseRows']:
            add(f"- **{row['row']}**: " + ', '.join(f'`{row["row"]}-{p}`' for p in row['poses']))
        add('')
    review = json.loads((ROOT / 'art' / 'story' / 'review.json').read_text()) if (ROOT / 'art' / 'story' / 'review.json').exists() else {}
    add('## Missing assets')
    add('')
    missing = [s for s in sheets if s['status'] == 'missing']
    for s in missing:
        add(f"- `{s['source']['path']}` — listed in the config but not found.")
    if not missing:
        add('- None of the requested source images is missing.')
    for item in review.get('missing', []):
        add(f'- {item}')
    add('')
    add('## Cropping and alpha issues')
    add('')
    issues = [(s, w) for s in sheets for w in s['warnings']]
    if issues:
        add('| Sheet | Level | Issue |')
        add('| --- | --- | --- |')
        for s, w in issues:
            add(f"| `{s['id']}` | {w['level']} | {w['code']}: {w['message']} |")
    else:
        add('- No cropping or alpha problems were detected.')
    add('')
    for item in review.get('alpha', []):
        add(f'- {item}')
    add('')
    add('## Unverified artwork')
    add('')
    for item in review.get('unverified', []):
        add(f'- {item}')
    add('')
    add('## Runtime paths')
    add('')
    add('Paths are relative to the site root (they work under the GitHub Pages project path). Load them through `src/story/art.ts`.')
    add('')
    add('| Group | Sprite | Thumbnail |')
    add('| --- | --- | --- |')
    for g in ['characters', 'items', 'map', 'stamps', 'effects', 'ui']:
        for s in by_group.get(g, []):
            if s['layout']['type'] in ('grid', 'blobs'):
                add(f"| {g} | `{RUNTIME}/{g}/{s['id']}/<name>.webp` | `{RUNTIME}/{g}/{s['id']}/thumbs/<name>.webp` |")
    add(f'| map, illustrations | `{RUNTIME}/<group>/<id>.webp` | `{RUNTIME}/<group>/thumbs/<id>.webp` |')
    add(f'| boards | `{RUNTIME}/boards/<id>/background.webp` | `{RUNTIME}/boards/<id>/preview.webp` |')
    add('')
    add('## Recommended follow-up fixes')
    add('')
    for i, item in enumerate(review.get('followUp', []), 1):
        add(f'{i}. {item}')
    add('')
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT.write_text('\n'.join(L))


if __name__ == '__main__':
    main()
