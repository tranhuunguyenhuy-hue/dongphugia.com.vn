import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare", Path(__file__).with_name("prepare-pr-preview.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PreviewSecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "server").mkdir()
        (self.root / "client").mkdir()
        (self.root / "server/index.js").write_text("export default {}")
        self.config({"main": "index.js"})

    def config(self, value):
        (self.root / "server/wrangler.json").write_text(json.dumps(value))

    def test_discards_privileged_config(self):
        self.config({"main": "index.js", "name": "production", "build": {"command": "bad"},
                     "routes": ["example.com/*"], "vars": {"SECRET": "bad"},
                     "services": [{"binding": "PROD", "service": "production"}]})
        config, url = module.prepare(self.root, "12", "preview-only")
        self.assertEqual(config["name"], "dpg-pr-12")
        self.assertEqual(url, "https://dpg-pr-12.preview-only.workers.dev")
        for key in ["build", "routes", "services"]:
            self.assertNotIn(key, config)
        self.assertNotIn("SECRET", config["vars"])

    def test_rejects_escape(self):
        self.config({"main": "../../outside.js"})
        with self.assertRaises(ValueError): module.prepare(self.root, "12", "preview-only")

    def test_rejects_symlink(self):
        (self.root / "client/link").symlink_to("/etc/passwd")
        with self.assertRaises(ValueError): module.prepare(self.root, "12", "preview-only")

    def test_rejects_target_injection(self):
        for number, domain in [("../prod", "safe"), ("1", "evil/x"), ("0", "safe")]:
            with self.assertRaises(ValueError): module.prepare(self.root, number, domain)

if __name__ == "__main__": unittest.main()
