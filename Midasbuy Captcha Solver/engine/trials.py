"""Append-only attempt history in atomically allocated Format_A/trial/trialN folders."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import threading


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    descriptor, temporary = tempfile.mkstemp(prefix=".trial-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class TrialStore:
    def __init__(self, root, jobs, kind="A"):
        self.root, self.jobs = Path(root), Path(jobs)
        self.kind = kind
        self.lock = threading.Lock()
        self.active = set()

    def start(self, payload):
        job = payload.get("job", "")
        if not isinstance(job, str) or re.fullmatch(r"[a-f0-9]{32}", job) is None:
            raise ValueError("Invalid analysis job")
        source = self.jobs / job
        if not (source / "result.json").is_file():
            raise ValueError("Analysis job was not found")
        analysis = json.loads((source / "result.json").read_text(encoding="utf-8"))
        if self.kind == "A" and "offset_image_px" not in analysis:
            raise ValueError("Slider trials require a Format A analysis")
        if self.kind == "B" and "matches" not in analysis:
            raise ValueError("Selector trials require a Format B analysis")
        with self.lock:
            self.root.mkdir(parents=True, exist_ok=True)
            numbers = [int(match[1]) for item in self.root.iterdir()
                       if (match := re.fullmatch(r"trial([1-9][0-9]*)", item.name))]
            number = max(numbers, default=0) + 1
            while True:
                folder = self.root / f"trial{number}"
                try:
                    folder.mkdir()
                    break
                except FileExistsError:
                    number += 1
            for filename, target in (("input.png", "initial.png"), ("annotated.png", "annotated.png"), ("result.json", "analysis.json"),
                                     ('guidance.json','guidance.json'),('manual-source.json','manual-source.json')):
                if (source / filename).is_file():
                    shutil.copyfile(source / filename, folder / target)
            record = {"trial": folder.name, "job": job, "format": self.kind, "started_at": timestamp(),
                      "status": "in_progress", "plan": payload.get("plan"), "events": []}
            write_json(folder / "trial.json", record)
            self.active.add(folder.name)
            return {"trial": folder.name, "format": self.kind, "relative_path": f"Midasbuy Captcha Solver/Format_{self.kind}/trial/{folder.name}"}

    def event(self, payload, finish=False, image=None):
        name = payload.get("trial")
        if not isinstance(name, str) or re.fullmatch(r"trial[1-9][0-9]*", name) is None:
            raise ValueError("Invalid trial identifier")
        event = payload.get("event")
        if not isinstance(event, dict):
            raise ValueError("Expected a trial event")
        with self.lock:
            if name not in self.active:
                raise ValueError("This trial is not active in the current engine session")
            path = self.root / name / "trial.json"
            record = json.loads(path.read_text(encoding="utf-8"))
            if len(record["events"]) >= 200:
                raise ValueError("Trial event limit reached")
            record["events"].append({"recorded_at": timestamp(), **event})
            if finish:
                if image is not None:
                    (path.parent / "after.png").write_bytes(image)
                record["status"] = event.get("status", "finished")
                record["finished_at"] = timestamp()
            write_json(path, record)
            if finish:
                self.active.remove(name)
            return {"trial": name, "events": len(record["events"]), "status": record["status"]}
