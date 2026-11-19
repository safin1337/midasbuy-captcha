"""Locate physical symbols before attempting any click-order matching."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np
from detect_symbols import read_image,save_image,locate_regions,target_symbols,load_library,compare
from outline_search import dark_outline_proposals


def overlap(a,b):
    x,y,w,h=a;u,v,s,t=b
    intersection=max(0,min(x+w,u+s)-max(x,u))*max(0,min(y+h,v+t)-max(y,v))
    return intersection/max(1,w*h+s*t-intersection)


def center(box):
    x,y,w,h=box
    return np.array([x+w/2,y+h/2])


def appearance_quality(image,candidate,detail,scene_box):
    x,y,w,h=candidate['box']
    pixels=image[y:y+h,x:x+w]
    foreground=candidate['mask']>0
    lab=cv2.cvtColor(pixels,cv2.COLOR_BGR2LAB).astype(float)
    values=lab[foreground]
    median=np.median(values,axis=0)
    deviation=float(np.median(np.linalg.norm(values-median,axis=1)))
    flatness=math.exp(-deviation/25)
    sx,sy,sw,sh=scene_box
    contrasts=detail[y-sy:y-sy+h,x-sx:x-sx+w][foreground]
    contrast=float(np.mean(contrasts>14))
    distance=cv2.distanceTransform(candidate['mask'],cv2.DIST_L2,3)
    width95=float(np.percentile(distance[foreground],95))
    thinness=math.exp(-max(0,width95-2.5)/2)
    size=math.exp(-.6*abs(math.log(max(w,h)/(sw*.095))))
    quality=.30*flatness+.30*contrast+.25*thinness+.15*size
    return quality,{'flatness':round(flatness,4),'local_contrast':round(contrast,4),'thin_strokes':round(thinness,4)}


def physical_symbols(image,scene_box,library,expected=5,include_variants=False):
    sx,sy,sw,sh=scene_box
    scene=image[sy:sy+sh,sx:sx+sw]
    detail=np.linalg.norm(cv2.cvtColor(scene,cv2.COLOR_BGR2LAB).astype(float)-cv2.cvtColor(cv2.medianBlur(scene,9),cv2.COLOR_BGR2LAB).astype(float),axis=2)
    prototypes=[]
    for family in sorted({t['class'] for t in library}):
        selected=[];sources=set()
        options=sorted((t for t in library if t['class']==family),key=lambda t:t['kind']!='target')
        for t in options:
            if t['source'] not in sources:
                selected.append(t);sources.add(t['source'])
            if len(selected)==2:break
        prototypes.extend(selected)
    hypotheses=[]
    proposals=target_symbols(image,scene_box,include_all_colors=True)+dark_outline_proposals(image,scene_box,prototypes)
    for proposal in proposals:
        x,y,w,h=proposal['box']
        if max(w,h)>sw*.16 or min(w,h)<sw*.045 or not .4<w/h<2.5:
            continue
        quality,evidence=appearance_quality(image,proposal,detail,scene_box)
        hypotheses.append({**proposal,'quality':quality,'evidence':evidence})
    hypotheses.sort(key=lambda c:c['quality'],reverse=True)
    groups=[]
    for proposal in hypotheses:
        point=center(proposal['box'])
        compatible=[g for g in groups if np.linalg.norm(point-g['point'])<=sw*.040 and overlap(proposal['box'],g['seed']['box'])>.18]
        if compatible:
            group=min(compatible,key=lambda g:np.linalg.norm(point-g['point']))
            group['variants'].append(proposal)
        else:
            groups.append({'point':point,'seed':proposal,'variants':[proposal]})
    # Objectness comes from line appearance plus a generic symbol library, not the instruction strip.
    ranked=[]
    for group in groups:
        variants=group['variants']
        # Keep geometrically different appearances within each group for object recognition.
        representatives=[]
        appearance_order=sorted(variants,key=lambda v:(v.get('search_score',0),v['quality']),reverse=True)
        # A clean fragment can outrank a complete outline on appearance alone.
        # Include larger plausible extents in template scoring before suppressing duplicates.
        complete_order=sorted((v for v in variants if v['quality']>=.65),
                              key=lambda v:v['box'][2]*v['box'][3],reverse=True)
        for proposal in appearance_order[:3]+complete_order[:2]:
            if not any(np.array_equal(proposal['mask'],v['mask']) for v in representatives):
                representatives.append(proposal)
        best=None
        for proposal in representatives:
            template=max(max((compare(t['mask'],proposal['mask'])[0] for t in prototypes),default=.5),proposal.get('search_score',0))
            support=min(1.,math.log1p(len(variants))/math.log(15))
            line_evidence=math.sqrt(proposal['evidence']['local_contrast']*proposal['evidence']['thin_strokes'])
            search_bonus=.10*line_evidence if proposal.get('search_score',0)>=.70 else 0
            background_penalty=.20*(1-proposal['evidence']['thin_strokes'])*(1-proposal['evidence']['local_contrast'])
            score=min(1.,.45*template+.40*proposal['quality']+.15*support+search_bonus-background_penalty)
            if best is None or score>best['objectness']:
                best={**proposal,'objectness':float(score),'template_similarity':float(template),'support':len(variants),'variants':variants}
        if best is not None:ranked.append(best)
    ranked.sort(key=lambda c:c['objectness'],reverse=True)
    independent=[]
    for proposal in ranked:
        if any(np.linalg.norm(center(proposal['box'])-center(other['box']))<sw*.060 or overlap(proposal['box'],other['box'])>.30 for other in independent):
            continue
        independent.append(proposal)
    selected=independent[:expected]
    fifth=selected[-1]['objectness'] if len(selected)==expected else None
    next_score=independent[expected]['objectness'] if len(independent)>expected else None
    separation=fifth-next_score if fifth is not None and next_score is not None else None
    status='candidates_proposed' if len(selected)==expected and fifth>=.60 else 'review_required'
    # Use actual rows rather than fixed bins, which can swap labels after a tiny shift.
    rows=[]
    for proposal in sorted(selected,key=lambda c:center(c['box'])[1]):
        if rows and abs(center(proposal['box'])[1]-np.median([center(p['box'])[1] for p in rows[-1]]))<=sw*.045:
            rows[-1].append(proposal)
        else:
            rows.append([proposal])
    selected=[p for row in rows for p in sorted(row,key=lambda c:center(c['box'])[0])]
    objects=[]
    for i,proposal in enumerate(selected):
        variants=proposal['variants']
        # Keep the chosen outline inside its own box; fragment centers must not shift it.
        point=center(proposal['box'])
        size=max(proposal['box'][2:])+2
        left=max(sx,int(math.floor(point[0]-size/2)));top=max(sy,int(math.floor(point[1]-size/2)))
        right=min(sx+sw,int(math.ceil(point[0]+size/2)));bottom=min(sy+sh,int(math.ceil(point[1]+size/2)))
        box=[left,top,right-left,bottom-top]
        mask=np.zeros((box[3],box[2]),np.uint8)
        x,y,w,h=proposal['box']
        ix0,iy0=max(left,x),max(top,y);ix1,iy1=min(right,x+w),min(bottom,y+h)
        if ix1>ix0 and iy1>iy0:
            mask[iy0-top:iy1-top,ix0-left:ix1-left]=proposal['mask'][iy0-y:iy1-y,ix0-x:ix1-x]
        objects.append({'id':chr(65+i),'box':box,'center':[round(float(point[0])),round(float(point[1]))],'objectness':round(proposal['objectness'],4),'mask_variants':proposal['support'],'appearance':proposal['evidence'],'template_similarity':round(proposal['template_similarity'],4),'mask':mask})
        if include_variants:
            objects[-1]['matching_variants'] = variants
    return objects,{'status':status,'expected_count':expected,'candidate_count':len(objects),'internal_mask_hypotheses':len(hypotheses),'internal_spatial_groups':len(groups),'fifth_to_next_margin':round(separation,4) if separation is not None else None,'score_note':'Uncalibrated objectness; count is a format prior, not proof of detection. Instruction/reference glyphs are not used for object locations.'}


def run(image_path,output,expected=5):
    image_path=Path(image_path);output=Path(output);output.mkdir(parents=True,exist_ok=True)
    image=read_image(image_path)
    _,scene,anchor=locate_regions(image,require_references=False)
    digest=hashlib.sha256(image_path.read_bytes()).hexdigest()
    objects,metadata=physical_symbols(image,scene,load_library(digest),expected)
    preview=image.copy()
    gallery=np.full((140,max(1,len(objects))*170,3),245,np.uint8)
    ax,ay=anchor['center']
    for i,obj in enumerate(objects):
        x,y,w,h=obj['box'];cx,cy=obj['center'];color=(70,210,70)
        cv2.rectangle(preview,(x-2,y-2),(x+w+2,y+h+2),color,2)
        cv2.putText(preview,obj['id'],(x,max(18,y-5)),cv2.FONT_HERSHEY_SIMPLEX,.6,(0,0,0),3)
        cv2.putText(preview,obj['id'],(x,max(18,y-5)),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),1)
        crop=image[max(0,y-4):min(image.shape[0],y+h+4),max(0,x-4):min(image.shape[1],x+w+4)]
        save_image(output/f'symbol-{obj["id"]}.png',crop)
        save_image(output/f'mask-{obj["id"]}.png',obj['mask'])
        gallery[30:110,i*170+4:i*170+84]=cv2.resize(crop,(80,80))
        gallery[30:110,i*170+88:i*170+168]=cv2.cvtColor(cv2.resize(obj['mask'],(80,80),interpolation=cv2.INTER_NEAREST),cv2.COLOR_GRAY2BGR)
        cv2.putText(gallery,obj['id'],(i*170+5,22),cv2.FONT_HERSHEY_SIMPLEX,.6,(0,0,0),2)
        obj['relative_center']=[cx-ax,cy-ay]
        obj['relative_box']=[x-ax,y-ay,w,h]
        obj.pop('mask')
    cv2.drawMarker(preview,(ax,ay),(0,0,255),cv2.MARKER_CROSS,18,2)
    footer=np.full((34,preview.shape[1],3),255,np.uint8)
    cv2.putText(footer,f'{len(objects)} physical candidates - selection not performed',(6,23),cv2.FONT_HERSHEY_SIMPLEX,.46,(30,70,30),1)
    save_image(output/'candidates.png',np.vstack((preview,footer)))
    save_image(output/'symbol-gallery.png',gallery)
    result={**metadata,'stage':'physical_candidates','reference_matching_performed':False,'source':str(image_path.resolve()),'anchor':anchor,'scene_box':scene,'candidates':objects,'current_image_templates_excluded':digest}
    (output/'candidates.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image',type=Path)
    parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent/'output'/'candidate_detection')
    args=parser.parse_args()
    result=run(args.image,args.output)
    print(f"{result['status']}: {result['candidate_count']}/{result['expected_count']} physical candidates: {args.output/'candidates.png'}")
    print('Candidate detection only; the three required symbols have not been selected.')
    for candidate in result['candidates']:print(f"{candidate['id']}: {candidate['center']}; relative to X {candidate['relative_center']}")

if __name__=='__main__':main()
