from pathlib import Path
import numpy as np
from PIL import Image
folder = Path('assets/img/missions/steps')
count = 0
for p in sorted(folder.glob('*.png')):
    im = Image.open(p).convert('RGB')
    a = np.array(im).astype(np.float32)
    a[:, :, 0] = np.clip(a[:, :, 0] * 0.62 + 4, 0, 255)
    a[:, :, 1] = np.clip(a[:, :, 1] * 0.84 + 8, 0, 255)
    a[:, :, 2] = np.clip(a[:, :, 2] * 1.05 + 18, 0, 255)
    Image.fromarray(a.astype(np.uint8), 'RGB').save(p, optimize=True)
    count += 1
print('tinted', count)
