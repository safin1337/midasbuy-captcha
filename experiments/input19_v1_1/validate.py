"""Validate the isolated candidate release against every user-reviewed sample."""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np

PROJECT=Path(__file__).resolve().parents[2]
EXPERIMENT=Path(__file__).resolve().parent
sys.path.insert(0,str(EXPERIMENT/'Format_B'))
from dot_matcher import run
from evaluate_samples import EXPECTED

reviews=json.loads((PROJECT/'Format_B/reviewed_orders.json').read_text())['samples']
sources=sorted((PROJECT/'Format_B/raw_data').glob('input*.png'))
output=EXPERIMENT/'validation'
rows=[]
skipped=[]
for source in sources:
    expected=EXPECTED.get(source.name)
    if source.name in reviews:
        review=reviews[source.name]
        assert hashlib.sha256(source.read_bytes()).hexdigest()==review['source_sha256']
        if expected is None:expected=review['expected_centers']
    if expected is None:
        skipped.append(source.name)
        continue
    print('START',source.name,flush=True)
    baseline=json.loads((PROJECT/'Format_B/diagnostics/dot_evaluation'/source.stem/'result.json').read_text())
    saved=output/source.stem/'result.json'
    if saved.exists():
        result=json.loads(saved.read_text())
        assert result['library']['excluded_current_image_hash']==hashlib.sha256(source.read_bytes()).hexdigest()
        assert 'mask_recovery' in result
    else:
        result=run(source,output/source.stem)
    correct=[bool(v<18) for v in np.linalg.norm(np.array([m['center'] for m in result['matches']])-expected,axis=1)]
    unchanged_boxes=[c['box'] for c in baseline['candidates']]==[c['box'] for c in result['candidates']]
    confident_wrong=[m['order'] for m in result['resolved_matches'] if not correct[m['order']-1]]
    row={'image':source.name,'correct':correct,'order':result['candidate_order'],
         'unchanged_candidate_boxes':unchanged_boxes,'incorrect_confident_positions':confident_wrong,
         'review_positions':result['unresolved_orders'],'recovery':result['mask_recovery']}
    rows.append(row)
    print(json.dumps(row),flush=True)
summary={'correct_targets':sum(sum(r['correct']) for r in rows),'total_targets':len(rows)*3,
         'unchanged_localizations':all(r['unchanged_candidate_boxes'] for r in rows),
         'incorrect_confident_targets':sum(len(r['incorrect_confident_positions']) for r in rows),
         'skipped_unlabelled_images':skipped,
         'note':'User-reviewed development regressions; not unseen accuracy. Isolated runtime; primary source unchanged.',
         'samples':rows}
output.mkdir(parents=True,exist_ok=True)
(output/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='samples'}),flush=True)
raise SystemExit(0 if summary['correct_targets']==summary['total_targets'] and summary['unchanged_localizations'] and not summary['incorrect_confident_targets'] else 1)
