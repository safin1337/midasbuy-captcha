"""Build a labeled local symbol library from reviewed examples; no browser activity."""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from detect_symbols import read_image,locate_regions,reference_symbols,target_symbols,normalize
ROOT=Path(__file__).resolve().parent
SAMPLES={
'input.png':(['document','grid','tiered_gate'],[(315,124),(139,301),(357,171)]),
'input2.png':(['window_buildings','medical_box','castle'],[(395,208),(395,119),(129,341)]),
'input3.png':(['single_gate','tiered_gate','castle'],[(128,291),(394,250),(84,203)]),
'input4.png':(['single_gate','window_buildings','calendar'],[(83,298),(306,120),(85,119)]),
'input5.png':(['single_gate','grid','tiered_gate'],[(342,248),(120,337),(385,117)]),
'input6.png':(['window_buildings','tiered_gate','castle'],[(168,158),(300,250),(300,157)]),
'input7.png':(['single_gate','tiered_gate','document'],[(214,120),(394,250),(129,339)]),
'input8.png':(['calendar','tiered_gate','medical_box'],[(170,117),(38,210),(392,117)]),
'input9.png':(['document','window_buildings','calendar'],[(262,119),(85,254),(85,163)]),
'input10.png':(['single_gate','document','tiered_gate'],[(121,184),(163,359),(427,273)])}


DISTRACTORS={
'input.png':[('twin_towers',(315,168)),('corner_building',(357,351))],
'input2.png':[('empty_buildings',(41,119)),('twin_towers',(395,166))],
'input3.png':[('empty_buildings',(394,159)),('twin_towers',(128,336))],
'input4.png':[('empty_buildings',(129,297)),('corner_building',(351,254))],
'input5.png':[('empty_buildings',(209,293)),('medical_box',(119,246))],
'input6.png':[('empty_buildings',(35,291)),('twin_towers',(213,291))],
'input7.png':[('corner_building',(129,294)),('loops',(40,158))],
'input8.png':[('corner_building',(255,160)),('twin_towers',(35,338))],
'input9.png':[('twin_towers',(395,163)),('twin_towers',(175,344))],
'input10.png':[('empty_buildings',(119,138)),('corner_building',(250,225))]}

def main():
    masks=[];metadata=[]
    for name,(labels,points) in SAMPLES.items():
        path=ROOT/'raw_data'/name
        image=read_image(path)
        source=hashlib.sha256(path.read_bytes()).hexdigest()
        reference,scene,_=locate_regions(image)
        refs=reference_symbols(image,reference,3)
        targets=target_symbols(image,scene)
        for i,(label,point) in enumerate(list(zip(labels,points))+DISTRACTORS.get(name,[])):
            if i<len(refs):
                masks.append(normalize(refs[i]['mask']))
                metadata.append({'class':label,'kind':'reference','source':source,'image':name})
            proposals=[]
            for c in targets:
                x,y,w,h=c['box']
                distance=np.linalg.norm(np.array([x+w/2,y+h/2])-point)
                if distance<18 and max(w,h)<68 and min(w,h)>20:
                    fitness=distance+.2*abs(w-h)+.08*abs(max(w,h)-40)
                    proposals.append((fitness,c))
            for _,c in sorted(proposals,key=lambda p:p[0])[:2]:
                masks.append(normalize(c['mask']))
                metadata.append({'class':label,'kind':'target','source':source,'image':name})
    out=ROOT/'models'
    out.mkdir(exist_ok=True)
    np.savez_compressed(out/'symbols.npz',masks=np.stack(masks))
    (out/'symbols.json').write_text(json.dumps({'version':1,'note':'Supervised development library from manually reviewed local examples; detection excludes the current image hash by default.','templates':metadata,'annotations':{k:{'classes':v[0],'centers':v[1]} for k,v in SAMPLES.items()}},indent=2),encoding='utf-8')
    print(f'Built {len(masks)} templates, {len(set(m["class"] for m in metadata))} families, {len(SAMPLES)} source images.')

if __name__=='__main__':main()
