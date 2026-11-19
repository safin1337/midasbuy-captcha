"""Foreground outline search for symbols merged with dark background components."""
import cv2
import numpy as np
from detect_symbols import tight,normalize


def dark_outline_proposals(image,scene_box,prototypes):
    sx,sy,sw,sh=scene_box
    value=cv2.cvtColor(image[sy:sy+sh,sx:sx+sw],cv2.COLOR_BGR2HSV)[:,:,2]
    channels=[np.where(value<cap,255,0).astype(np.uint8) for cap in (35,55,85)]
    hits=[]
    for prototype in prototypes:
        original=normalize(prototype['mask'])
        for angle in range(-90,91,15):
            rotated=cv2.warpAffine(original,cv2.getRotationMatrix2D((31.5,31.5),angle,1),(64,64),flags=cv2.INTER_NEAREST)
            glyph=tight(rotated)
            for size in (sw*.08,sw*.10,sw*.12):
                scale=size/max(glyph.shape)
                w=max(8,round(glyph.shape[1]*scale));h=max(8,round(glyph.shape[0]*scale))
                template=cv2.resize(glyph,(w,h),interpolation=cv2.INTER_NEAREST)
                if not .07<np.mean(template>0)<.65:continue
                for mask in channels:
                    response=cv2.matchTemplate(mask,template,cv2.TM_CCORR_NORMED)
                    _,score,_,location=cv2.minMaxLoc(response)
                    if score<.70:continue
                    x,y=location
                    hits.append({'box':[sx+x,sy+y,w,h],'mask':mask[y:y+h,x:x+w].copy(),'search_score':float(score),'mask_variant':'outline_search','band':None,'id':'search'})
    hits.sort(key=lambda p:p['search_score'],reverse=True)
    chosen=[]
    for proposal in hits:
        x,y,w,h=proposal['box'];point=np.array([x+w/2,y+h/2])
        if any(np.linalg.norm(point-np.array([c['box'][0]+c['box'][2]/2,c['box'][1]+c['box'][3]/2]))<sw*.025 for c in chosen):continue
        chosen.append(proposal)
        if len(chosen)==30:break
    return chosen
