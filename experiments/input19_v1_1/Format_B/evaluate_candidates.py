"""Run physical-object detection on every saved input, with independent reviewed centers."""
from pathlib import Path
import itertools
import json
import re
import cv2
import numpy as np
from build_symbol_library import SAMPLES,DISTRACTORS
from candidate_stage import run
from detect_symbols import read_image,save_image
ROOT=Path(__file__).resolve().parent
# Evaluation labels only. These images are not added to the template library.
EXTRA_REVIEWED={
    'input11.png':[(174,162),(263,208),(306,249),(85,250),(129,339)],
    'input12.png':[(416,219),(194,263),(326,266),(327,307),(371,307)],
    'input13.png':[(35,164),(303,118),(348,164),(305,300),(392,341)],
}
# Approximate centers from assistant visual inspection, kept separate from earlier labels.
# These are regression/development annotations, not independent production ground truth.
VISUAL_REVIEWED={
    'input14.png':[(119,113),(294,111),(338,159),(163,287),(340,334)],
    'input15.png':[(139,128),(404,127),(315,306),(183,348),(405,349)],
    'input16.png':[(49,216),(95,261),(183,261),(139,306),(272,349)],
    'input17.png':[(182,129),(315,129),(227,215),(315,215),(139,349)],
    'input18.png':[(49,216),(227,172),(316,260),(315,306),(318,351)],
    'input19.png':[(139,128),(360,128),(183,215),(228,260),(272,306)],
    'input20.png':[(49,127),(139,216),(273,216),(49,260),(139,349)],
    'input21.png':[(49,129),(272,129),(49,174),(360,172),(95,306)],
    'input22.png':[(139,129),(361,129),(362,216),(315,260),(94,349)],
    'input23.png':[(227,128),(94,216),(94,260),(272,260),(94,306)],
    'input24.png':[(94,216),(94,261),(272,305),(94,349),(316,349)],
    'input25.png':[(358,124),(94,168),(138,302),(268,302),(229,346)],
}

def evaluate():
    files=sorted((p for p in (ROOT/'raw_data').glob('input*') if p.is_file() and p.suffix.lower() in ('.png','.jpg','.jpeg','.webp','.bmp')),key=lambda p:(int(re.search(r'\d+',p.stem).group()) if re.search(r'\d+',p.stem) else 1,p.name))
    out=ROOT/'diagnostics'/'candidate_evaluation'
    out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for source in files:
        name=source.name
        expected=SAMPLES[name][1]+[point for _,point in DISTRACTORS[name]] if name in SAMPLES else EXTRA_REVIEWED.get(name,VISUAL_REVIEWED.get(name))
        group='development' if name in SAMPLES else 'new_sample' if name in EXTRA_REVIEWED else 'assistant_visual' if name in VISUAL_REVIEWED else 'unlabelled'
        try:
            result=run(source,out/source.stem)
            actual=[c['center'] for c in result['candidates']]
            correct=None;distances=[]
            if expected is not None:
                correct=0
                if len(actual)==len(expected)==5:
                    permutation=min(itertools.permutations(range(5)),key=lambda order:sum(np.linalg.norm(np.array(actual[j])-expected[i]) for i,j in enumerate(order)))
                    distances=[float(np.linalg.norm(np.array(actual[j])-expected[i])) for i,j in enumerate(permutation)]
                    correct=sum(d<18 for d in distances)
            row={'image':name,'expected':expected,'actual':actual,'correct_objects':correct,'distances':distances,'status':result['status'],'internal_hypotheses':result['internal_mask_hypotheses'],'validation_group':group}
        except (ValueError,OSError,cv2.error) as error:
            row={'image':name,'expected':expected,'actual':[],'correct_objects':0 if expected is not None else None,'status':'detection_failed','error':str(error),'validation_group':group}
        rows.append(row)
        score=f"{row['correct_objects']}/5" if row['correct_objects'] is not None else 'unlabelled'
        print(name,score,row['actual'],flush=True)
    checked=[row for row in rows if row['correct_objects'] is not None]
    summary={'correct_objects':sum(row['correct_objects'] for row in checked),'total_objects':len(checked)*5,'complete_images':sum(row['correct_objects']==5 for row in checked),'total_images':len(rows),'checked_images':len(checked),'unlabelled_images':[row['image'] for row in rows if row['correct_objects'] is None],'note':'Earlier reviewed centers and newer assistant visual annotations are reported in separate groups; one-to-one matching within 18 pixels. These are development regressions, not blind production accuracy. Images are evaluated without adding them to the template library.','samples':rows}
    for group in ('development','new_sample','assistant_visual'):
        subset=[row for row in checked if row['validation_group']==group]
        summary[group]={'correct_objects':sum(row['correct_objects'] for row in subset),'total_objects':len(subset)*5,'complete_images':sum(row['correct_objects']==5 for row in subset),'total_images':len(subset)}
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    columns=4;cell_w=390;cell_h=470
    sheet=np.full((int(np.ceil(len(rows)/columns))*cell_h,columns*cell_w,3),235,np.uint8)
    for i,row in enumerate(rows):
        top,left=(i//columns)*cell_h,(i%columns)*cell_w
        preview=out/Path(row['image']).stem/'candidates.png'
        if preview.exists() and row['status']!='detection_failed':
            im=read_image(preview)
            scale=min((cell_w-8)/im.shape[1],(cell_h-34)/im.shape[0])
            im=cv2.resize(im,None,fx=scale,fy=scale,interpolation=cv2.INTER_AREA)
            sheet[top+30:top+30+im.shape[0],left:left+im.shape[1]]=im
        label=f"{row['image']}  {row['correct_objects']}/5" if row['correct_objects'] is not None else row['image']+' unlabelled'
        color=(30,95,30) if row['correct_objects']==5 else (0,0,180)
        cv2.putText(sheet,label,(left+6,top+21),cv2.FONT_HERSHEY_SIMPLEX,.55,color,2)
    save_image(out/'all-samples.png',sheet)
    lines=['# All-sample five-object evaluation','',f"Correct objects: **{summary['correct_objects']}/{summary['total_objects']}**. Complete images: **{summary['complete_images']}/{summary['checked_images']}**.",'',summary['note'],'','| Image | Group | Correct physical symbols |','| --- | --- | --- |']
    for row in rows:lines.append(f"| {row['image']} | {row['validation_group']} | {row['correct_objects'] if row['correct_objects'] is not None else 'unchecked'}/5 |")
    lines+=['','The individual previews, crops, and JSON are in each input subfolder. The contact sheet is `all-samples.png`. No three-symbol selection or live CAPTCHA submission was performed.']
    (out/'report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f"Physical detection: {summary['correct_objects']}/{summary['total_objects']} objects, {summary['complete_images']}/{summary['checked_images']} complete checked images",flush=True)
    return summary

if __name__=='__main__':
    summary=evaluate()
    raise SystemExit(0 if summary['correct_objects']==summary['total_objects'] and not summary['unlabelled_images'] else 1)
