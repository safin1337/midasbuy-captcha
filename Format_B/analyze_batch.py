"""Analyze numbered raw samples and retain complete per-image evidence."""
import argparse
import hashlib
import json
import time
from pathlib import Path
import cv2
from dot_matcher import run

ROOT = Path(__file__).resolve().parent


def analyze(start, end, saved_results=False):
    output = ROOT/'diagnostics'/'dot_evaluation'
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for number in range(start, end+1):
        source = ROOT/'raw_data'/f'input{number}.png'
        destination = output/source.stem
        started = time.monotonic()
        print(f'START {source.name}', flush=True)
        try:
            if saved_results:
                result=json.loads((destination/'result.json').read_text(encoding='utf-8'))
                if result['library']['excluded_current_image_hash'] != hashlib.sha256(source.read_bytes()).hexdigest():
                    raise ValueError('Saved analysis belongs to a different raw image.')
            else:
                result = run(source, destination)
            row = {'image': source.name, 'status': result['status'],
                   'candidate_count': len(result['candidates']),
                   'candidate_order': result['candidate_order'],
                   'confident_positions': [m['order'] for m in result['resolved_matches']],
                   'review_positions': result['unresolved_orders'],
                   'matches': [{key: m[key] for key in ('order', 'candidate', 'center', 'match_score', 'decision', 'review_reasons')}
                               for m in result['matches']]}
        except (ValueError, OSError, cv2.error) as error:
            destination.mkdir(parents=True, exist_ok=True)
            row = {'image': source.name, 'status': 'not_detected', 'error': str(error)}
            (destination/'error.json').write_text(json.dumps(row, indent=2), encoding='utf-8')
        row['elapsed_seconds'] = round(time.monotonic()-started, 2)
        rows.append(row)
        print(json.dumps(row), flush=True)
    summary = {'note': 'Offline matcher proposals. Confidence is uncalibrated and does not establish correctness on new samples.',
               'evaluation_mode': 'summarize_saved_results' if saved_results else 'fresh_inference',
               'start': start, 'end': end, 'samples': rows,
               'processed_images': sum(r['status'] != 'not_detected' for r in rows),
               'failed_images': sum(r['status'] == 'not_detected' for r in rows),
               'review_matches': sum(len(r.get('review_positions', [])) for r in rows)}
    stem = f'batch_{start}_{end}'
    (output/f'{stem}.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    lines = [f'# Sample analysis: input{start} to input{end}', '', summary['note'], '',
             '| Sample | Candidate order | Confident positions | Review positions |', '| --- | --- | --- | --- |']
    for r in rows:
        image = Path(r['image']).stem
        lines.append(f"| [{r['image']}]({image}/candidates.png) | {' -> '.join(r.get('candidate_order', [])) or r.get('error')} | {r.get('confident_positions', [])} | {r.get('review_positions', [])} |")
    lines += ['', 'Each successful sample folder contains the numbered screenshot, five-candidate preview, dot gallery, selected alignments, individual masks and point previews, and result.json.']
    (output/f'{stem}.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print(f"COMPLETE: {summary['processed_images']} analyzed; {summary['failed_images']} failed; {summary['review_matches']} matches flagged for review.", flush=True)
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', type=int, default=14)
    parser.add_argument('--end', type=int, default=25)
    parser.add_argument('--saved-results', action='store_true', help='Refresh the report from existing analysis without rerunning inference.')
    args = parser.parse_args()
    if args.start < 1 or args.end < args.start:
        parser.error('Use a positive start and an end greater than or equal to start.')
    summary = analyze(args.start, args.end, saved_results=args.saved_results)
    raise SystemExit(1 if summary['failed_images'] else 0)
