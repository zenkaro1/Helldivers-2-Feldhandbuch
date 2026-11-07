from pathlib import Path
from PIL import Image
import numpy as np
for folder_name in ['icons']:
    folder = Path('assets/img/enemies')/folder_name
    count=0
    for p in sorted(folder.glob('*.png')):
        im=Image.open(p).convert('RGBA'); a=np.array(im)
        if (a[:,:,3]==0).mean() < 0.02:
            rgb=a[:,:,:3].astype(np.int16); mn=rgb.min(axis=2); mx=rgb.max(axis=2)
            mask=(mn>238)&((mx-mn)<16); a[mask,3]=0
            edge=(mn>225)&(mn<=238)&((mx-mn)<22); a[edge,3]=np.minimum(a[edge,3],100)
            im=Image.fromarray(a,'RGBA')
        box=im.getbbox()
        if box:
            pad=16; l,t,r,b=box; l,t=max(0,l-pad),max(0,t-pad); r,b=min(im.width,r+pad),min(im.height,b+pad); im=im.crop((l,t,r,b))
        im.save(p,optimize=True); count+=1
    print(folder_name,count)
