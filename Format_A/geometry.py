"""Square overlays and measurements; these do not establish detection confidence."""
import math

import cv2


def enclosing_square(box):
    x, y, width, height = box
    side = max(width, height)
    return [x - (side - width) // 2, y - (side - height) // 2, side, side]


def measure_alignment(piece, gap, anchor=None):
    if piece[2:] != gap[2:] or piece[2] != piece[3]:
        raise ValueError("Measurements require equal-sized square boxes")

    def corners(box, labels):
        x, y, w, h = box
        return dict(zip(labels, ([x, y], [x + w - 1, y],
                                 [x + w - 1, y + h - 1], [x, y + h - 1])))

    source = corners(piece, "ABCD")
    target = corners(gap, "1234")
    source_center = [piece[0] + (piece[2] - 1) / 2, piece[1] + (piece[3] - 1) / 2]
    target_center = [gap[0] + (gap[2] - 1) / 2, gap[1] + (gap[3] - 1) / 2]
    dx, dy = [b - a for a, b in zip(source_center, target_center)]
    pairs = []
    for letter, number in zip("ABCD", "1234"):
        a, b = source[letter], target[number]
        px, py = b[0] - a[0], b[1] - a[1]
        pairs.append({"from": letter, "to": number, "offset_px": [px, py],
                      "distance_px": round(math.hypot(px, py), 4)})
    result = {"corner_order": "top-left, top-right, bottom-right, bottom-left",
              "piece_corners": source, "gap_corners": target,
              "piece_center": source_center, "gap_center": target_center,
              "horizontal_distance_px": dx, "vertical_offset_px": dy,
              "center_distance_px": round(math.hypot(dx, dy), 4),
              "point_pairs": pairs,
              "geometry_consistent": all(p["offset_px"] == [dx, dy] for p in pairs),
              "note": "Equal boxes guarantee matching corner offsets; outline evidence determines detection confidence. Use horizontal distance for the slider, not diagonal distance."}
    if anchor is not None:
        ax, ay = anchor["center"]
        for name, points in (("piece", source), ("gap", target)):
            result["relative_" + name + "_corners"] = {label: [x - ax, y - ay] for label, (x, y) in points.items()}
    return result


def locate_slider(image, scene_box):
    """Locate one blue handle below the photograph, excluding the blue header."""
    x, y, w, h = scene_box
    top = y + h
    bottom = min(image.shape[0], top + round(w * .22))
    missing = {"status": "not_found", "zero_center": None}
    if top >= bottom:
        return missing
    hsv = cv2.cvtColor(image[top:bottom, x:x + w], cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, (98, 160, 160), (122, 255, 255))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    choices = []
    for contour in contours:
        bx, by, bw, bh = cv2.boundingRect(contour)
        if not (max(14, w * .07) <= bw <= w * .4 and 8 <= bh <= w * .2 and 1.1 <= bw / bh <= 3.5):
            continue
        if cv2.contourArea(contour) / (bw * bh) < .55:
            continue
        choices.append([x + bx, top + by, bw, bh])
    if len(choices) != 1:
        return {**missing, "status": "ambiguous" if choices else "not_found"}
    bx, by, bw, bh = choices[0]
    return {"status": "located", "handle_box": choices[0],
            "zero_center": [bx + (bw - 1) / 2, by + (bh - 1) / 2],
            "zero_displacement_px": 0,
            "note": "Handle center in this screenshot is zero. Capture before dragging; calibrate screen movement per image pixel separately."}
