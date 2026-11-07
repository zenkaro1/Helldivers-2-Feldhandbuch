from pathlib import Path
from PIL import Image

folder = Path('assets/img/weapons/hi')
count = 0
for p in sorted(folder.glob('*.png')):
    im = Image.open(p).convert('RGBA')
    box = im.getbbox()
    if not box:
        continue
    pad = 18
    l, t, r, b = box
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(im.width, r + pad), min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    # nicht unnötig hochskalieren, aber auf max. 1400 px begrenzen
    if cropped.width > 1400 or cropped.height > 1400:
        cropped.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    cropped.save(p, optimize=True)
    count += 1
print('cropped', count)
