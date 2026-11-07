from pathlib import Path
from PIL import Image
import json
root=Path('.')
data=json.loads((root/'data/enemies.json').read_text(encoding='utf-8'))
out=root/'assets/img/enemies/card'; out.mkdir(parents=True,exist_ok=True)
for e in data['enemies']:
    src=Path(e.get('imageLarge') or f"assets/img/enemies/{e['id']}.png")
    if not src.exists():
        src=Path(f"assets/img/enemies/{e['id']}.png")
    im=Image.open(src).convert('RGBA')
    im.thumbnail((420,420), Image.Resampling.LANCZOS)
    im.save(out/f"{e['id']}.png", optimize=True)
print('cards',len(list(out.glob('*.png'))))
