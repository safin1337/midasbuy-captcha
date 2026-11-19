"""Recover the windowed buildings without moving boxes or hiding uncertainty."""
import tempfile
from pathlib import Path
import numpy as np
from dot_matcher import run

ROOT=Path(__file__).resolve().parent


def main():
    with tempfile.TemporaryDirectory() as directory:
        result=run(ROOT/'raw_data'/'input19.png',Path(directory))
        expected=np.array([(228,260),(139,127),(272,304)])
        actual=np.array([m['center'] for m in result['matches']])
        assert np.all(np.linalg.norm(actual-expected,axis=1)<8),actual.tolist()
        assert result['candidate_order']==['D','A','E']
        second=result['matches'][1]
        assert second['mask_variant']=='local_color_recovery'
        assert second['target_structure']['enclosed_regions']>=6
        assert second['decision']=='review_required'
        assert 'close_or_better_alternative' in second['review_reasons']
        assert any(e['order']==2 and e['candidate']=='A' and e['after']>e['before'] for e in result['mask_recovery'])
    print('PASS: input19 D-A-E, window detail recovered, physical locations preserved, uncertainty retained.')


if __name__=='__main__':
    main()
