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
}
MENU = {
    'day': 'Sunlit Rappahannock Riverfront.png',
    'night': 'Fredericksburg Riverfront at Midnight.png',
}
LOGO = 'Inspire Card Parlor Transparent Logo.png'
ICON_SOURCE = 'inspire-card-parlor.png'
ICON_BG = (16, 48, 31, 255)  # the logo's own deep green


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


def icon(logo: Image.Image, size: int, safe: float) -> Image.Image:
    """Logo centred on a solid square; `safe` is the share of the side it may use."""
    canvas = Image.new('RGBA', (size, size), ICON_BG)
    mark = fit(logo, round(size * safe), round(size * safe))
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return canvas


def main() -> None:
    for board, name in BOARDS.items():
        img = Image.open(SRC / name).convert('RGB')
        webp(fit(img, 1920), PUBLIC / 'backgrounds' / board / 'background.webp')
        webp(fit(img, 480), PUBLIC / 'backgrounds' / board / 'preview.webp', 80)

    for key, name in MENU.items():
        img = Image.open(SRC / name).convert('RGB')
        webp(fit(img, 1920), PUBLIC / 'backgrounds' / 'menu' / f'{key}.webp', 82)

    logo = trim(Image.open(SRC / LOGO).convert('RGBA'))
    webp(fit(logo, 960), PUBLIC / 'branding' / 'logo.webp', 88)

    mark = trim(Image.open(SRC / ICON_SOURCE).convert('RGBA'))
    out = PUBLIC / 'icons'
    out.mkdir(parents=True, exist_ok=True)
    for size, safe, file in [
        (192, 0.9, 'icon-192.png'),
        (512, 0.9, 'icon-512.png'),
        (512, 0.72, 'icon-maskable-512.png'),  # maskable: keep inside the 80% safe zone
        (180, 0.86, 'apple-touch-icon.png'),
    ]:
        icon(mark, size, safe).convert('RGB').save(out / file, optimize=True)
        print(f'public/assets/icons/{file}')


if __name__ == '__main__':
    main()
