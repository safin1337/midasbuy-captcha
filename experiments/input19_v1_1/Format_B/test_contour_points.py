"""Geometry, internal-detail, rotation, and distinct ordered-assignment regressions."""
from pathlib import Path
import tempfile
import cv2
import numpy as np
from contour_points import compare_points, sample_contours
from detect_symbols import annotate
from test_detector import symbol
from dot_matcher import score_candidates


def main():
    source = symbol(0)
    rotated = cv2.warpAffine(source, cv2.getRotationMatrix2D((39.5, 39.5), 37, 1), (80, 80))
    score, angle = compare_points(source, rotated)
    assert score > .75 and abs(angle-37) <= 5, (score, angle)
    assert score > compare_points(source, symbol(1))[0] + .1
    padded = np.pad(source, ((19, 8), (3, 28)))
    assert np.allclose(sample_contours(source), sample_contours(padded))
    assert compare_points(source, source)[0] > .95
    rectangle = np.zeros((80, 80), np.uint8)
    cv2.rectangle(rectangle, (12, 12), (67, 67), 255, 5)
    assert len(sample_contours(source)) > len(sample_contours(rectangle)), 'Internal cross must contribute points.'
    try:
        sample_contours(np.zeros((40, 40), np.uint8))
    except ValueError:
        pass
    else:
        raise AssertionError('Empty masks must fail instead of matching.')
    print('PASS: full-rotation comparison, internal contours, padding invariance, and empty-mask rejection.')
    candidates = [{'id': chr(65+i), 'box': [20+i*90, 100, 65, 65], 'mask': symbol(i)} for i in range(5)]
    image = np.full((240, 500, 3), 240, np.uint8)
    with tempfile.TemporaryDirectory() as directory:
        for order in ((2, 0, 1), (1, 2, 0)):
            references = [{'order': i+1, 'box': [20+i*80, 10, 65, 65], 'mask': symbol(kind)} for i, kind in enumerate(order)]
            result = annotate(image, references, candidates, Path(directory), shape_matcher=compare_points)
            assert [m['candidate'] for m in result['matches']] == [chr(65+k) for k in order]
            assert len({m['candidate'] for m in result['matches']}) == 3
        candidates[3]['mask'] = candidates[0]['mask'].copy()
        references = [{'order': 1, 'box': [20, 10, 65, 65], 'mask': symbol(0)}]
        result = annotate(image, references, candidates, Path(directory), shape_matcher=compare_points)
        assert result['matches'][0]['decision'] == 'review_required'
        assert 'ambiguous_assignment' in result['matches'][0]['review_reasons']
    print('PASS: reordered prompts yield reordered distinct candidates; duplicate-shape ambiguity is flagged.')
    # A bad representative must not hide a complete mask at the same physical location.
    candidate = {'id': 'A', 'box': [30, 100, 70, 70], 'mask': symbol(1),
                 'matching_variants': [{'box': [31, 101, 68, 68], 'mask': symbol(0)}]}
    scores, _, appearances, _ = score_candidates(references, [candidate], [])
    assert scores[0][0][0] > .95
    assert np.array_equal(appearances[0][0]['mask'], symbol(0))
    assert candidate['id'] == 'A' and candidate['box'] == [30, 100, 70, 70]
    print('PASS: alternate complete masks are matched without creating extra physical candidates.')


if __name__ == '__main__':
    main()
