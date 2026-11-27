"""Preview a calibrated drag, with an explicit optional mouse execution switch."""
import argparse
import json
import math
import time
from pathlib import Path

from desktop import monitor_rectangles, on_desktop


def plan(result, handle, scale):
    if result.get("status") != "detected":
        raise ValueError("Detection must be reviewed and have status 'detected'")
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Scale must be a finite positive number")
    dx, dy = result["offset_image_px"]
    alignment = result.get("alignment")
    if alignment is not None:
        if not alignment["geometry_consistent"] or [alignment["horizontal_distance_px"], alignment["vertical_offset_px"]] != [dx, dy]:
            raise ValueError("Box measurements and detector offset disagree")
    if not math.isfinite(dx) or not math.isfinite(dy) or dx <= 0 or abs(dy) > 4:
        raise ValueError("Expected a positive horizontal offset with at most 4 pixels vertical mismatch")
    return {"start_screen_px": list(handle), "end_screen_px": [handle[0] + round(dx * scale), handle[1]],
            "zero_displacement_px": 0, "distance_image_px": dx, "movement_scale": scale,
            "distance_screen_px": round(dx * scale)}


def execute(motion, pointer, monitors=None):
    start, end = motion["start_screen_px"], motion["end_screen_px"]
    rectangles = monitor_rectangles(pointer) if monitors is None else monitors
    if not on_desktop(start, rectangles) or not on_desktop(end, rectangles):
        raise ValueError("Drag coordinates are outside the attached monitors")
    pointer.moveTo(*start, duration=.2)
    try:
        pointer.mouseDown()
        pointer.moveTo(*end, duration=1)
    finally:
        pointer.mouseUp()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path)
    parser.add_argument("--handle", type=int, nargs=2, required=True, metavar=("SCREEN_X", "SCREEN_Y"))
    parser.add_argument("--scale", type=float, required=True, help="Screen slider movement per image pixel of piece movement; measure in your practice app")
    parser.add_argument("--execute", action="store_true", help="Perform one desktop drag after a 5 second countdown")
    args = parser.parse_args()
    try:
        motion = plan(json.loads(args.result.read_text(encoding="utf-8")), args.handle, args.scale)
        print(json.dumps(motion, indent=2))
        if args.execute:
            import pyautogui
            print("Dragging in 5 seconds. Move the pointer to a screen corner to abort.")
            time.sleep(5)
            execute(motion, pyautogui)
    except (OSError, ValueError, KeyError, ImportError) as exc:
        parser.exit(2, f"Cannot drag: {exc}\n")


if __name__ == "__main__":
    main()
