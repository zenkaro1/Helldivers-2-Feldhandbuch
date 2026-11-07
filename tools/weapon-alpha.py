from pathlib import Path
import numpy as np
from PIL import Image

folder = Path('assets/img/weapons/hi')
count = 0
for p in sorted(folder.glob('*.png')):
    im = Image.open(p).convert('RGBA')
    a = np.array(im)
    rgb = a[:, :, :3].astype(np.int16)
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    # fast weißer Hintergrund; leichte Grauverläufe an den Rändern
    mask = (mn > 238) & ((mx - mn) < 16)
    a[mask, 3] = 0
    # halbtransparente Kante direkt neben Weiß
    edge = (mn > 225) & (mn <= 238) & ((mx - mn) < 22)
    a[edge, 3] = np.minimum(a[edge, 3], 90)
    out = Image.fromarray(a, 'RGBA')
    out.save(p, optimize=True)
    count += 1
print('processed', count)
