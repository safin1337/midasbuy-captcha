"""Drag once by a manually measured horizontal distance, using the hovered handle."""
import argparse
import json
import time
from pathlib import Path

from drag import execute
from desktop import monitor_rectangles


def positive_integer(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("Distance must be positive")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("distance", nargs="?", type=positive_integer, help="Current puzzle's measured A-to-1 horizontal distance in screen pixels")
    parser.add_argument("--preview", action="store_true", help="Print the movement without dragging")
    args = parser.parse_args()
    if args.distance is None:
        try:
            args.distance = positive_integer(input("Measured A-to-1 horizontal distance in px: "))
        except (ValueError, argparse.ArgumentTypeError, EOFError) as exc:
            parser.exit(2, f"Invalid distance: {exc}\n")
    if args.preview:
        print(f"Preview only: move {args.distance} screen pixels right; vertical movement 0. Scale 1:1.")
        return
    try:
        import pyautogui as pointer
    except ImportError:
        parser.exit(2, "Install the mouse dependency first: .\\.venv\\Scripts\\python.exe -m pip install pyautogui\n")
    print(f"One drag: {args.distance} px right, at 1:1 scale.")
    print("Hover over the CENTER of the blue handle and leave the pointer there.")
    print("Starting in 5 seconds. Ctrl+C cancels; a PRIMARY screen corner triggers the mouse failsafe.")
    for seconds in range(5, 0, -1):
        print(f"{seconds}...", flush=True)
        time.sleep(1)
    x, y = pointer.position()
    folder = Path(__file__).parent / "output" / "live_test"
    folder.mkdir(parents=True, exist_ok=True)
    motion = {"start_screen_px": [x, y], "end_screen_px": [x + args.distance, y]}
    report = {"status": "starting", "motion": motion, "monitors": monitor_rectangles(pointer)}

    def save_report():
        (folder / "latest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    def capture(name):
        try:
            from PIL import ImageGrab
            ImageGrab.grab(all_screens=True).save(folder / name)
        except OSError as exc:
            report.setdefault("capture_errors", []).append(str(exc))

    print(f"Start: ({x}, {y}); target: ({x + args.distance}, {y})", flush=True)
    capture("before.png")
    save_report()
    try:
        execute(motion, pointer, monitors=report["monitors"])
        report["status"] = "drag_released"
    except Exception as exc:
        report.update(status="error", error=f"{type(exc).__name__}: {exc}")
        print(f"Drag failed: {report['error']}")
        return 1
    finally:
        report["actual_pointer_screen_px"] = list(pointer.position())
        time.sleep(.5)
        capture("after.png")
        save_report()
        print(f"Diagnostic report: {folder / 'latest.json'}")
    print("Drag released. Check the puzzle's actual result; pointer movement does not prove verification.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
