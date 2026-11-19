"""Offline click-order symbol detector. Writes reviewable images; never clicks."""
from __future__ import annotations
import argparse
import heapq
import hashlib
import os
import tempfile
import json
import math
from functools import lru_cache
from pathlib import Path
import cv2
import numpy as np


DECISION_THRESHOLDS = {
    'shape_similarity': .68,
    'family_similarity': .80,
    'family_margin': .08,
    'target_margin': .035,
    'assignment_margin': .035,
}


def read_image(path):
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f'Cannot read image: {path}')
    return image


def save_image(path, image):
    ok, encoded = cv2.imencode('.png', image)
    if not ok:
        raise ValueError(f'Cannot encode image: {path}')
    path=Path(path)
    descriptor,temporary=tempfile.mkstemp(prefix='.'+path.stem+'-',suffix='.png',dir=path.parent)
    try:
        with os.fdopen(descriptor,'wb') as handle:
            handle.write(encoded.tobytes())
        os.replace(temporary,path)
    finally:
        if os.path.exists(temporary):os.unlink(temporary)


def clean(mask, minimum=4):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    result = np.zeros(mask.shape, np.uint8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= minimum:
            result[labels == i] = 255
    return result


def tight(mask):
    points = cv2.findNonZero(mask)
    if points is None:
        raise ValueError('A symbol crop contains no usable foreground pixels.')
    x, y, w, h = cv2.boundingRect(points)
    return mask[y:y+h, x:x+w]


def normalize(mask, size=64):
    mask = tight(mask)
    h, w = mask.shape
    scale = (size - 12) / max(h, w)
    resized = cv2.resize(mask, (max(1, round(w*scale)), max(1, round(h*scale))), interpolation=cv2.INTER_NEAREST)
    result = np.zeros((size, size), np.uint8)
    y, x = (size-resized.shape[0])//2, (size-resized.shape[1])//2
    result[y:y+resized.shape[0], x:x+resized.shape[1]] = resized
    return result


def locate_regions(image, require_references=True):
    """Find the close-circle center, then express all regions relative to it."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    blue = cv2.inRange(hsv, (98, 160, 160), (122, 255, 255))
    # Find close rings globally: artwork can share the header blue and join its component.
    white=cv2.inRange(hsv,(0,0,175),(179,90,255))
    contours,_=cv2.findContours(white,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    choices=[]
    for contour in contours:
        bx,by,bw,bh=cv2.boundingRect(contour)
        if not (14<=bw<=75 and .75<bw/bh<1.3):
            continue
        (cx,cy),radius=cv2.minEnclosingCircle(contour)
        circularity=cv2.contourArea(contour)/max(1,math.pi*radius*radius)
        if circularity<.65:
            continue
        control=white[by:by+bh,bx:bx+bw]
        interior=control[int(bh*.28):int(bh*.72),int(bw*.28):int(bw*.72)]
        if np.count_nonzero(interior)<max(3,interior.size*.12):
            continue
        ax,ay=int(round(cx)),int(round(cy))
        # A plain blue row below the X gives the header's left and right edges.
        for offset in range(int(radius)+3,int(radius)+10):
            row=ay+offset
            if row>=image.shape[0] or not blue[row,ax]:
                continue
            left=right=ax
            while left>0 and blue[row,left-1]: left-=1
            while right+1<image.shape[1] and blue[row,right+1]: right+=1
            width=right-left+1
            if width>=120 and .86<(ax-left)/width<.99 and .02<radius/width<.05:
                choices.append((width*circularity,left,ay-round(19*width/425),width,round(80*width/425),ax,ay,radius))
                break
    located=max(choices)[1:] if choices else None
    if located is None:
        raise ValueError('CAPTCHA close X not found. Include the whole verification dialog in the screenshot.')
    x,y,w,h,ax,ay,radius=located
    # Fixed proportions are scaled from the dialog width and anchored at X.
    h=round(80*w/425)
    y=ay-round(19*w/425)
    # The detected close X is the origin. Edge offsets adapt to the rendered scale.
    header_offsets=[x-ax,y-ay,w,h]
    start_offset=header_offsets[1]+h
    left_offset=header_offsets[0]
    scene_start=ay+start_offset
    # This widget's image has a fixed aspect ratio; bright artwork is not a footer.
    scene_end=min(image.shape[0],scene_start+round(304*w/425))
    scene=[ax+left_offset,ay+start_offset,w,scene_end-scene_start]
    if not require_references:
        anchor={'type':'captcha_close_x_center','center':[ax,ay],'radius':round(radius,2),'scale':round(w/425,4),'header_offset':header_offsets}
        return None,scene,anchor
    # Search the instruction row relative to the anchor, never the page origin.
    reference_left=ax+left_offset+int(w*.4)
    reference_top=ay+header_offsets[1]+int(h*.4)
    roi=hsv[reference_top:ay+header_offsets[1]+h-max(3,round(w/85)),reference_left:x+w-int(w*.08)]
    dark=clean(cv2.inRange(roi,(0,0,0),(179,255,125)),3)
    points=cv2.findNonZero(dark)
    if points is None:
        raise ValueError('No click-order reference symbols found below the close X. Slider/rate-limit screens are unsupported.')
    rx,ry,rw,rh=cv2.boundingRect(points)
    if rw<25 or rh<10:
        raise ValueError('No usable click-order reference strip found.')
    reference=[reference_left+rx,reference_top+ry,rw,rh]
    anchor={'type':'captcha_close_x_center','center':[ax,ay],'radius':round(radius,2),'scale':round(w/425,4),'header_offset':header_offsets}
    return reference,scene,anchor


def auto_regions(image):
    reference,scene,_=locate_regions(image)
    return reference,scene


def validate_box(box, image):
    x, y, w, h = box
    if min(x, y) < 0 or min(w, h) < 1 or x+w > image.shape[1] or y+h > image.shape[0]:
        raise ValueError(f'Box is outside the image: {box}')


def reference_symbols(image, box, count):
    x, y, w, h = box
    hsv = cv2.cvtColor(image[y:y+h, x:x+w], cv2.COLOR_BGR2HSV)
    mask = clean(cv2.inRange(hsv, (0, 0, 0), (179, 255, 80)), 2)
    # Locate low-ink separators near each expected cell boundary.
    projection = np.count_nonzero(mask, axis=0)
    boundaries = [0]
    for i in range(1, count):
        expected = w*i/count
        radius = max(1, int(w/count*.18))
        lo, hi = max(boundaries[-1]+2, int(expected)-radius), min(w-1, int(expected)+radius+1)
        values = projection[lo:hi].astype(float) + np.abs(np.arange(lo, hi)-expected)*.03
        boundaries.append(lo + int(np.argmin(values)))
    boundaries.append(w)
    symbols = []
    for i in range(count):
        left, right = boundaries[i:i+2]
        glyph = clean(mask[:, left:right], 3)
        if np.count_nonzero(glyph) < 15:
            raise ValueError(f'Reference {i+1} is empty; adjust --reference-box or --count.')
        symbols.append({'order': i+1, 'box': [x+left, y, right-left, h], 'mask': glyph})
    return symbols


def target_symbols(image, box, include_all_colors=False):
    x0, y0, width, height = box
    scene_image=image[y0:y0+height,x0:x0+width]
    hsv = cv2.cvtColor(scene_image, cv2.COLOR_BGR2HSV)
    lab=cv2.cvtColor(scene_image,cv2.COLOR_BGR2LAB).astype(np.float32)
    smooth=cv2.medianBlur(scene_image,9)
    detail=np.linalg.norm(lab-cv2.cvtColor(smooth,cv2.COLOR_BGR2LAB).astype(np.float32),axis=2)>14
    # Separate stroke hues so differently colored touching symbols remain distinct.
    bands = [(125,179,65,255,35,245), (0,12,100,255,35,245),
             (18,40,110,255,35,255), (40,80,105,255,35,175),
             (95,125,110,255,35,125), (140,179,15,120,145,255),
             (105,140,65,255,90,255), (70,100,90,255,155,255),
             (15,60,15,130,180,255), (115,179,10,85,175,255),
             (145,20,15,200,130,255)]
    # Narrow hue/value windows isolate strokes that broad palettes merge with artwork.
    bands += [(h,min(179,h+10),s0,s1,v0,255)
              for h in range(0,180,8)
              for s0,s1,v0 in [(100,255,145),(20,110,170),(140,255,205)]]
    if include_all_colors:
        # Physical-object discovery must include dark/neutral distractors too.
        # Red crosses hue 179/0; cutting it into two hue bands loses half an outline.
        bands += [(170,12,60,255,35,255), (165,15,100,255,80,255)]
        # Pale strokes have unstable hue. Search by saturation/value across all hues.
        bands += [(0,179,0,smax,vmin,255) for smax in (35,65,100) for vmin in (150,180,210)]
        bands += [(h,min(179,h+12),55,255,35,190) for h in range(0,180,8)]
        bands += [(0,179,0,100,0,115),(145,25,30,255,35,200)]
        bands += [(h,min(179,h+14),45,255,15,cap) for h in range(0,180,12) for cap in (85,130)]
        bands += [(0,179,0,smax,0,vmax) for smax in (25,50,75) for vmax in (45,75,105)]
        bands += [(0,179,0,255,0,vmax) for vmax in (35,50,75,100)]
    candidates = []
    max_side = width*.25
    min_side = max(12,round(width*.045))
    for low, high, saturation, max_saturation, min_value, value, use_detail in [(*band,mode) for band in bands for mode in (False,True)]:
        if low<=high:
            mask=cv2.inRange(hsv,(low,saturation,min_value),(high,max_saturation,value))
        else:
            # Pink/peach strokes cross the HSV red boundary after antialiasing.
            mask=cv2.bitwise_or(cv2.inRange(hsv,(0,saturation,min_value),(high,max_saturation,value)),
                               cv2.inRange(hsv,(low,saturation,min_value),(179,max_saturation,value)))
        if use_detail: mask=np.where(detail,mask,0).astype(np.uint8)
        # Join antialiasing gaps without merging the separate hue bands.
        grouped = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(grouped, 8)
        for i in range(1, n):
            x, y, w, h, area = map(int, stats[i])
            if not (min_side <= w <= max_side and min_side <= h <= max_side and 40 <= area <= width*height*.055):
                continue
            if not (.28 <= w/h <= 3.2 and .08 <= area/(w*h) <= .85):
                continue
            # Preserve the same gap repairs used to locate this symbol.
            glyph = clean(grouped[y:y+h, x:x+w], 3)
            metadata={'box':[x0+x,y0+y,w,h],'band':(low,high,saturation,max_saturation,min_value,value,use_detail)}
            raw=clean(mask[y:y+h,x:x+w],3)
            for variant,appearance in [('repaired',glyph),('raw',raw)]:
                # Equal boxes can hold very different stroke masks. Deduplicate pixels, not positions.
                if any(c['box']==metadata['box'] and np.array_equal(c['mask'],appearance) for c in candidates):
                    continue
                candidates.append({**metadata,'mask':appearance,'mask_variant':variant})
    def contained(a, b):
        x,y,w,h = a['box']
        u,v,s,t = b['box']
        return a is not b and a['band'] == b['band'] and a['mask_variant']==b['mask_variant'] and u <= x and v <= y and u+s >= x+w and v+t >= y+h and (u<x or v<y or u+s>x+w or v+t>y+h)
    candidates = [a for a in candidates if not any(contained(a,b) for b in candidates)]
    candidates.sort(key=lambda c: (c['box'][1], c['box'][0]))
    for i, candidate in enumerate(candidates):
        candidate['id'] = f'T{i+1:02d}'
    return candidates


def openings(mask):
    """Interior negative-space regions encode windows, doors and grid cells."""
    mask=np.where(mask>0,255,0).astype(np.uint8)
    n,labels,stats,_=cv2.connectedComponentsWithStats(255-mask,8)
    holes=np.zeros_like(mask)
    areas=[]
    for i in range(1,n):
        x,y,w,h,area=map(int,stats[i])
        if x==0 or y==0 or x+w==mask.shape[1] or y+h==mask.shape[0]:
            continue
        if area>=5 and w>=2 and h>=2:
            holes[labels==i]=255
            areas.append(area)
    return holes,sorted(areas,reverse=True)


def structure(mask):
    normal=normalize(mask)
    holes,areas=openings(normal)
    return {'enclosed_regions':len(areas),'opening_area_fraction':round(float(np.count_nonzero(holes))/normal.size,4),'opening_areas':areas}


@lru_cache(maxsize=32)
def rotated_features(encoded):
    a=np.frombuffer(encoded,np.uint8).reshape((64,64))
    a=cv2.morphologyEx(a,cv2.MORPH_CLOSE,np.ones((2,2),np.uint8))
    variants=[]
    for angle in range(-180,180,5):
        transform=cv2.getRotationMatrix2D((31.5,31.5),angle,1)
        rotated=normalize(cv2.warpAffine(a,transform,(64,64),flags=cv2.INTER_NEAREST))
        distance=cv2.distanceTransform(255-rotated,cv2.DIST_L2,3)
        holes,areas=openings(rotated)
        variants.append((angle,rotated,distance,holes,len(areas)))
    angles=np.array([v[0] for v in variants])
    strokes=np.stack([v[1]>0 for v in variants]).reshape(len(variants),-1)
    rows,pixels=np.nonzero(strokes)
    counts=np.bincount(rows,minlength=len(variants))
    distances=np.stack([v[2] for v in variants]).reshape(len(variants),-1)
    holes=np.stack([v[3]>0 for v in variants]).reshape(len(variants),-1)
    hole_counts=np.array([v[4] for v in variants])
    return angles,rows,pixels,counts,distances,holes,hole_counts


@lru_cache(maxsize=2048)
def normalized_mask(encoded,shape):
    return normalize(np.frombuffer(encoded,np.uint8).reshape(shape))


@lru_cache(maxsize=2048)
def candidate_features(encoded):
    b=np.frombuffer(encoded,np.uint8).reshape((64,64))
    b=cv2.morphologyEx(b,cv2.MORPH_CLOSE,np.ones((2,2),np.uint8))
    distance=cv2.distanceTransform(255-b,cv2.DIST_L2,3)
    holes,areas=openings(b)
    return b,distance,holes,tuple(areas)


def compare(reference, candidate):
    reference_normal=normalized_mask(reference.tobytes(),reference.shape)
    candidate_normal=normalized_mask(candidate.tobytes(),candidate.shape)
    b,db,hb,areas_b=candidate_features(candidate_normal.tobytes())
    angles,rows,pixels,counts,distances,holes,hole_counts=rotated_features(reference_normal.tobytes())
    forward_values=db.ravel()[pixels]
    forward=np.bincount(rows,weights=forward_values,minlength=len(angles))/counts
    backward_values=distances[:,b.ravel()>0]
    backward=backward_values.mean(axis=1)
    chamfer=np.exp(-(forward+backward)/6)
    precision=np.mean(backward_values<=1.5,axis=1)
    recall=np.bincount(rows,weights=(forward_values<=1.5).astype(float),minlength=len(angles))/counts
    fine_overlap=2*precision*recall/np.maximum(.001,precision+recall)
    stroke_score=.45*chamfer+.55*fine_overlap
    target_holes=hb.ravel()>0
    cavity_score=2*holes[:,target_holes].sum(axis=1)/np.maximum(1,holes.sum(axis=1)+target_holes.sum())
    cavity_score[(hole_counts==0)&(len(areas_b)==0)]=1.
    topology_penalty=np.exp(-.055*np.maximum(0,np.abs(hole_counts-len(areas_b))-1))
    scores=stroke_score*(.94+.06*cavity_score)*topology_penalty
    best=int(np.argmax(scores))
    return float(scores[best]),int(angles[best])


def load_library(exclude_source):
    root=Path(__file__).resolve().parent/'models'
    if not (root/'symbols.npz').exists(): return []
    metadata=json.loads((root/'symbols.json').read_text(encoding='utf-8'))['templates']
    with np.load(root/'symbols.npz',allow_pickle=False) as archive:
        masks=archive['masks']
        return [{**item,'mask':mask.copy()} for item,mask in zip(metadata,masks) if item['source']!=exclude_source]


def library_scores(references,candidates,library,direct):
    if not library:return direct,[None]*len(references)
    classes=sorted({t['class'] for t in library})
    target_support={}
    for label in classes:
        examples=[t for t in library if t['class']==label]
        sources=sorted({t['source'] for t in examples})
        source_scores=[]
        for source in sources:
            group=[t for t in examples if t['source']==source]
            # One reference plus the best available observed target rendering per source.
            selected=[t for t in group if t['kind']=='reference'][:1]+[t for t in group if t['kind']=='target'][:1]
            source_scores.append([max(compare(t['mask'],c['mask'])[0] for t in selected) for c in candidates])
        values=np.sort(np.array(source_scores),axis=0)
        target_support[label]=values[-min(2,len(values)):].mean(axis=0)
    negative_labels=[label for label in classes if not any(t['class']==label and t['kind']=='reference' for t in library)]
    negative_support=np.maximum.reduce([target_support[label] for label in negative_labels]) if negative_labels else np.zeros(len(candidates))
    scores=[];classifications=[]
    for i,reference in enumerate(references):
        support={}
        for label in classes:
            examples=[t for t in library if t['class']==label and t['kind']=='reference']
            similarities=sorted((compare(reference['mask'],t['mask'])[0] for t in examples),reverse=True)
            if similarities:support[label]=float(np.mean(similarities[:2]))
        ranked=sorted(((value,label) for label,value in support.items()),reverse=True)
        best,label=ranked[0]
        margin=best-ranked[1][0] if len(ranked)>1 else best
        if best<DECISION_THRESHOLDS['family_similarity'] or margin<DECISION_THRESHOLDS['family_margin']:
            # An unreliable family must not steer the location toward another symbol.
            # Keep direct shape proposals for inspection and explicitly abstain on family.
            plausible=[family for value,family in ranked if best-value<=DECISION_THRESHOLDS['family_margin']]
            scores.append(direct[i])
            classifications.append({'class':label if best>=.60 else None,'similarity':round(best,4),
                                    'margin':round(margin,4),'possible_families':plausible,
                                    'verified':False,'mode':'direct_shape_review_only'})
            continue
        # Ambiguous references may retain close alternatives, not arbitrary unrelated families.
        eligible={family:value for family,value in support.items() if best-value<=DECISION_THRESHOLDS['family_margin']}
        row=[]
        candidate_families={}
        for j in range(len(candidates)):
            def adjusted(family):
                value=target_support[family][j]
                contrast=1/(1+math.exp(float(np.clip((negative_support[j]-value)/.05,-30,30))))
                return value*(.70+.30*contrast)
            joint,family=max((math.sqrt(max(0,ref_score*adjusted(family))),family) for family,ref_score in eligible.items())
            candidate_families[candidates[j]['id']]=family
            row.append((float(.80*joint+.20*direct[i][j][0]),direct[i][j][1]))
        scores.append(row)
        classifications.append({'class':label,'similarity':round(best,4),'margin':round(margin,4),'possible_families':list(eligible),'verified':True,'candidate_families':candidate_families,'ensemble':'Family-constrained evidence from separate source images where available'})
    return scores,classifications


def annotate(image, references, candidates, output, library=None, shape_matcher=None, precomputed_scores=None):
    if len(candidates) < len(references):
        raise ValueError(f'Only {len(candidates)} targets found for {len(references)} references. Adjust the scene crop.')
    if precomputed_scores is not None:
        scores, classifications = precomputed_scores
    else:
        matcher = shape_matcher or compare
        direct = [[matcher(r['mask'], c['mask']) for c in candidates] for r in references]
        scores,classifications=library_scores(references,candidates,library or [],direct)
        if shape_matcher is not None:
            # Contour evidence drives matching; existing family evidence helps with lookalikes.
            scores = [[(.55*direct[i][j][0]+.45*scores[i][j][0], direct[i][j][1])
                       for j in range(len(candidates))] for i in range(len(references))]
    def same_target(i,j):
        x,y,w,h=candidates[i]['box']
        u,v,s,t=candidates[j]['box']
        intersection=max(0,min(x+w,u+s)-max(x,u))*max(0,min(y+h,v+t)-max(y,v))
        iou=intersection/max(1,w*h+s*t-intersection)
        distance=math.hypot(x+w/2-u-s/2,y+h/2-v-t/2)
        return iou>.55 or distance<.32*min(max(w,h),max(s,t))
    # Keep distinct physical targets, not repeated color-mask proposals of one symbol.
    # This avoids factorial work and a hard failure when a photograph has many proposals.
    options=[]
    for i in range(len(references)):
        row=[]
        for j in sorted(range(len(candidates)),key=lambda j:scores[i][j][0],reverse=True):
            if not any(same_target(j,k) for k in row):
                row.append(j)
            if len(row)>=len(references)+2: break
        options.append(row)
    def assignments(row=0, chosen=(), total=0.):
        if row==len(references):
            yield total,chosen
            return
        for j in options[row]:
            if not any(same_target(j,k) for k in chosen):
                yield from assignments(row+1,chosen+(j,),total+scores[row][j][0])
    ranking=heapq.nlargest(2,assignments())
    if not ranking: raise ValueError('Not enough distinct physical target symbols were extracted.')
    total,assignment=ranking[0]
    margin=(total-ranking[1][0])/len(references) if len(ranking)>1 else None
    candidate_preview = image.copy()
    preview = image.copy()
    matches = []
    for c in candidates:
        x, y, w, h = c['box']
        cv2.rectangle(candidate_preview, (x, y), (x+w, y+h), (0, 230, 255), 2)
        cv2.putText(candidate_preview, c['id'], (x, max(15, y-4)), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 0, 0), 3)
        cv2.putText(candidate_preview, c['id'], (x, max(15, y-4)), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 230, 255), 1)
    for i, j in enumerate(assignment):
        c = candidates[j]
        x, y, w, h = c['box']
        score, angle = scores[i][j]
        center = [x+w//2, y+h//2]
        info=classifications[i]
        reasons=[]
        if score<DECISION_THRESHOLDS['shape_similarity']:reasons.append('low_shape_similarity')
        if info is None or info.get('class') is None:
            reasons.append('reference_family_unverified')
        elif not info.get('verified',False) or len(info.get('possible_families',[]))!=1 or info.get('margin',0)<DECISION_THRESHOLDS['family_margin']:
            reasons.append('ambiguous_reference_family')
        competing=[scores[i][k][0] for k in range(len(candidates)) if not same_target(j,k)]
        local_margin=score-max(competing) if competing else None
        if local_margin is not None and local_margin<DECISION_THRESHOLDS['target_margin']:
            reasons.append('close_or_better_alternative')
        if margin is not None and margin<DECISION_THRESHOLDS['assignment_margin'] and not same_target(j,ranking[1][1][i]):
            reasons.append('ambiguous_assignment')
        decision='review_required' if reasons else 'proposed'
        color=(0,165,245) if reasons else (255,100,0)
        cv2.rectangle(preview,(x-2,y-2),(x+w+2,y+h+2),color,2)
        cx,cy=center
        if reasons:
            cv2.circle(preview,(cx,cy),16,(255,255,255),-1)
            cv2.circle(preview,(cx,cy),16,color,2)
            cv2.putText(preview,f'{i+1}?',(cx-11,cy+6),cv2.FONT_HERSHEY_SIMPLEX,.48,(0,85,145),2)
        else:
            cv2.circle(preview,(cx,cy),14,color,-1)
            cv2.circle(preview,(cx,cy),14,(255,255,255),2)
            cv2.putText(preview,str(i+1),(cx-6,cy+6),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),2)
        alternatives=[]
        for k in sorted(range(len(candidates)),key=lambda k:scores[i][k][0],reverse=True):
            if any(same_target(k,a['_index']) for a in alternatives):continue
            bx,by,bw,bh=candidates[k]['box']
            alternatives.append({'_index':k,'candidate':candidates[k]['id'],'center':[bx+bw//2,by+bh//2],'match_score':round(scores[i][k][0],4),'selected':k==j})
            if len(alternatives)==3:break
        for alternative in alternatives:alternative.pop('_index')
        matches.append({'order':i+1, 'candidate':c['id'], 'box':c['box'], 'center':center, 'match_score':round(score,4),'mask_variant':c.get('mask_variant','raw'),'decision':decision,'review_reasons':reasons,'target_margin':round(local_margin,4) if local_margin is not None else None, 'rotation_degrees':angle,'reference_classification':({k:v for k,v in classifications[i].items() if k!='candidate_families'} if classifications[i] is not None else None),'semantic_family':(classifications[i].get('candidate_families',{}).get(c['id']) if classifications[i] is not None else None),'reference_structure':structure(references[i]['mask']),'target_structure':structure(c['mask']),'alternatives':alternatives})
    for r in references:
        x,y,w,h = r['box']
        cv2.rectangle(preview, (x,y), (x+w,y+h), (0,255,255), 1)
        save_image(output/f'reference-{r["order"]}.png', r['mask'])
    for c in candidates:
        save_image(output/f'candidate-{c["id"]}.png', c['mask'])
    unresolved=[m['order'] for m in matches if m['decision']=='review_required']
    if unresolved:
        footer=np.full((34,preview.shape[1],3),255,np.uint8)
        cv2.putText(footer,'REVIEW REQUIRED: '+', '.join(map(str,unresolved)),(8,23),cv2.FONT_HERSHEY_SIMPLEX,.55,(0,85,145),2)
        preview=np.vstack((preview,footer))
    save_image(output/'annotated.png', preview)
    save_image(output/'candidates.png', candidate_preview)
    return {'status':'review_required' if unresolved else 'proposed_matches','decision_thresholds':dict(DECISION_THRESHOLDS),
            'score_note':'Uncalibrated shape/template similarity. Resolved matches are matcher proposals, not website verification.',
            'assignment_margin':round(margin,4) if margin is not None else None,
            'unresolved_orders':unresolved,'resolved_matches':[m for m in matches if m['decision']=='proposed'],
            'references':[{'order':r['order'],'box':r['box']} for r in references],
            'candidates':[{'id':c['id'],'box':c['box']} for c in candidates],
            'matches':matches,'score_matrix':[[round(s[0],4) for s in row] for row in scores]}



def parse_box(value):
    try:
        box = [int(n) for n in value.split(',')]
        if len(box) != 4:
            raise ValueError()
        return box
    except ValueError:
        raise argparse.ArgumentTypeError('Use x,y,width,height')


def run(image_path, output, reference_box=None, scene_box=None, count=3, use_library=True):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    image = read_image(image_path)
    auto_reference,auto_scene,anchor=locate_regions(image)
    reference_box = reference_box or auto_reference
    scene_box = scene_box or auto_scene
    for box in (reference_box, scene_box):
        validate_box(box, image)
    references = reference_symbols(image, reference_box, count)
    candidates = target_symbols(image, scene_box)
    source_hash=hashlib.sha256(Path(image_path).read_bytes()).hexdigest()
    library=load_library(source_hash) if use_library else []
    result = annotate(image, references, candidates, output, library)
    result['library']={'enabled':bool(library),'templates_used':len(library),'excluded_current_image_hash':source_hash,'validation_note':'Current source image templates are excluded; this is not unseen production accuracy.'}
    ax,ay=anchor['center']
    def relative(box):
        return [box[0]-ax,box[1]-ay,box[2],box[3]]
    for match in result['matches']:
        match['relative_center']=[match['center'][0]-ax,match['center'][1]-ay]
        match['relative_box']=relative(match['box'])
    for item in result['references']+result['candidates']:
        item['relative_box']=relative(item['box'])
    result.update({'source':str(Path(image_path).resolve()), 'coordinate_system':'relative_center and relative_box use the CAPTCHA close X as (0,0); center and box retain original screenshot pixels', 'anchor':anchor, 'reference_box':reference_box, 'scene_box':scene_box,'relative_reference_box':relative(reference_box),'relative_scene_box':relative(scene_box)})
    for filename in ('annotated.png','candidates.png'):
        preview=read_image(output/filename)
        cv2.drawMarker(preview,(ax,ay),(0,0,255),cv2.MARKER_CROSS,18,2)
        save_image(output/filename,preview)
    error_file=output/'error.json'
    if error_file.exists():
        error_file.unlink()
    (output/'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


def format_review_reasons(match,result):
    thresholds={**DECISION_THRESHOLDS,**result.get('decision_thresholds',{})}
    info=match.get('reference_classification') or {}
    lines=[]
    for reason in match.get('review_reasons',[]):
        if reason=='low_shape_similarity':
            lines.append(f"Shape similarity {match['match_score']:.4f} is below {thresholds['shape_similarity']:.4f}.")
        elif reason in ('ambiguous_reference_family','reference_family_unverified'):
            families=info.get('possible_families',[])
            if families:lines.append('Reference family uncertain: '+' / '.join(f.replace('_',' ') for f in families)+'.')
            else:lines.append('Reference family could not be verified.')
            similarity=info.get('similarity')
            gap=info.get('margin')
            if similarity is not None and similarity<thresholds['family_similarity']:
                lines.append(f"Family similarity {similarity:.4f}; required >= {thresholds['family_similarity']:.4f}.")
            if gap is not None and gap<thresholds['family_margin']:
                lines.append(f"Family score gap {gap:.4f}; required >= {thresholds['family_margin']:.4f}.")
            if info.get('mode')=='direct_shape_review_only':lines.append('Location is a shape-only proposal; family remains unresolved.')
        elif reason=='close_or_better_alternative':
            gap=match.get('target_margin')
            if gap is not None:lines.append(f"Target score gap {gap:.4f}; required >= {thresholds['target_margin']:.4f}.")
        elif reason=='ambiguous_assignment':
            gap=result.get('assignment_margin')
            if gap is not None:lines.append(f"Sequence score gap {gap:.4f}; required >= {thresholds['assignment_margin']:.4f}.")
        else:lines.append(reason.replace('_',' '))
    return lines


def print_result(result,output):
    print(f"{result['status']}: {Path(output)/'annotated.png'}")
    for match in result['matches']:
        print(f"{match['order']} [{match['decision']}] at {match['center']}; relative to X {match['relative_center']}")
        print(f"  Shape similarity: {match['match_score']:.4f}")
        for reason in format_review_reasons(match,result):print('  Review: '+reason)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent/'output')
    parser.add_argument('--reference-box', type=parse_box)
    parser.add_argument('--scene-box', type=parse_box)
    parser.add_argument('--no-library', action='store_true',help='Use direct structural matching without the labeled template library.')
    parser.add_argument('--count', type=int, choices=range(1,7), default=3)
    args = parser.parse_args()
    try:
        result = run(args.image, args.output, args.reference_box, args.scene_box, args.count, use_library=not args.no_library)
    except (ValueError, cv2.error, OSError) as error:
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output/'error.json').write_text(json.dumps({'status':'not_detected','message':str(error)}, indent=2), encoding='utf-8')
        parser.exit(2, f'Detection failed: {error}\n')
    print_result(result,args.output)


if __name__ == '__main__':
    main()








