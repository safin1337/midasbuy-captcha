"""Desktop bounds include every attached monitor, including negative coordinates."""
import sys


def monitor_rectangles(pointer):
    if sys.platform != "win32":
        width, height = pointer.size()
        return [[0, 0, width, height]]
    import ctypes
    from ctypes import wintypes

    rectangles = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR,
                                      wintypes.HDC, ctypes.POINTER(wintypes.RECT),
                                      wintypes.LPARAM)

    @callback_type
    def collect(monitor, dc, rect, data):
        bounds = rect.contents
        rectangles.append([bounds.left, bounds.top, bounds.right, bounds.bottom])
        return True

    if not ctypes.windll.user32.EnumDisplayMonitors(None, None, collect, 0):
        raise OSError("Cannot enumerate desktop monitors")
    return rectangles


def on_desktop(point, rectangles):
    x, y = point
    return any(left <= x < right and top <= y < bottom
               for left, top, right, bottom in rectangles)
