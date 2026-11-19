"""Physical-object stage: five objects, instruction independence, and no forced detections."""
from pathlib import Path
import hashlib
import itertools
import numpy as np
from candidate_stage import physical_symbols
from detect_symbols import read_image,locate_regions,load_library
ROOT=Path(__file__).resolve().parent
source=ROOT/'raw_data'/'input3.png'
image=read_image(source)
reference,scene,_=locate_regions(image)
library=load_library(hashlib.sha256(source.read_bytes()).hexdigest())
objects,metadata=physical_symbols(image,scene,library)
expected=np.array([(394,159),(84,203),(394,250),(128,291),(128,336)])
actual=np.array([o['center'] for o in objects])
assert len(objects)==5 and len({o['id'] for o in objects})==5
best=min(itertools.permutations(range(5)),key=lambda p:sum(np.linalg.norm(actual[j]-expected[i]) for i,j in enumerate(p)))
assert all(np.linalg.norm(actual[j]-expected[i])<15 for i,j in enumerate(best)),actual.tolist()
print('PASS: exactly five distinct physical symbols on input 3.',flush=True)
changed=image.copy()
x,y,w,h=reference
changed[y:y+h,x:x+w]=np.fliplr(changed[y:y+h,x:x+w])
changed_objects,_=physical_symbols(changed,scene,library)
assert [o['box'] for o in changed_objects]==[o['box'] for o in objects]
print('PASS: changing the requested reference order does not change physical-object detection.',flush=True)
ax,ay=locate_regions(image)[2]['center']
header=locate_regions(image)[2]['header_offset']
changed[y:y+h,x:x+w]=image[ay+header[1]+3,ax+header[0]+3]
_,new_scene,new_anchor=locate_regions(changed,require_references=False)
assert new_scene==scene
without_instructions,_=physical_symbols(changed,new_scene,library)
assert [o['box'] for o in without_instructions]==[o['box'] for o in objects]
print('PASS: physical detection also works when the requested symbols are hidden.',flush=True)
blank=image.copy()
x,y,w,h=scene
blank[y:y+h,x:x+w]=190
blank_objects,blank_metadata=physical_symbols(blank,scene,library)
assert not blank_objects and blank_metadata['status']=='review_required'
print('PASS: a blank scene returns zero objects; it does not fabricate five candidates.',flush=True)
