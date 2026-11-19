"""Offline ordered contour-point matching against the five physical candidates."""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from candidate_stage import physical_symbols
from contour_points import compare_points, sample_contours, rotate, dot_image
from mask_recovery import recover_weak_masks
from detect_symbols import (read_image, save_image, locate_regions, reference_symbols,
                            load_library, annotate, parse_box, validate_box, print_result,
                            library_scores, compare, structure)


def score_candidates(references, candidates, library):
    """Compare mask alternatives inside each object; never introduce extra locations."""
    expanded, groups = [], []
    for candidate in candidates:
        variants, seen = [], set()
        for variant in [candidate] + candidate.get('matching_variants', []):
            key = (variant['mask'].shape, variant['mask'].tobytes())
            if key not in seen:
                seen.add(key)
                variants.append(variant)
        # Preserve the best two appearances per prompt using contour + stroke evidence.
        preliminary = [[(.6*compare_points(r['mask'], v['mask'])[0] +
                         .4*compare(r['mask'], v['mask'])[0]) for v in variants] for r in references]
        keep = sorted({int(k) for row in preliminary for k in np.argsort(row)[-2:]})
        group = []
        for k in keep:
            group.append(len(expanded))
            expanded.append({**variants[k], 'id': f'{candidate["id"]}-v{k}'})
        groups.append(group)
    direct = [[compare_points(r['mask'], v['mask']) for v in expanded] for r in references]
    evidence, classifications = library_scores(references, expanded, library, direct)
    scores, selected, contour_scores = [], [], []
    for i in range(len(references)):
        row, appearances, dots = [], [], []
        for candidate, group in zip(candidates, groups):
            k = max(group, key=lambda k: .55*direct[i][k][0]+.45*evidence[i][k][0])
            row.append((.55*direct[i][k][0]+.45*evidence[i][k][0], direct[i][k][1]))
            appearances.append(expanded[k])
            dots.append(round(direct[i][k][0], 4))
            info = classifications[i]
            if info is not None and 'candidate_families' in info:
                info['candidate_families'][candidate['id']] = info['candidate_families'][expanded[k]['id']]
        scores.append(row)
        selected.append(appearances)
        contour_scores.append(dots)
    return scores, classifications, selected, contour_scores


def run(image_path, output, reference_box=None, scene_box=None, count=3, use_library=True):
    if not 1 <= count <= 5:
        raise ValueError('The physical-candidate pipeline supports one to five prompts.')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    image = read_image(image_path)
    auto_reference, auto_scene, anchor = locate_regions(image)
    reference_box, scene_box = reference_box or auto_reference, scene_box or auto_scene
    for box in (reference_box, scene_box):
        validate_box(box, image)
    digest = hashlib.sha256(Path(image_path).read_bytes()).hexdigest()
    library = load_library(digest) if use_library else []
    candidates, detection = physical_symbols(image, scene_box, library, include_variants=True)
    references = reference_symbols(image, reference_box, count)
    if len(candidates) < len(references):
        raise ValueError(f'Only {len(candidates)} physical candidates for {len(references)} prompts.')
    scores, classifications, appearances, contour_scores = score_candidates(references, candidates, library)
    recovery=recover_weak_masks(image,references,candidates,scores,classifications,appearances,contour_scores)
    result = annotate(image, references, candidates, output, library,
                      precomputed_scores=(scores, classifications))
    # Show the actual appearance used for each selected match, preserving physical boxes.
    for i, match in enumerate(result['matches']):
        j = next(j for j, c in enumerate(candidates) if c['id'] == match['candidate'])
        appearance = appearances[i][j]
        candidates[j]['mask'] = appearance['mask']
        match['matching_mask_box'] = list(appearance['box'])
        match['mask_variant'] = appearance.get('mask_variant', 'raw')
        match['target_structure'] = structure(appearance['mask'])
        save_image(output/f'candidate-{match["candidate"]}.png', appearance['mask'])
    result.update({'stage': 'ordered_contour_matching', 'matcher': 'arc_length_contour_points',
                   'mask_recovery':recovery,
                   'physical_detection': detection, 'source': str(Path(image_path).resolve()),
                   'anchor': anchor, 'reference_box': reference_box, 'scene_box': scene_box,
                   'library': {'enabled': bool(library), 'templates_used': len(library),
                               'excluded_current_image_hash': digest},
                   'score_note': 'Uncalibrated contour similarity with existing family evidence; not website verification.'})
    ax, ay = anchor['center']
    def relative(box):
        return [box[0]-ax, box[1]-ay, box[2], box[3]]
    # Incomplete/uncertain localization cannot produce a resolved sequence.
    if detection['status'] != 'candidates_proposed':
        for match in result['matches']:
            match['decision'] = 'review_required'
            match['review_reasons'].append('physical_detection_uncertain')
        result['resolved_matches'] = []
        result['unresolved_orders'] = [m['order'] for m in result['matches']]
        result['status'] = 'review_required'
    for match in result['matches']:
        match['relative_center'] = [match['center'][0]-ax, match['center'][1]-ay]
        match['relative_box'] = relative(match['box'])
    for item in result['references'] + result['candidates']:
        item['relative_box'] = relative(item['box'])
    result['relative_reference_box'], result['relative_scene_box'] = relative(reference_box), relative(scene_box)
    result['coordinate_system'] = 'center/box: screenshot pixels; relative_center/relative_box: close X origin'
    result['candidate_order'] = [m['candidate'] for m in result['matches']]
    result['contour_score_matrix'] = contour_scores
    result['matching_mask_boxes'] = [[list(v['box']) for v in row] for row in appearances]
    result['matching_note'] = ('Each score selects an alternate mask within the same physical candidate. '
                              'Contours retain inner boundaries; no separate contours are joined. '
                              'Final score: 55% contour score + 45% existing family-assisted evidence.')
    clouds = {}
    labels = []
    for label, symbol in [(f'prompt-{r["order"]}', r) for r in references] + [(c['id'], c) for c in candidates]:
        points = sample_contours(symbol['mask'])
        clouds[label] = np.round(points, 3).tolist()
        tile = np.vstack((np.full((30, 192, 3), 255, np.uint8), dot_image(points)))
        cv2.putText(tile, label, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, .55, (30, 30, 30), 1)
        save_image(output/f'dots-{label}.png', tile)
        labels.append(tile)
    gallery = np.full((444, 192*5, 3), 255, np.uint8)
    for i, tile in enumerate(labels):
        row, col = (0, i) if i < len(references) else (1, i-len(references))
        gallery[row*222:(row+1)*222, col*192:(col+1)*192] = tile
    save_image(output/'dot-gallery.png', gallery)
    alignments = []
    for r, match in zip(references, result['matches']):
        c = next(c for c in candidates if c['id'] == match['candidate'])
        points = rotate(sample_contours(r['mask']), match['rotation_degrees'])
        target = sample_contours(c['mask'])
        overlay = dot_image(target, (0, 130, 230))
        for x, y in points:
            cv2.circle(overlay, (round(float(x)*3), round(float(y)*3)), 1, (210, 80, 20), -1)
        tile = np.vstack((np.full((55, 192, 3), 255, np.uint8), overlay))
        cv2.putText(tile, f'{r["order"]} -> {c["id"]} ({match["rotation_degrees"]} deg)', (5, 20), cv2.FONT_HERSHEY_SIMPLEX, .45, (30, 30, 30), 1)
        cv2.putText(tile, match['decision'], (5, 42), cv2.FONT_HERSHEY_SIMPLEX, .4, (30, 30, 30), 1)
        alignments.append(tile)
    save_image(output/'dot-alignment.png', np.hstack(alignments))
    result['contour_points'] = {'coordinate_system': 'independently centered, proportion-preserving 64x64 frame',
                                'spacing_pixels': 1.5, 'rotation_step_degrees': 5,
                                'includes_internal_contours': True, 'symbols': clouds}
    for filename in ('annotated.png', 'candidates.png'):
        preview = read_image(output/filename)
        cv2.drawMarker(preview, (ax, ay), (0, 0, 255), cv2.MARKER_CROSS, 18, 2)
        if detection['status'] != 'candidates_proposed':
            footer = np.full((34, preview.shape[1], 3), 255, np.uint8)
            cv2.putText(footer, 'REVIEW: physical detection uncertain', (5, 23), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 85, 145), 1)
            preview = np.vstack((preview, footer))
        save_image(output/filename, preview)
    (output/'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (output/'error.json').unlink(missing_ok=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent/'output')
    parser.add_argument('--reference-box', type=parse_box)
    parser.add_argument('--scene-box', type=parse_box)
    parser.add_argument('--count', type=int, choices=range(1, 6), default=3)
    parser.add_argument('--no-library', action='store_true')
    args = parser.parse_args()
    try:
        result = run(args.image, args.output, args.reference_box, args.scene_box, args.count, not args.no_library)
    except (ValueError, OSError, cv2.error) as error:
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output/'error.json').write_text(json.dumps({'status': 'not_detected', 'message': str(error)}, indent=2), encoding='utf-8')
        parser.exit(2, f'Detection failed: {error}\n')
    print_result(result, args.output)
    print('Candidate order: ' + ' -> '.join(result['candidate_order']))
    print(f'Dot alignment: {args.output/"dot-alignment.png"}')


if __name__ == '__main__':
    main()
