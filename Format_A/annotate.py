"""Render labeled diagnostic boxes without shifting screenshot coordinates."""
import cv2
import numpy as np


def render_annotation(source, result):
    width = max(520, source.shape[1])
    output = np.full((source.shape[0] + 220, width, 3), (25, 25, 25), np.uint8)
    output[:source.shape[0], :source.shape[1]] = source
    font = cv2.FONT_HERSHEY_SIMPLEX

    def tag(text, point, color, right=False, below=False, marker=True):
        px, py = [round(v) for v in point]
        (tw, th), baseline = cv2.getTextSize(text, font, .5, 1)
        x = px + 6 if right else px - tw - 6
        y = py + th + 9 if below else py - 8
        x = min(max(4, x), width - tw - 5)
        y = min(max(th + 4, y), source.shape[0] - baseline - 5)
        cv2.rectangle(output, (x - 3, y - th - 3), (x + tw + 3, y + baseline + 3), (20, 20, 20), -1)
        cv2.putText(output, text, (x, y), font, .5, (255, 255, 255), 1, cv2.LINE_AA)
        if marker:
            cv2.circle(output, (px, py), 3, (15, 15, 15), -1)
            cv2.circle(output, (px, py), 2, color, -1)

    if result["anchor"] is not None:
        cv2.drawMarker(output, tuple(result["anchor"]["center"]), (255, 0, 255), cv2.MARKER_CROSS, 14, 1)
    alignment = result.get("alignment")
    if alignment:
        for name, color in (("piece", (80, 240, 80)), ("gap", (0, 180, 255))):
            x, y, w, h = result[name + "_box"]
            cv2.rectangle(output, (x, y), (x + w - 1, y + h - 1), (20, 20, 20), 4)
            cv2.rectangle(output, (x, y), (x + w - 1, y + h - 1), color, 2)
            for i, (label, point) in enumerate(alignment[name + "_corners"].items()):
                tag(label, point, color, right=i in (1, 2), below=i in (2, 3))
        p, g = [tuple(round(v) for v in alignment[key + "_center"]) for key in ("piece", "gap")]
        cv2.arrowedLine(output, p, g, (20, 20, 20), 4)
        cv2.arrowedLine(output, p, g, (255, 220, 80), 2, tipLength=.08)
        z = alignment["horizontal_distance_px"]
        tag(f"Z = {z:g} px", ((p[0] + g[0]) / 2, min(p[1], g[1]) - 55), (255, 220, 80), right=True, marker=False)
    slider = result["slider"]
    if slider["status"] == "located":
        tag("0 px", slider["zero_center"], (255, 255, 255), right=True, below=True)

    lines = [f"Puzzle alignment | {result['status'].upper()}"]
    if alignment:
        z, dy = alignment["horizontal_distance_px"], alignment["vertical_offset_px"]
        lines.extend(["Piece: A B C D    Gap: 1 2 3 4 (clockwise)",
                      f"Horizontal Z: {z:g} image px    Vertical offset: {dy:g} px",
                      "Corner pairs: " + " | ".join(f"{p['from']}-{p['to']}: {p['offset_px'][0]} px" for p in alignment["point_pairs"]),
                      f"Outline score: {result['outline_score']:.4f} (not a probability)" if result.get('outline_score') is not None else "Manual centers: selected by the user, not auto-detected."])
    else:
        lines.append(result.get("reason", "No matching outline found"))
    lines.extend(["Review the outlines; equal boxes alone do not verify a match.",
                  "Slider movement = Z x measured movement scale.",
                  "Magenta cross: close-X origin. Blue handle center: zero."
                  if slider["status"] == "located" else "Blue slider handle not located; enter its screen position."])
    for i, text in enumerate(lines):
        cv2.putText(output, text, (12, source.shape[0] + 25 + i * 25), font, .43,
                    (235, 235, 235), 1, cv2.LINE_AA)
    return output
