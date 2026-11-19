"""Regression for the reported windowed-buildings versus empty-buildings failure."""
from pathlib import Path
import numpy as np
from detect_symbols import run
ROOT=Path(__file__).resolve().parent
image=ROOT/'examples'/'real'/'building-confusion.png'
expected=np.array([(395,208),(395,119),(129,341)])
for use_library in (False,True):
    out=ROOT/'examples'/'regression'/('building-library' if use_library else 'building-direct')
    result=run(image,out,use_library=use_library)
    actual=np.array([m['center'] for m in result['matches']])
    assert np.all(np.linalg.norm(actual-expected,axis=1)<15),(use_library,actual.tolist())
    assert np.linalg.norm(actual[0]-[41,119])>100,'Empty-building distractor was selected again.'
    assert all(len(m['alternatives'])>=2 for m in result['matches'])
    if use_library: assert result['library']['templates_used']>0
    print(f'PASS reported failure, library={use_library}: {actual.tolist()}')
