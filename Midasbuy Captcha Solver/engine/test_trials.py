import json
from pathlib import Path
import tempfile
import unittest

from trials import TrialStore


class TrialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.job = "a" * 32
        source = self.root / "jobs" / self.job
        source.mkdir(parents=True)
        (source / "result.json").write_text(json.dumps({"offset_image_px": [135, 0]}), encoding="utf-8")
        (source / "input.png").write_bytes(b"fixture-image")
        self.store = TrialStore(self.root / "trial", self.root / "jobs")

    def tearDown(self):
        self.temp.cleanup()

    def test_numbering_preserves_existing_trials(self):
        first = self.store.start({"job": self.job, "plan": {"distance": 135}})
        second = self.store.start({"job": self.job})
        self.assertEqual([first["trial"], second["trial"]], ["trial1", "trial2"])
        self.assertEqual((self.root / "trial/trial1/initial.png").read_bytes(), b"fixture-image")
        self.store.event({"trial": first["trial"], "event": {"stage": 1, "remaining": 108}})
        self.store.event({"trial": first["trial"], "event": {"status": "aborted"}}, finish=True)
        report = json.loads((self.root / "trial/trial1/trial.json").read_text())
        self.assertEqual(report["status"], "aborted")
        self.assertEqual(report["events"][0]["remaining"], 108)
        self.assertEqual(len(report["events"]), 2)

    def test_finalized_or_traversal_trial_is_rejected(self):
        self.store.start({"job": self.job})
        self.store.event({"trial": "trial1", "event": {"status": "input_sent"}}, finish=True)
        with self.assertRaises(ValueError):
            self.store.event({"trial": "trial1", "event": {}})
        with self.assertRaises(ValueError):
            self.store.event({"trial": "../outside", "event": {}})
        with self.assertRaises(ValueError):
            self.store.start({"job": "../outside"})

    def test_format_b_has_independent_numbering_and_records_clicks(self):
        self.store.start({"job": self.job})
        source = self.root / 'jobs' / self.job / 'result.json'
        source.write_text(json.dumps({'matches': [{'order': 1, 'candidate': 'A'}]}), encoding='utf-8')
        selector = TrialStore(self.root / 'Format_B/trial', self.root / 'jobs', 'B')
        trial = selector.start({'job': self.job})
        self.assertEqual(trial['trial'], 'trial1')
        self.assertEqual(trial['format'], 'B')
        selector.event({'trial': 'trial1', 'event': {'type': 'selection', 'candidate': 'A'}})
        selector.event({'trial': 'trial1', 'event': {'status': 'input_sent'}}, finish=True)
        saved = json.loads((self.root / 'Format_B/trial/trial1/trial.json').read_text())
        self.assertEqual(saved['format'], 'B')
        self.assertEqual(saved['events'][0]['candidate'], 'A')


if __name__ == "__main__":
    unittest.main()
