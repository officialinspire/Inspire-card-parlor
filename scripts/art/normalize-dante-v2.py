"""Rebuild the damaged V2 atlas from the recovered original illustration.
The original has uneven columns: cut at the ink rules, then normalize each card.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/sources/story/decks/dante-v2'

def main():
    original = Image.open(SOURCE / 'source-faces.webp').convert('RGB')
    xs = [0,168,329,488,645,803,961,1110,1254,1395,1533,1665,1795,1923]
    ys = [0,205,409,613,818]
    atlas = Image.new('RGB', (1807,768))
    for row in range(4):
        for col in range(13):
            card = original.crop((xs[col]+2,ys[row]+2,xs[col+1]-1,ys[row+1]-2))
            card = card.resize((139,192),Image.Resampling.LANCZOS)
            atlas.paste(card,(col*139,row*192))
    for directory in [SOURCE, ROOT / 'public/assets/cards/dante_v2']:
        atlas.quantize(colors=256).save(directory / 'faces.png',optimize=True)
    # Ship compressed copies of all three uploaded decks, also included in the offline pack.
    for name in ['dante_v2','cannabis_nugs','yummyhole_standard']:
        directory = ROOT / 'public/assets/cards' / name
        for file in ['faces','back','preview']:
            image = Image.open(directory / f'{file}.png').convert('RGB')
            image.save(directory / f'{file}.webp',quality=92,method=6)

if __name__ == '__main__':
    main()
