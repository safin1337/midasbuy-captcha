"""Local browser-control fixture, not a CAPTCHA accuracy evaluation."""
import base64
import copy
import json
from pathlib import Path
import struct
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Midasbuy Captcha Solver/engine"))
from bridge import EngineServer
from trials import TrialStore

evidence = ROOT / "Midasbuy Captcha Solver/evidence"
jobs = evidence / "solver_fixture_jobs"
recorded_path = evidence / "engine-format-b.json"
if recorded_path.exists():
    recorded = json.loads(recorded_path.read_text(encoding="utf-8"))
else:
    # Tracked saved proposal makes the control fixture runnable on a fresh clone.
    # This fallback does not claim to run inference inside the browser test.
    recorded = json.loads((ROOT / "Format_B/diagnostics/dot_evaluation/input/result.json").read_text(encoding="utf-8"))
    recorded.update(format="B", width=475, height=480, has_proposal=True,
                    confirm_center=[420, 429.5], preview=None)


def analyze_fixture(payload):
    data = base64.b64decode(payload["png"])
    width, height = struct.unpack(">II", data[16:24])
    if payload["format"] == "B":
        result = copy.deepcopy(recorded)
        sx, sy = width / result["width"], height / result["height"]
        for match in result["matches"]:
            match["center"] = [match["center"][0] * sx, match["center"][1] * sy]
        result["confirm_center"] = [result["confirm_center"][0] * sx, result["confirm_center"][1] * sy]
        result.update(width=width, height=height, status="uncertain")
        result['job'] = uuid.uuid4().hex
        folder = jobs / result['job']
        folder.mkdir(parents=True)
        (folder / 'input.png').write_bytes(data)
        (folder / 'annotated.png').write_bytes(data)
        (folder / 'result.json').write_text(json.dumps(result),encoding='utf-8')
        return result
    sx, sy = width / 425, height / 420
    if not payload.get('guidance',{}).get('dom',{}).get('piece'):
        raise ValueError('Fixture requires real iframe DOM guidance')
    if payload['guidance'].get('sprite_status')!='readable' or not payload['guidance'].get('sprite_png'):
        raise ValueError('Fixture requires origin-clean decoded sprite extraction')
    job = uuid.uuid4().hex
    result = {"format": "A", "job": job, "width": width, "height": height,
              "status": "detected", "has_proposal": True, "offset_image_px": [135 * sx, 0],
              'source_image':payload['png'],
              "slider": {"status": "located", "zero_center": [61 * sx, 377.5 * sy],
                         "handle_box": [20 * sx, 355 * sy, 82 * sx, 45 * sy]}}
    folder = jobs / job
    folder.mkdir(parents=True)
    (folder / "input.png").write_bytes(data)
    (folder / "annotated.png").write_bytes(data)
    (folder / "result.json").write_text(json.dumps(result), encoding="utf-8")
    return result


def manual_fixture(payload):
    source=jobs/payload['job']
    result=json.loads((source/'result.json').read_text())
    px,py,gx,gy=payload['points']
    if gx<=px or abs(gy-py)>4:raise ValueError('Invalid manual points')
    result.update(job=uuid.uuid4().hex,status='manual',manual_points=payload['points'],offset_image_px=[gx-px,gy-py])
    folder=jobs/result['job'];folder.mkdir(parents=True)
    for name in ['input.png','annotated.png']:(folder/name).write_bytes((source/name).read_bytes())
    (folder/'result.json').write_text(json.dumps(result))
    return result


server = EngineServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv)>1 else 18765), code="synthetic-browser-fixture", analyzer=analyze_fixture,
                      manualizer=manual_fixture)
server.trials = {kind: TrialStore(evidence / "solver_fixture_trials" / f"Format_{kind}", jobs, kind)
                 for kind in ("A", "B")}
print("FIXTURE_ENGINE_READY", flush=True)
server.serve_forever()
