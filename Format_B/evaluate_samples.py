"""Manually reviewed development samples; not a claim about unseen accuracy."""
import json
from pathlib import Path
import numpy as np
from detect_symbols import run
ROOT=Path(__file__).resolve().parent
EXPECTED={
'input.png':[(315,124),(139,301),(357,171)],
'input2.png':[(395,208),(395,119),(129,341)],
'input3.png':[(128,291),(394,250),(84,203)],
'input4.png':[(83,298),(306,120),(85,119)],
'input5.png':[(342,248),(120,337),(385,117)],
'input6.png':[(168,158),(300,250),(300,157)],
'input7.png':[(214,120),(394,250),(129,339)],
'input8.png':[(170,117),(38,210),(392,117)],
'input9.png':[(262,119),(85,254),(85,163)],
'input10.png':[(121,184),(163,359),(427,273)]}

def evaluate():
    rows=[]
    out=ROOT/'diagnostics'/'final_evaluation'
    out.mkdir(parents=True,exist_ok=True)
    for name,expected in EXPECTED.items():
        try:
            result=run(ROOT/'raw_data'/name,out/Path(name).stem)
            actual=[m['center'] for m in result['matches']]
            distances=np.linalg.norm(np.array(actual)-np.array(expected),axis=1)
            correct=[bool(x<18) for x in distances]
            row={'image':name,'expected':expected,'actual':actual,'correct':correct,'all_correct':all(correct),'review_status':result['status'],'resolved_orders':[m['order'] for m in result['resolved_matches']],'unresolved_orders':result['unresolved_orders']}
        except ValueError as error:
            row={'image':name,'expected':expected,'correct':[False]*3,'all_correct':False,'error':str(error)}
        rows.append(row)
        print(name,row.get('actual',row.get('error')),row['correct'],flush=True)
    summary={'note':'Manually reviewed development samples only; no unseen test accuracy established.', 'correct_targets':sum(sum(r['correct']) for r in rows),'total_targets':len(rows)*3,'correct_images':sum(r['all_correct'] for r in rows),'total_images':len(rows),'samples':rows}
    (out/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(f"Development samples: {summary['correct_targets']}/{summary['total_targets']} targets; {summary['correct_images']}/{summary['total_images']} complete images",flush=True)
    return summary

if __name__=='__main__':
    summary=evaluate()
    raise SystemExit(0 if summary['correct_targets']==summary['total_targets'] else 1)
