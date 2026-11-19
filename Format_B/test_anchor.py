"""Anchor regression using one real, manually reviewed screenshot."""
from pathlib import Path
import cv2
import numpy as np
from detect_symbols import read_image,save_image,run

ROOT=Path(__file__).resolve().parent
fixture=ROOT/'examples'/'real'/'click-order-01.png'
original=read_image(fixture)
expected=np.array([(315,124),(139,301),(357,171)],dtype=float)
expected_anchor=np.array([432,40],dtype=float)
out=ROOT/'examples'/'anchor-checks'
out.mkdir(parents=True,exist_ok=True)
cases=[('original',1.,0,0),('moved',1.,170,120),('scaled',1.25,80,70)]
for name,scale,dx,dy in cases:
    resized=cv2.resize(original,None,fx=scale,fy=scale,interpolation=cv2.INTER_LINEAR)
    image=np.full((max(800,dy+resized.shape[0]+50),max(1280,dx+resized.shape[1]+50),3),35,np.uint8)
    image[dy:dy+resized.shape[0],dx:dx+resized.shape[1]]=resized
    path=out/f'{name}.png'
    save_image(path,image)
    result=run(path,out/name)
    anchor=np.array(result['anchor']['center'])
    actual=np.array([m['center'] for m in result['matches']])
    assert np.linalg.norm(anchor-(expected_anchor*scale+[dx,dy]))<4,(name,anchor)
    assert np.max(np.linalg.norm(actual-(expected*scale+[dx,dy]),axis=1))<9,(name,actual)
    relative=np.array([m['relative_center'] for m in result['matches']])
    assert np.max(np.linalg.norm(relative/scale-(expected-expected_anchor),axis=1))<9,(name,relative)
    print(f'PASS {name}: anchor={anchor.tolist()}, relative centers={relative.tolist()}')
print('PASS: real-image order and X-relative coordinates survive translation and scaling. One real layout tested; similarity scores remain uncalibrated.')
