"""Test the actual mouse against a disposable local window, never a website."""
import argparse
import ctypes
import json
from pathlib import Path
import threading
import tkinter as tk

from desktop import monitor_rectangles, on_desktop
from drag import execute


def main():
    import pyautogui as pointer
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--monitor", type=int, default=0, help="Monitor index from the Windows enumeration")
    args = parser.parse_args()
    monitors = monitor_rectangles(pointer)
    if not 0 <= args.monitor < len(monitors):
        parser.error("Monitor index does not exist")
    left, top, right, bottom = monitors[args.monitor]
    root = tk.Tk()
    root.title("Local mouse drag diagnostic")
    root.geometry("460x180")
    canvas = tk.Canvas(root, width=460, height=180, background="white")
    canvas.pack()
    canvas.create_text(230, 25, text="Local test only: move the rectangle 135 px right")
    item = canvas.create_rectangle(50, 65, 110, 105, fill="#147dd9")
    events = []
    state = {}

    def down(event):
        state["last"] = event.x
        events.append("down")

    def move(event):
        if "last" in state:
            canvas.move(item, event.x - state["last"], 0)
            state["last"] = event.x

    def up(event):
        events.append("up")
        state.pop("last", None)

    canvas.tag_bind(item, "<ButtonPress-1>", down)
    canvas.bind("<B1-Motion>", move)
    canvas.bind("<ButtonRelease-1>", up)
    root.update()
    from ctypes import wintypes
    user = ctypes.windll.user32
    user.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user.GetAncestor.restype = wintypes.HWND
    user.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                  ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user.SetWindowPos.restype = wintypes.BOOL
    wrapper = user.GetAncestor(root.winfo_id(), 2)
    if not user.SetWindowPos(wrapper, wintypes.HWND(-1), left + 100, top + 200, 0, 0, 1):
        root.destroy()
        raise OSError("Could not position diagnostic window")
    root.update()
    start = [canvas.winfo_rootx() + 80, canvas.winfo_rooty() + 85]
    if not on_desktop(start, [monitors[args.monitor]]):
        root.destroy()
        raise ValueError(f"Diagnostic window is not on the requested monitor: {start}")
    original = pointer.position()
    report = {"monitor": monitors[args.monitor], "start_screen_px": start, "expected_dx": 135}
    finished = threading.Event()

    def worker():
        try:
            execute({"start_screen_px": start, "end_screen_px": [start[0] + 135, start[1]]}, pointer)
            report["pointer_after"] = list(pointer.position())
        except Exception as exc:
            report["error"] = f"{type(exc).__name__}: {exc}"
        finally:
            finished.set()

    def poll():
        if not finished.is_set():
            root.after(100, poll)
            return
        report["events"] = events
        report["actual_rectangle_dx"] = canvas.coords(item)[0] - 50
        report["passed"] = report["actual_rectangle_dx"] == 135 and events == ["down", "up"] and "error" not in report
        root.destroy()

    root.after(700, lambda: threading.Thread(target=worker, daemon=True).start())
    root.after(800, poll)
    root.after(10000, root.destroy)
    root.mainloop()
    pointer.moveTo(*original, duration=.2)
    folder = Path(__file__).parent / "output" / "live_diagnostic"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"monitor-{args.monitor}-drag.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
