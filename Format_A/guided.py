"""DOM geometry and optional origin-clean sprite evidence for slider detection."""
import base64
import math
import struct

import cv2
import numpy as np


def piece_from_dom(dom, slider, scene):
    if not dom:
        return None
    if slider.get('status') != 'located':
        raise ValueError('DOM guidance requires a visible slider handle')
    piece, handle = dom['piece'], dom['handle']
    values = [r[k] for r in (piece, handle) for k in ('x', 'y', 'width', 'height')]
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in values):
        raise ValueError('Invalid DOM coordinates')
    if min(piece['width'], piece['height'], handle['width'], handle['height']) <= 0:
        raise ValueError('Invalid DOM dimensions')
    scale = slider['handle_box'][2] / handle['width']
    box = [round(slider['handle_box'][0] + (piece['x'] - handle['x']) * scale),
           round(slider['handle_box'][1] + (piece['y'] - handle['y']) * scale),
           round(piece['width'] * scale), round(piece['height'] * scale)]
    x, y, w, h = box
    sx, sy, sw, sh = scene
    if min(w, h) < 14 or max(w, h) > sw * .4 or x < sx-3 or y < sy-3 or x+w > sx+sw+3 or y+h > sy+sh+3:
        raise ValueError('DOM piece does not map inside the photograph')
    return box


def sprite_mask(encoded, piece_box):
    if not encoded or len(encoded) > 400000:
        return None
    try:
        data = base64.b64decode(encoded, validate=True)
        if len(data)<24 or data[:8]!=b'\x89PNG\r\n\x1a\n':
            return None
        width,height=struct.unpack('>II',data[16:24])
        if min(width,height)<1 or max(width,height)>512:
            return None
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
        if image is None or image.ndim != 3 or image.shape[2] != 4 or max(image.shape[:2]) > 512:
            return None
        mask = cv2.resize(image[:,:,3], tuple(piece_box[2:]), interpolation=cv2.INTER_NEAREST)
        mask = (mask >= 96).astype(np.uint8)*255
        fraction = np.mean(mask > 0)
        if not .15 <= fraction <= .95:
            return None
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
        if n < 2:
            return None
        biggest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = (labels == biggest).astype(np.uint8)*255
        x, y, w, h = cv2.boundingRect(mask)
        if min(w, h) < 14 or not .7 <= w/h <= 1.4:
            return None
        return mask[y:y+h, x:x+w], [piece_box[0]+x, piece_box[1]+y, w, h]
    except (ValueError, cv2.error):
        return None


def sprite_candidates(gray, mask, piece, scene_origin):
    """Match only the external silhouette on the same row to the right."""
    rx, ry = scene_origin
    px, py, w, h = piece
    boundary = np.zeros_like(mask)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(boundary, contours, -1, 1, 1)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), .6), 35, 90)
    distance = cv2.distanceTransform(255-edges, cv2.DIST_L2, 3)
    proximity = np.exp(-distance/max(1.5, w*.035)).astype(np.float32)
    x0 = max(0, px-rx+w//2)
    y0, y1 = max(0, py-ry-3), min(gray.shape[0], py-ry+h+3)
    search = proximity[y0:y1, x0:]
    if search.shape[0] < h or search.shape[1] < w:
        return []
    response = cv2.matchTemplate(search, boundary.astype(np.float32), cv2.TM_CCORR)/max(1, boundary.sum())
    results=[]
    for _ in range(5):
        _, score, _, (x, y) = cv2.minMaxLoc(response)
        if score < .5:
            break
        gx, gy = rx+x0+x, ry+y0+y
        # Dark gap evidence is independent of the silhouette edge score.
        patch = gray[y0+y:y0+y+h, x0+x:x0+x+w]
        inside = patch[mask > 0]
        darkness = float(np.median(inside)) if inside.size else 255
        results.append({'matched_piece_box':list(piece),'matched_gap_box':[gx,gy,w,h],
                        'offset_image_px':[gx-px,gy-py], 'outline_score':round(float(score),4),
                        'segmentation_method':'sprite_silhouette','gap_median_luminance':round(darkness,2)})
        response[:,max(0,x-w//2):min(response.shape[1],x+w//2+1)] = -1
    return results


def overlap(a,b):
    x=max(a[0],b[0]);y=max(a[1],b[1])
    area=max(0,min(a[0]+a[2],b[0]+b[2])-x)*max(0,min(a[1]+a[3],b[1]+b[3])-y)
    return area/max(1,a[2]*a[3]+b[2]*b[3]-area)


def group_candidates(candidates, prefer_sprite=False):
    groups=[]
    for candidate in sorted(candidates,key=lambda c:c['outline_score'],reverse=True):
        box=candidate['gap_box']
        group=next((g for g in groups if overlap(box,g[0]['gap_box'])>=.55),None)
        if group is None:
            groups.append([candidate])
        else:
            group.append(candidate)
    leaders=[]
    for group in groups:
        sprite=[c for c in group if c.get('segmentation_method')=='sprite_silhouette'
                and c['outline_score']>=.78 and c.get('gap_median_luminance',255)<=150]
        representative=max(sprite,key=lambda c:c['outline_score']) if prefer_sprite and sprite else group[0]
        leader=dict(representative)
        consistent=[c for c in group if abs(c['offset_image_px'][0]-representative['offset_image_px'][0])<=4] if prefer_sprite and sprite else group
        offsets=[c['offset_image_px'][0] for c in consistent]
        leader['hypothesis_count']=len(group)
        leader['sprite_supported']=bool(prefer_sprite and sprite)
        leader['geometry_rejected_hypotheses']=len(group)-len(consistent)
        leader['offset_spread_px']=max(offsets)-min(offsets)
        leader['hypotheses']=[{'offset_image_px':c['offset_image_px'],'outline_score':c['outline_score'],
                              'piece_box':c['piece_box'],'gap_box':c['gap_box'],
                              'method':c.get('segmentation_method')} for c in group[:12]]
        leaders.append(leader)
    return sorted(leaders,key=lambda c:c['outline_score'],reverse=True)
