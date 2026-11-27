import base64
import http.client
import json
import struct
import threading
import unittest

from bridge import EngineServer, decode_png


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        def analyzer(payload):
            self.calls.append(payload)
            return {"status": "test_only"}
        self.server = EngineServer(("127.0.0.1", 0), code="synthetic-test-code", analyzer=analyzer,
                                   manualizer=lambda payload:{'status':'manual','points':payload.get('points')})
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, body=None, **headers):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        values = {"Origin": "chrome-extension://" + "a" * 32,
                  "X-Solver-Key": "synthetic-test-code", "Content-Type": "application/json", **headers}
        connection.request(method, path, json.dumps(body) if body is not None else None, values)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        connection.close()
        return result

    def test_authenticated_health_and_analysis(self):
        self.assertEqual(self.request("GET", "/health")[0], 200)
        self.assertEqual(self.request("POST", "/analyze", {"format": "B"})[0], 200)
        self.assertEqual(self.calls, [{"format": "B"}])

    def test_websites_and_bad_keys_cannot_analyze(self):
        self.assertEqual(self.request("POST", "/analyze", {}, Origin="https://example.org")[0], 403)
        self.assertEqual(self.request("POST", "/analyze", {}, **{"X-Solver-Key": "wrong"})[0], 403)
        self.assertEqual(self.calls, [])

    def test_rebinding_host_is_rejected(self):
        self.assertEqual(self.request("GET", "/health", Host="evil.example")[0], 403)

    def test_preflight_is_scoped_to_extension_origin(self):
        status, headers, _ = self.request("OPTIONS", "/analyze")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], "chrome-extension://" + "a" * 32)
        self.assertNotIn("Access-Control-Allow-Origin", self.request("OPTIONS", "/analyze", Origin="https://example.org")[1])

    def test_bad_png_and_oversized_dimensions(self):
        with self.assertRaises(ValueError):
            decode_png("not a png")
        data = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 50000, 50000) + b"\0" * 9
        with self.assertRaises(ValueError):
            decode_png(base64.b64encode(data).decode())

    def test_manual_route_is_authenticated_and_preserves_provenance(self):
        status, _, result=self.request('POST','/manual',{'points':[100,200,220,200]})
        self.assertEqual(status,200)
        self.assertEqual(result['status'],'manual')
        self.assertEqual(result['points'],[100,200,220,200])
        self.assertEqual(self.request('POST','/manual',{},Origin='https://example.org')[0],403)

    def test_privileged_extension_request_without_origin_requires_key(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        connection.request("GET", "/health", headers={"X-Solver-Key": "synthetic-test-code"})
        response = connection.getresponse()
        self.assertEqual(response.status, 200)
        response.read()
        connection.close()
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        connection.request("GET", "/health")
        response = connection.getresponse()
        self.assertEqual(response.status, 403)
        response.read()
        connection.close()


if __name__ == "__main__":
    unittest.main()
