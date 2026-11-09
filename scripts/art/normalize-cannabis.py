"""Cut each Cannabis Nugs card at its illustrated border before normalizing.
The supplied sheet was resized as a whole and has unequal column widths.
"""
from pathlib import Path
import json
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/sources/story/decks/cannabis-strains'
RUNTIME = ROOT / 'public/assets/cards/cannabis_nugs'
XS = [1,168,324,476,626,772,907,1037,1165,1285,1402,1540,1675,1806]
YS = [1,192,383,575,767]

def main():
    original = Image.open(SOURCE / 'source-faces.webp').convert('RGB')
    assert original.size == (1807,768)
    atlas = Image.new('RGB',(1807,768))
    for row in range(4):
        for column in range(13):
            card = original.crop((XS[column],YS[row],XS[column+1],YS[row+1]))
            atlas.paste(card.resize((139,192),Image.Resampling.LANCZOS),(column*139,row*192))
    png = atlas.quantize(colors=256)
    for directory in [SOURCE,RUNTIME]:
        png.save(directory / 'faces.png',optimize=True)
        layout = json.loads((directory / 'layout.json').read_text())
        layout['normalization'] = {'source':'source-faces.webp','sourceColumns':XS,'sourceRows':YS,'method':'individual whole-card border cuts, resized to 139x192 cells'}
        layout['status'] = 'card-cuts-verified'
        (directory / 'layout.json').write_text(json.dumps(layout,indent=2)+'\n')
    png.convert('RGB').save(RUNTIME / 'faces.webp',quality=92,method=6)

if __name__ == '__main__':
    main()
