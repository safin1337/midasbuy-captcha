"""Required regression: preserve castle structure, prevent family drift, expose abstention."""
from pathlib import Path
import numpy as np
from detect_symbols import run
ROOT=Path(__file__).resolve().parent
source=ROOT/'examples'/'real'/'castle-towers.png'
result=run(source,ROOT/'examples'/'regression'/'castle-towers')
expected=np.array([(128,291),(394,250),(84,203)])
actual=np.array([m['center'] for m in result['matches']])
assert np.all(np.linalg.norm(actual-expected,axis=1)<12),actual.tolist()
third=result['matches'][2]
assert third['semantic_family'] in (None,'castle'),third
assert third['reference_classification']['class']=='castle'
assert 'document' not in third['reference_classification']['possible_families']
assert third['decision']=='review_required',third
assert 3 in result['unresolved_orders']
assert not any(m['order']==3 for m in result['resolved_matches'])
assert 'ambiguous_reference_family' in third['review_reasons']
print('PASS input 3: correct castle proposal, no document-family drift, unresolved target excluded from resolved matches.')
