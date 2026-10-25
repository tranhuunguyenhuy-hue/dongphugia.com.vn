import unittest
import base64
import hashlib
import json
import pathlib
import tempfile
from unittest.mock import patch

from b11_rewrap_core import RewrapError
from b11_rewrap_io import (
    APPROVED_ZIP_BYTES,
    APPROVED_ZIP_SHA256,
    ARTIFACT_NAME,
    HISTORICAL_ARTIFACT_ID,
    HISTORICAL_RUN_HEAD,
    HISTORICAL_RUN_ID,
    _signed_host_allowed,
    upload_ciphertext,
    validate_destination_collaborators,
    validate_destination_metadata,
    validate_single_dispatch,
    validate_source_metadata,
)


def source_fixture():
    run = {
        "id": HISTORICAL_RUN_ID,
        "head_sha": HISTORICAL_RUN_HEAD,
        "head_branch": "main",
        "status": "completed",
        "conclusion": "success",
    }
    artifact = {
        "id": HISTORICAL_ARTIFACT_ID,
        "name": ARTIFACT_NAME,
        "size_in_bytes": APPROVED_ZIP_BYTES,
        "expired": False,
        "digest": f"sha256:{APPROVED_ZIP_SHA256}",
        "workflow_run": {"id": HISTORICAL_RUN_ID, "head_sha": HISTORICAL_RUN_HEAD},
    }
    return run, artifact


class IOContractTests(unittest.TestCase):
    def test_exact_public_metadata_passes(self):
        validate_source_metadata(*source_fixture())

    def test_wrong_run_or_expiry_fails_closed(self):
        run, artifact = source_fixture()
        artifact["workflow_run"]["id"] += 1
        with self.assertRaisesRegex(RewrapError, "source_provenance_mismatch"):
            validate_source_metadata(run, artifact)
        run, artifact = source_fixture()
        artifact["expired"] = True
        with self.assertRaisesRegex(RewrapError, "source_provenance_mismatch"):
            validate_source_metadata(run, artifact)

    def test_private_destination_is_mandatory(self):
        with self.assertRaisesRegex(RewrapError, "destination_audience_mismatch"):
            validate_destination_metadata({
                "full_name": "tranhuunguyenhuy-hue/dpg-ciphertext-vault-20261025",
                "private": False, "archived": False, "disabled": False,
            })

    def test_destination_requires_owner_write_and_only_owner_collaborator(self):
        repo = {
            "full_name": "tranhuunguyenhuy-hue/dpg-ciphertext-vault-20261025",
            "private": True, "archived": False, "disabled": False,
            "owner": {"login": "tranhuunguyenhuy-hue"},
            "permissions": {"push": False},
        }
        with self.assertRaisesRegex(RewrapError, "destination_write_unproved"):
            validate_destination_metadata(repo)
        repo["permissions"]["push"] = True
        validate_destination_metadata(repo)
        owner = {"login": "tranhuunguyenhuy-hue", "permissions": {"admin": True}}
        validate_destination_collaborators([owner])
        with self.assertRaisesRegex(RewrapError, "destination_acl_mismatch"):
            validate_destination_collaborators([owner, {"login": "another"}])

    def test_single_dispatch_rejects_reruns_and_other_dispatches(self):
        run = {"id": 77, "event": "workflow_dispatch", "run_attempt": 1}
        validate_single_dispatch({"total_count": 1, "workflow_runs": [run]}, 77)
        with self.assertRaisesRegex(RewrapError, "single_dispatch_unproved"):
            validate_single_dispatch({"total_count": 2, "workflow_runs": [run]}, 77)
        run["run_attempt"] = 2
        with self.assertRaisesRegex(RewrapError, "single_dispatch_unproved"):
            validate_single_dispatch({"total_count": 1, "workflow_runs": [run]}, 77)

    def test_signed_url_allowlist(self):
        self.assertTrue(_signed_host_allowed("https://productionresultssa1.blob.core.windows.net/file?sig=fixture"))
        self.assertFalse(_signed_host_allowed("http://productionresultssa1.blob.core.windows.net/file"))
        self.assertFalse(_signed_host_allowed("https://attacker.example/collect"))
        self.assertFalse(_signed_host_allowed("https://blob.core.windows.net.attacker.example/collect"))

    def test_upload_mock_accepts_only_private_audience_and_verifies_blob(self):
        ciphertext = b"age-encryption.org/v1\nPUBLIC-SYNTHETIC-CIPHERTEXT"
        sha = "a" * 40
        repo = {
            "full_name": "tranhuunguyenhuy-hue/dpg-ciphertext-vault-20261025",
            "private": True, "archived": False, "disabled": False,
            "owner": {"login": "tranhuunguyenhuy-hue"},
            "permissions": {"push": True},
        }

        def fake_json(path, token, *, method="GET", body=None):
            self.assertEqual(token, "fixture-token")
            if path.endswith("/dpg-ciphertext-vault-20261025"):
                return repo
            if path == "/user":
                return {"login": "tranhuunguyenhuy-hue"}
            if method == "PUT":
                self.assertIn("dpg-ciphertext-vault-20261025/contents/recovery/", path)
                self.assertEqual(base64.b64decode(json.loads(body)["content"]), ciphertext)
                return {"content": {"sha": sha}, "commit": {"sha": "b" * 40}}
            if path.endswith(f"/git/blobs/{sha}"):
                return {"encoding": "base64", "size": len(ciphertext), "content": base64.b64encode(ciphertext).decode()}
            raise AssertionError(path)

        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp, "leo540-38915575745-rewrapped.dump.age")
            path.write_bytes(ciphertext)
            def fake_request(request_path, token, **_kwargs):
                if "collaborators?" in request_path:
                    return json.dumps([{"login": "tranhuunguyenhuy-hue", "permissions": {"admin": True}}]).encode()
                raise RewrapError("api_http_404")

            with patch("b11_rewrap_io._api_json", side_effect=fake_json), patch(
                "b11_rewrap_io._api_request", side_effect=fake_request
            ):
                result = upload_ciphertext("fixture-token", path)
        self.assertEqual(result, hashlib.sha256(ciphertext).hexdigest())


if __name__ == "__main__":
    unittest.main()
