"""Offline feature experiment; does not alter the detector."""
import sys,json,hashlib
from pathlib import Path
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from detect_symbols import normalize,read_image,locate_regions,reference_symbols,target_symbols
from evaluate_samples import EXPECTED
def feature(mask):
    image=normalize(mask).astype(np.float32)/255
    gx=cv2.Sobel(image,cv2.CV_32F,1,0,ksize=1)
    gy=cv2.Sobel(image,cv2.CV_32F,0,1,ksize=1)
    magnitude=np.hypot(gx,gy)
    angle=np.mod(np.arctan2(gy,gx),np.pi)*9/np.pi
    yy,xx=np.indices((64,64))
    cell=(yy//8)*8+(xx//8)
    lower=np.floor(angle).astype(int)%9
    fraction=angle-np.floor(angle)
    hist=np.bincount((cell*9+lower).ravel(),weights=(magnitude*(1-fraction)).ravel(),minlength=576)
    hist+=np.bincount((cell*9+(lower+1)%9).ravel(),weights=(magnitude*fraction).ravel(),minlength=576)
    hist=hist.reshape(8,8,9)
    blocks=[]
    for y in range(7):
        for x in range(7):
            block=hist[y:y+2,x:x+2].ravel()
            block=block/max(.001,np.linalg.norm(block))
            block=np.minimum(block,.2)
            blocks.append(block/max(.001,np.linalg.norm(block)))
    vector=np.concatenate(blocks).astype(np.float32)
    return vector/max(.001,np.linalg.norm(vector))
metadata=json.loads((ROOT/'models'/'symbols.json').read_text())['templates']
with np.load(ROOT/'models'/'symbols.npz') as archive:masks=archive['masks']
features=[];meta=[]
for m,t in zip(masks,metadata):
    for angle in range(-180,180,10):
        transformed=cv2.warpAffine(m,cv2.getRotationMatrix2D((31.5,31.5),angle,1),(64,64))
        features.append(feature(transformed));meta.append(t)
features=np.array(features)
labels=sorted(set(t['class'] for t in meta))
for name,expected in EXPECTED.items():
    im=read_image(ROOT/'raw_data'/name);ref,scene,_=locate_regions(im)
    refs=reference_symbols(im,ref,3);targets=target_symbols(im,scene)
    digest=hashlib.sha256((ROOT/'raw_data'/name).read_bytes()).hexdigest()
    valid=np.array([t['source']!=digest for t in meta])
    queries=np.array([feature(t['mask']) for t in refs+targets])
    similarities=features@queries.T
    refclasses=[];centers=[]
    for i in range(3):
        classscores=[]
        for label in labels:
            rows=valid & np.array([t['class']==label and t['kind']=='reference' for t in meta])
            classscores.append(float(similarities[rows,i].max()))
        label=labels[int(np.argmax(classscores))]
        refclasses.append(label)
        rows=valid & np.array([t['class']==label for t in meta])
        scores=similarities[rows,3:].max(axis=0)
        j=int(np.argmax(scores));x,y,w,h=targets[j]['box'];centers.append([x+w//2,y+h//2])
    correct=[bool(np.linalg.norm(np.array(a)-b)<18) for a,b in zip(centers,expected)]
    print(name,refclasses,centers,correct,flush=True)

