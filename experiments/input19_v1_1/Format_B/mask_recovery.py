"""Recover fine strokes inside existing boxes for weak, unverified shape matches."""
import cv2
import numpy as np
from detect_symbols import clean, DECISION_THRESHOLDS
from contour_points import compare_points


def local_variants(image, candidate, appearance):
    band=appearance.get('band')
    if band is None:
        return
    low,high,smin,smax,vmin,vmax,_=band
    # Hue relaxation is useful only for an existing bounded color hypothesis.
    if (high-low)%180>100 or smin<15:
        return
    x,y,w,h=candidate['box']
    hsv=cv2.cvtColor(image[y:y+h,x:x+w],cv2.COLOR_BGR2HSV)
    seen=set()
    for lower,upper in ((-10,0),(0,10),(-10,10),(0,0)):
        lo,hi=(low+lower)%180,(high+upper)%180
        if low<=high:
            lo,hi=max(0,low+lower),min(179,high+upper)
        for value_extra in (25,50):
            saturation=max(0,smin-55)
            value=min(255,vmax+value_extra)
            if lo<=hi:
                mask=cv2.inRange(hsv,(lo,saturation,vmin),(hi,smax,value))
            else:
                mask=(cv2.inRange(hsv,(lo,saturation,vmin),(179,smax,value)) |
                      cv2.inRange(hsv,(0,saturation,vmin),(hi,smax,value)))
            # Do not close small openings or discard low-contrast antialiased windows.
            mask=clean(mask,3)
            if not .04<float(np.mean(mask>0))<.55:
                continue
            key=mask.tobytes()
            if key in seen:
                continue
            seen.add(key)
            yield {'box':list(candidate['box']),'mask':mask,
                   'band':(lo,hi,saturation,smax,vmin,value,False),
                   'mask_variant':'local_color_recovery'}


def recover_weak_masks(image, references, candidates, scores, classifications, appearances, contour_scores):
    events=[]
    weak_limit=DECISION_THRESHOLDS['shape_similarity']+2*DECISION_THRESHOLDS['target_margin']
    for i,reference in enumerate(references):
        info=classifications[i]
        if (info is not None and info.get('verified')) or max(s[0] for s in scores[i])>=weak_limit:
            continue
        # Unverified-family rows already fall back to pure contour evidence.
        for j,candidate in enumerate(candidates):
            before=scores[i][j][0]
            best=before
            selected=None
            angle=scores[i][j][1]
            for variant in local_variants(image,candidate,appearances[i][j]):
                score,rotation=compare_points(reference['mask'],variant['mask'])
                if score>best:
                    best,angle,selected=score,rotation,variant
            if selected is not None:
                scores[i][j]=(best,angle)
                contour_scores[i][j]=round(best,4)
                appearances[i][j]=selected
                events.append({'order':i+1,'candidate':candidate['id'],
                               'before':round(before,4),'after':round(best,4),
                               'band':list(selected['band'])})
    return events
