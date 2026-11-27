"""Offline slider-puzzle experiment: dark gap segmentation and outline matching."""
import argparse
import importlib.util
import json
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

from annotate import render_annotation
from geometry import enclosing_square, locate_slider, measure_alignment
from guided import group_candidates, piece_from_dom, sprite_mask, sprite_candidates


@lru_cache(maxsize=1)
def anchor_locator():
    # Reuse Format B's close-X detection without changing its code or regions.
    path = Path(__file__).resolve().parents[1] / "Format_B" / "detect_symbols.py"
    spec = importlib.util.spec_from_file_location("format_b_anchor", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.locate_regions


def detect(image, roi=None, guidance=None):
    if image is None or image.ndim != 3:
        raise ValueError("Expected a color image")
    height, width = image.shape[:2]
    anchor = None
    try:
        _, scene_box, anchor = anchor_locator()(image, require_references=False)
    except ValueError:
        pass  # A photograph-only crop can still be analyzed without an anchor.
    if roi is None and anchor is not None:
        x, y, w, _ = scene_box
        roi = (x, y, w, round(247 * anchor["scale"]))
    rx, ry, rw, rh = roi or (0, 0, width, height)
    if min(rx, ry) < 0 or min(rw, rh) <= 0 or rx + rw > width or ry + rh > height:
        raise ValueError("Image region is outside the image")
    guidance = guidance or {}
    slider = locate_slider(image, [rx, ry, rw, rh])
    hint = piece_from_dom(guidance.get('dom'), slider, [rx, ry, rw, rh])
    sprite = sprite_mask(guidance.get('sprite_png'), hint) if hint else None

    def coordinates(result):
        result["anchor"] = anchor
        result["scene_box"] = [rx, ry, rw, rh]
        result["slider"] = locate_slider(image, result["scene_box"])
        result['piece_dom_box'] = hint
        result['evidence'] = {'dom_guided':hint is not None, 'sprite_silhouette':sprite is not None,
                              'sprite_status':guidance.get('sprite_status','not_requested')}
        if "piece_box" in result:
            result["alignment"] = measure_alignment(result["piece_box"], result["gap_box"], anchor)
        result["coordinate_system"] = "Boxes use screenshot pixels; relative boxes use the close X center as (0,0). Positive x is right; positive y is down."
        if anchor is not None:
            ax, ay = anchor["center"]
            for item in [result, *result.get("candidates", [])]:
                for key in ("piece_box", "gap_box"):
                    if key in item:
                        x, y, w, h = item[key]
                        item["relative_" + key] = [x - ax, y - ay, w, h]
            result["relative_scene_box"] = [rx - ax, ry - ay, rw, rh]
        return result
    if guidance.get('manual_points') is not None:
        values=guidance['manual_points']
        if not isinstance(values,list) or len(values)!=4 or not all(isinstance(v,(int,float)) and np.isfinite(v) for v in values):
            raise ValueError('Select both piece and gap center points')
        px,py,gx,gy=values
        if not (rx<=px<rx+rw and rx<=gx<rx+rw and ry<=py<ry+rh and ry<=gy<ry+rh and gx>px and abs(gy-py)<=4):
            raise ValueError('Manual points must be inside the photograph on the same row, with gap to the right')
        side=round(float(guidance.get('manual_box_size',min(hint[2:])*.75 if hint else 50)))
        if not 14<=side<=rw*.3:
            raise ValueError('Invalid manual box size')
        source=[round(px-(side-1)/2),round(py-(side-1)/2),side,side]
        dx,dy=round(gx-px),round(gy-py)
        target=[source[0]+dx,source[1]+dy,side,side]
        return coordinates({'status':'manual','selection_source':'user_points','piece_box':source,'gap_box':target,
                            'manual_points':values,'offset_image_px':[dx,dy],'outline_score':None,
                            'candidates':[],'review_reasons':[],
                            'note':'User-selected centers; box size is a visual guide, not inferred confidence.'})
    scene = image[ry:ry + rh, rx:rx + rw]
    gray = cv2.cvtColor(scene, cv2.COLOR_BGR2GRAY)
    saturation = cv2.cvtColor(scene, cv2.COLOR_BGR2HSV)[:, :, 1]
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), .8), 45, 120)
    distance = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 3)
    # An outline on either the white piece or dark gap is an edge. Interior
    # photograph details are deliberately excluded from the template.
    candidates = []

    def segmentation_masks():
        for threshold in (65, 85, 105, 125):
            yield "dark_neutral", threshold, ((gray < threshold) & (saturation < 100)).astype(np.uint8) * 255
        # Translucent gaps retain the underlying photograph's color. Only use
        # this broader search when the original pass produced no candidate, or
        # when DOM guidance constrains the real piece. Keep every outline gate.
        if not candidates or hint is not None:
            for threshold in (35, 45, 55, 65):
                yield "dark_color_fallback", threshold, (gray < threshold).astype(np.uint8) * 255

    for method, threshold, mask in segmentation_masks():
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = cv2.contourArea(contour)
            if not (max(14, rw * .04) <= w <= rw * .25 and 14 <= h <= rh * .4):
                continue
            if not (.7 <= w / h <= 1.4 and .5 <= area / (w * h) <= .94):
                continue
            if x < w + 8 or y < 2 or y + h + 2 >= rh:
                continue
            if hint and not (.4*hint[2] <= w <= hint[2]+4 and .4*hint[3] <= h <= hint[3]+4
                             and hint[1]-4 <= ry+y <= hint[1]+hint[3]-h+4):
                continue
            silhouette = np.zeros((h, w), np.uint8)
            local = contour - np.array([[[x, y]]])
            cv2.drawContours(silhouette, [local], -1, 255, cv2.FILLED)
            boundary = np.zeros_like(silhouette)
            cv2.drawContours(boundary, [local], -1, 1, 1)
            template = boundary.astype(np.float32)
            proximity = np.exp(-distance / max(1.5, w * .04)).astype(np.float32)
            # Piece and gap share a row; allow a small vertical tolerance.
            y0, y1 = max(0, y - 3), min(rh, y + h + 3)
            x0 = 0
            x1 = x-5
            if hint:
                x0=max(0,hint[0]-rx-2)
                x1=min(x1,hint[0]-rx+hint[2]+2)
                y0=max(y0,hint[1]-ry-2)
                y1=min(y1,hint[1]-ry+hint[3]+2)
            search = proximity[y0:y1, x0:x1]
            if search.shape[1] < w or search.shape[0] < h:
                continue
            response = cv2.matchTemplate(search, template, cv2.TM_CCORR) / template.sum()
            _, score, _, (sx, sy) = cv2.minMaxLoc(response)
            sx += x0
            piece_box = [rx + sx, ry + y0 + sy, w, h]
            gap_box = [rx + x, ry + y, w, h]
            candidates.append({
                "segmentation_method": method,
                "segmentation_threshold": threshold,
                "matched_piece_box": piece_box,
                "matched_gap_box": gap_box,
                "piece_box": enclosing_square(piece_box),
                "gap_box": enclosing_square(gap_box),
                "offset_image_px": [x - sx, y - (y0 + sy)],
                "outline_score": round(float(score), 4),
            })
    if sprite:
        for candidate in sprite_candidates(gray,*sprite,(rx,ry)):
            candidate['piece_box']=enclosing_square(candidate['matched_piece_box'])
            candidate['gap_box']=enclosing_square(candidate['matched_gap_box'])
            candidates.append(candidate)
    # Confidence compares distinct physical locations, not threshold variants
    # of the same gap. Disagreeing offsets within a group still require review.
    unique = group_candidates(candidates, prefer_sprite=bool(sprite))
    if not unique:
        return coordinates({"status": "no_match", "reason": "No suitable dark puzzle gap found", "candidates": [],
                            "segmentation_methods_tried": ["dark_neutral", "dark_color_fallback"]})
    best = unique[0]
    margin = best["outline_score"] - unique[1]["outline_score"] if len(unique) > 1 else None
    reasons=[]
    if best['outline_score'] < .72: reasons.append('weak_outline')
    if margin is not None and margin < .04: reasons.append('competing_gap_locations')
    if best['offset_spread_px'] > 4: reasons.append('inconsistent_piece_alignment')
    if best.get('gap_median_luminance',0)>150: reasons.append('weak_gap_darkness')
    status = 'uncertain' if reasons else 'detected'
    return coordinates({"status": status, **best, "score_margin": None if margin is None else round(margin, 4),
            "candidates": unique[:5], 'review_reasons':reasons,
            "note": "Outline score is not a calibrated probability. Inspect the annotation."})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("--roi", type=int, nargs=4, metavar=("X", "Y", "WIDTH", "HEIGHT"), help="Photograph region, excluding dialog controls")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "output")
    parser.add_argument('--guidance',type=Path,help='Local JSON with DOM geometry and optional sprite pixels')
    args = parser.parse_args()
    try:
        data = np.fromfile(args.image, dtype=np.uint8)
        source = cv2.imdecode(data, cv2.IMREAD_COLOR)
        result = detect(source, args.roi, json.loads(args.guidance.read_text(encoding='utf-8')) if args.guidance else None)
    except (OSError, ValueError, cv2.error) as exc:
        parser.exit(2, f"Cannot analyze image: {exc}\n")
    args.output.mkdir(parents=True, exist_ok=True)
    annotated = render_annotation(source, result)
    cv2.imencode(".png", annotated)[1].tofile(args.output / "annotated.png")
    (args.output / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "detected" else 1


if __name__ == "__main__":
    raise SystemExit(main())
