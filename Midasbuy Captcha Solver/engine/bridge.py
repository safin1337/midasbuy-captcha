"""Authenticated loopback image engine for the local Chrome extension."""
import argparse
import base64
import binascii
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import secrets
import struct
import subprocess
import sys
import threading
import uuid
from trials import TrialStore

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
MAX_BODY = 24 * 1024 * 1024


def decode_png(encoded):
    if not isinstance(encoded, str) or len(encoded) > MAX_BODY:
        raise ValueError("Expected a PNG screenshot")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid screenshot encoding") from exc
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("Only PNG screenshots are accepted")
    width, height = struct.unpack(">II", data[16:24])
    if min(width, height) < 100 or max(width, height) > 8192 or width * height > 12_000_000:
        raise ValueError("Screenshot dimensions are outside supported limits")
    return data, width, height


def analyze(payload):
    kind = payload.get("format")
    if kind not in ("A", "B"):
        raise ValueError("Choose Format A or B")
    data, width, height = decode_png(payload.get("png"))
    job = uuid.uuid4().hex
    folder = APP / "output" / "solver_jobs" / job
    folder.mkdir(parents=True)
    image = folder / "input.png"
    image.write_bytes(data)
    script = ROOT / ("Format_A/detect.py" if kind == "A" else "Format_B/dot_matcher.py")
    command = [sys.executable, str(script), str(image), '--output', str(folder)]
    if kind == 'A' and payload.get('guidance'):
        guidance=payload['guidance']
        if not isinstance(guidance,dict) or len(json.dumps(guidance))>500000:
            raise ValueError('Invalid piece guidance')
        (folder/'guidance.json').write_text(json.dumps(guidance),encoding='utf-8')
        command += ['--guidance',str(folder/'guidance.json')]
    completed = subprocess.run(command,
                               cwd=ROOT, capture_output=True, timeout=90)
    result_path = folder / "result.json"
    if completed.returncode not in (0, 1) or not result_path.exists():
        raise ValueError("Detector could not locate this format. Include the complete dialog and close X.")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    if kind == "B":
        matches = [{key: item.get(key) for key in ("order", "candidate", "center", "box", "decision", "review_reasons", "match_score")}
                   for item in result.get("matches", [])]
        matches.sort(key=lambda item: item["order"])
        confirm = confirm_button(data, result.get("scene_box"))
        proposed = len(matches) == 3 and len({item["candidate"] for item in matches}) == 3 and confirm is not None
        resolved = proposed and not result.get("unresolved_orders") and all(item["decision"] == "proposed" for item in matches)
        answer = {"status": "detected" if resolved else "uncertain", "matches": matches,
                  "has_proposal": proposed, "anchor": result.get("anchor"),
                  "localization_status": result.get("physical_detection", {}).get("status"), "confirm_center": confirm}
    else:
        answer = {key: result.get(key) for key in ("status", "piece_box", "gap_box", "offset_image_px", "outline_score", "anchor", "alignment", "slider",'piece_dom_box','evidence','review_reasons','score_margin')}
        answer["has_proposal"] = bool(result.get("piece_box") and result.get("gap_box"))
    preview = folder / "annotated.png"
    return {"job": job, "format": kind, "width": width, "height": height, **answer,
            'source_image':base64.b64encode(data).decode() if kind=='A' else None,
            "preview": base64.b64encode(preview.read_bytes()).decode() if preview.exists() else None}


def manual_analysis(payload, jobs_root=None):
    jobs_root=jobs_root or APP/'output'/'solver_jobs'
    job=payload.get('job','')
    if not isinstance(job,str) or re.fullmatch('[a-f0-9]{32}',job) is None:
        raise ValueError('Invalid source analysis')
    folder=jobs_root/job
    source=json.loads((folder/'result.json').read_text(encoding='utf-8'))
    if 'slider' not in source:
        raise ValueError('Manual points are only supported for sliders')
    guidance=json.loads((folder/'guidance.json').read_text(encoding='utf-8')) if (folder/'guidance.json').exists() else {}
    guidance.update(manual_points=payload.get('points'),manual_box_size=(source.get('piece_box') or [0,0,50,50])[2])
    response=analyze({'format':'A','png':base64.b64encode((folder/'input.png').read_bytes()).decode(),'guidance':guidance})
    # Keep the original job immutable. The new job retains correction provenance.
    corrected=APP/'output'/'solver_jobs'/response['job']
    (corrected/'manual-source.json').write_text(json.dumps({'source_job':job,'points':payload['points']}),encoding='utf-8')
    return response


def confirm_button(data, scene):
    """Find one blue confirmation control on the right of the dialog footer."""
    import cv2
    import numpy as np
    if not scene:
        return None
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    x, y, w, h = scene
    top = y + h
    if top >= image.shape[0]:
        return None
    left = x + round(w * .55)
    mask = cv2.inRange(cv2.cvtColor(image[top:, left:x + w], cv2.COLOR_BGR2HSV),
                       (95, 140, 130), (130, 255, 255))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in contours]
    boxes = [(bx, by, bw, bh) for bx, by, bw, bh in boxes
             if w * .08 <= bw <= w * .4 and w * .04 <= bh <= w * .2 and 1 <= bw / bh <= 4]
    if len(boxes) != 1:
        return None
    bx, by, bw, bh = boxes[0]
    return [left + bx + (bw - 1) / 2, top + by + (bh - 1) / 2]


class EngineServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, code=None, analyzer=analyze, manualizer=manual_analysis):
        super().__init__(address, Handler)
        self.code = code or secrets.token_urlsafe(18)
        self.analyzer = analyzer
        self.manualizer = manualizer
        self.job_lock = threading.Lock()
        self.trials = {kind: TrialStore(APP / f"Format_{kind}" / "trial", APP / "output" / "solver_jobs", kind)
                       for kind in ("A", "B")}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log screenshot payloads or pairing codes.

    def allowed(self):
        origin = self.headers.get("Origin")
        return (self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"
                and (origin is None or re.fullmatch(r"chrome-extension://[a-p]{32}", origin) is not None))

    def reply(self, status, body):
        data = json.dumps(body, allow_nan=False).encode()
        self.send_response(status)
        if self.allowed() and self.headers.get("Origin"):
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Solver-Key")
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.reply(200 if self.allowed() else 403, {})

    def authenticated(self):
        if not self.allowed() or not hmac.compare_digest(self.headers.get("X-Solver-Key", ""), self.server.code):
            self.reply(403, {"error": "Connection code rejected. Copy the current code from the local engine window."})
            return False
        return True

    def do_GET(self):
        if self.authenticated():
            self.reply(200 if self.path == "/health" else 404,
                       {"engine": "local-captcha", "version": "1.1", "formats": ["A", "B"],
                        'features':['dom_guidance','manual_points','trial_logs']} if self.path == "/health" else {"error": "Not found"})

    def do_POST(self):
        if not self.authenticated():
            return
        if self.path not in ("/analyze", '/manual', "/trials/start", "/trials/event", "/trials/finish"):
            self.reply(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= MAX_BODY or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise ValueError("Expected a bounded JSON screenshot request")
            self.connection.settimeout(15)
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
        except (ValueError, OSError) as exc:
            self.reply(400, {"error": str(exc)})
            return
        if self.path.startswith("/trials/"):
            try:
                if self.path == "/trials/start":
                    kind = payload.get("format", "A")
                    if kind not in self.server.trials:
                        raise ValueError("Invalid trial format")
                    result = self.server.trials[kind].start(payload)
                else:
                    kind = payload.get("format", "A")
                    if kind not in self.server.trials:
                        raise ValueError("Invalid trial format")
                    result = self.server.trials[kind].event(payload, finish=self.path.endswith("/finish"),
                                                      image=decode_png(payload["png"])[0] if payload.get("png") and self.path.endswith("/finish") else None)
                self.reply(200, result)
            except (ValueError, OSError):
                self.reply(422, {"error": "Trial data could not be saved. Keep the engine open and check the trial folder."})
            return
        if not self.server.job_lock.acquire(blocking=False):
            self.reply(409, {"error": "The engine is busy. Wait for the current analysis."})
            return
        try:
            self.reply(200, self.server.manualizer(payload) if self.path=='/manual' else self.server.analyzer(payload))
        except (ValueError, OSError, subprocess.TimeoutExpired):
            self.reply(422, {"error": "Analysis failed or timed out. Check the selected format and capture area."})
        finally:
            self.server.job_lock.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = EngineServer(("127.0.0.1", args.port))
    print(f"Local engine: http://127.0.0.1:{server.server_port}", flush=True)
    print(f"Connection code: {server.code}", flush=True)
    print("Paste this code into the extension. Keep this window open. Ctrl+C stops the engine.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
