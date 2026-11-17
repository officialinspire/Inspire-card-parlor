#!/usr/bin/env python3
"""Export the approved square app emblem at install/favicon sizes (Pillow only)."""
from pathlib import Path
from base64 import b64encode
from io import BytesIO
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/sources/inspire-card-parlor-app-icon.webp'
OUT = ROOT / 'public/assets/icons'


def main():
    image = Image.open(SOURCE).convert('RGB')
    assert image.width == image.height, 'App icon master must be square'
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in [(192, 'icon-192'), (512, 'icon-512'),
                       (512, 'icon-maskable-512'), (180, 'apple-touch-icon'), (32, 'favicon')]:
        icon = image.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(OUT / f'{name}-v2.png', optimize=True)
        # Older pages and external references keep receiving the same new emblem.
        if name != 'favicon':
            icon.save(OUT / f'{name}.png', optimize=True)
    # Self-contained SVG fallbacks use precisely the same art as the PNG exports.
    preview = BytesIO()
    image.resize((512, 512), Image.Resampling.LANCZOS).save(preview, format='WEBP', quality=90)
    data = b64encode(preview.getvalue()).decode()
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
           f'<image width="512" height="512" href="data:image/webp;base64,{data}"/>'
           '</svg>\n')
    for name in ['icon.svg', 'icon-maskable.svg']:
        (OUT / name).write_text(svg)


if __name__ == '__main__':
    main()
