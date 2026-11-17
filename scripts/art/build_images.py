#!/usr/bin/env python3
"""
Builds web assets for the uploaded gameboards, menu backgrounds and logo.

    python3 scripts/art/build_images.py

Sources in art/sources/ are only read. Images are resized proportionally
(never stretched) and saved as WebP; app icons are PNG because install
surfaces (iOS home screen, Android launcher) expect PNG.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art' / 'sources'
PUBLIC = ROOT / 'public' / 'assets'

BOARDS = {
    'backroom_card_table': 'Inspire Emerald Felt Game Table.png',
    'picnic_table': 'Inspire Picnic Tabletop for Card Games.png',
    'rappahannock_riverside': 'Rappahannock River Woven Game Mat.png',
    # The Thirteenth Hand boards (sources in art/sources/story/boards/).
    'cheryls_antique_shop': 'story/boards/Cheryl’s Antique Shop Gameboard.png',
    'mrs_gray_safehouse': 'story/boards/Mrs. Gray’s Olive Safehouse Desk.png',
    'masonic_lodge_no4': 'story/boards/Antique Walnut Masonic Gameboard.png',
    'washington_final_table': 'story/boards/Candlelit Colonial Virginia Cellar Table.png',
    'kenmore_parlor': 'story/boards/Kenmore-inspired Georgian parlor table.png',
    'umw_classroom': 'story/boards/Maple UMW Classroom Card Table.png',
    'germanna_library': 'story/boards/Germanna Community College Library Desk.png',
}
# Adult-only boards: written under backgrounds/mature/, which the default
# (family) build removes (see vite.config.ts), like the adult decks.
MATURE_BOARDS = {
    'ismokeshop_counter': 'story/boards/Modern Smoke-Shop Glass Game Counter.png',
    'ismokeshop_counter_overhead': 'story/boards/Overhead smoke shop glass counter.png',
}
MENU = {
    'day': 'Sunlit Rappahannock Riverfront.png',
    'night': 'Fredericksburg Riverfront at Midnight.png',
}
LOGO = 'Inspire Card Parlor Transparent Logo.png'
ICON_SOURCE = 'inspire-card-parlor.png'


def fit(img: Image.Image, max_w: int, max_h: int | None = None) -> Image.Image:
    """Shrink proportionally to fit; never enlarge."""
    s = min(1.0, max_w / img.width, (max_h or img.height) / img.height)
    if s >= 1:
        return img
    return img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)


def webp(img: Image.Image, path: Path, quality: int = 84) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}  {img.width}x{img.height}  {path.stat().st_size // 1024} KB')


def trim(img: Image.Image) -> Image.Image:
    """Crop to the artwork and clear the near-invisible haze (alpha < 12) around
    it, which otherwise shows up as a faint box under drop shadows."""
    alpha = img.getchannel('A').point(lambda a: 0 if a < 12 else a)
    img = img.copy()
    img.putalpha(alpha)
    box = alpha.getbbox()
    return img.crop(box) if box else img


def main() -> None:
    boards = [(b, n, PUBLIC / 'backgrounds' / b) for b, n in BOARDS.items()]
    boards += [(b, n, PUBLIC / 'backgrounds' / 'mature' / b) for b, n in MATURE_BOARDS.items()]
    for board, name, out in boards:
        img = Image.open(SRC / name).convert('RGB')
        webp(fit(img, 1920), out / 'background.webp')
        webp(fit(img, 480), out / 'preview.webp', 80)

    for key, name in MENU.items():
        img = Image.open(SRC / name).convert('RGB')
        webp(fit(img, 1920), PUBLIC / 'backgrounds' / 'menu' / f'{key}.webp', 82)

    logo = trim(Image.open(SRC / LOGO).convert('RGBA'))
    webp(fit(logo, 960), PUBLIC / 'branding' / 'logo.webp', 88)

    mark = trim(Image.open(SRC / ICON_SOURCE).convert('RGBA'))

    # Link preview (Open Graph / social): the secondary logo over the midnight riverfront.
    night = Image.open(SRC / MENU['night']).convert('RGB')
    w, h = 1200, 630
    scale = max(w / night.width, h / night.height)
    bg = night.resize((round(night.width * scale), round(night.height * scale)), Image.LANCZOS)
    bg = bg.crop(((bg.width - w) // 2, (bg.height - h) // 2, (bg.width - w) // 2 + w, (bg.height - h) // 2 + h))
    card = Image.blend(bg, Image.new('RGB', (w, h), (10, 12, 20)), 0.35).convert('RGBA')
    promo = fit(mark, 820, 470)
    card.alpha_composite(promo, ((w - promo.width) // 2, (h - promo.height) // 2))
    (PUBLIC / 'branding').mkdir(parents=True, exist_ok=True)
    card.convert('RGB').save(PUBLIC / 'branding' / 'social-card.jpg', quality=86, optimize=True, progressive=True)
    print('public/assets/branding/social-card.jpg')
    # Keep generated branding rebuilds from restoring the old wordmark icons.
    from build_icons import main as build_icons
    build_icons()


if __name__ == '__main__':
    main()
