"""Compare the contour pipeline against reviewed orders without changing training data."""
import json
import argparse
import hashlib
from pathlib import Path
import numpy as np
from dot_matcher import run
from evaluate_samples import EXPECTED

ROOT = Path(__file__).resolve().parent


def evaluate(saved_results=False):
    output = ROOT/'diagnostics'/'dot_evaluation'
    output.mkdir(parents=True, exist_ok=True)
    review_path = ROOT/'reviewed_orders.json'
    reviews = json.loads(review_path.read_text(encoding='utf-8'))['samples'] if review_path.exists() else {}
    rows = []
    for source in sorted((ROOT/'raw_data').glob('input*.png')):
        expected = EXPECTED.get(source.name)
        review = reviews.get(source.name)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if review is not None:
            if review['source_sha256'] != digest:
                raise ValueError(f'{source.name}: reviewed labels belong to a different image; review it again.')
            if expected is None:
                expected = review['expected_centers']
        try:
            if saved_results:
                result = json.loads((output/source.stem/'result.json').read_text(encoding='utf-8'))
                if result['library']['excluded_current_image_hash'] != digest:
                    raise ValueError(f'{source.name}: saved inference belongs to a different image.')
            else:
                result = run(source, output/source.stem)
            actual = [m['center'] for m in result['matches']]
            correct = [bool(d < 18) for d in np.linalg.norm(np.array(actual)-expected, axis=1)] if expected else None
            row = {'image': source.name, 'expected': expected, 'actual': actual, 'correct': correct,
                   'candidate_order': result['candidate_order'], 'status': result['status'],
                   'unresolved_orders': result['unresolved_orders'],
                   'resolved_orders': [m['order'] for m in result['resolved_matches']],
                   'user_confirmed': review is not None,
                   'validation_group': 'development' if source.name in EXPECTED else 'user_reviewed' if review else 'unlabelled'}
        except (ValueError, OSError) as error:
            row = {'image': source.name, 'expected': expected, 'correct': [False]*3 if expected else None,
                   'error': str(error)}
        rows.append(row)
        print(source.name, row.get('candidate_order'), row['correct'], row.get('unresolved_orders', row.get('error')), flush=True)
    labelled = [r for r in rows if r['expected'] is not None]
    summary = {'note': 'Development and user-reviewed samples; current-image templates excluded. User reviewed proposed outputs, so these are not blind test results. Proposals and resolved results are separate.',
               'evaluation_mode': 'rescore_saved_inference_without_rerunning_matcher' if saved_results else 'fresh_inference',
               'correct_targets': sum(sum(r['correct']) for r in labelled), 'total_targets': len(labelled)*3,
               'correct_images': sum(all(r['correct']) for r in labelled), 'total_labelled_images': len(labelled),
               'resolved_targets': sum(len(r.get('resolved_orders', [])) for r in labelled),
               'incorrect_resolved_targets': sum(not r['correct'][order-1] for r in labelled for order in r.get('resolved_orders', [])),
               'unlabelled_images': [r['image'] for r in rows if r['expected'] is None], 'samples': rows}
    for group in ('development', 'user_reviewed'):
        subset = [r for r in labelled if r.get('validation_group') == group]
        summary[group] = {'correct_targets': sum(sum(r['correct']) for r in subset), 'total_targets': len(subset)*3}
    (output/'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    lines = ['# Contour-point matching evaluation', '', summary['note'], '',
             f"Evaluation mode: {summary['evaluation_mode']}.", '',
             f"Ordered target proposals: {summary['correct_targets']}/{summary['total_targets']}; complete images: {summary['correct_images']}/{len(labelled)}.",
             f"Resolved targets: {summary['resolved_targets']}; incorrect resolved targets: {summary['incorrect_resolved_targets']}.", '',
             '| Image | Candidate order | Correct proposals | Unresolved prompt orders |', '| --- | --- | --- | --- |']
    for r in rows:
        lines.append(f"| {r['image']} | {' -> '.join(r.get('candidate_order', []))} | {sum(r['correct']) if r['correct'] is not None else 'unlabelled'}/3 | {r.get('unresolved_orders', r.get('error'))} |")
    (output/'report.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print(f"Proposals {summary['correct_targets']}/{summary['total_targets']}; incorrect resolved {summary['incorrect_resolved_targets']}", flush=True)
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saved-results', action='store_true', help='Rescore saved outputs after label review; does not rerun inference.')
    args = parser.parse_args()
    summary = evaluate(saved_results=args.saved_results)
    raise SystemExit(0 if summary['correct_targets'] == summary['total_targets'] and not summary['incorrect_resolved_targets'] else 1)
