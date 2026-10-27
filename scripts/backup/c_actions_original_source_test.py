#!/usr/bin/env python3
"""Synthetic-only tests for exact encrypted artifact staging."""

from __future__ import annotations

import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from b11_rewrap_core import (
    APPROVED_ZIP_BYTES,
    APPROVED_ZIP_SHA256,
    HISTORICAL_ARTIFACT_ID,
    HISTORICAL_RUN_HEAD,
    HISTORICAL_RUN_ID,
    RewrapError,
)
from c_actions_original_source import materialize_verified_backup_bundle
from b11_rewrap_io import validate_source_metadata


def make_bundle(backup_id: str = "synthetic-1", *, archive: bytes = b"age-encryption.org/v1\nsynthetic") -> bytes:
    archive_name = f"{backup_id}.dump.age"
    manifest_name = f"{backup_id}.manifest.json"
    checksums_name = f"{backup_id}.checksums.sha256"
    archive_hash = hashlib.sha256(archive).hexdigest()
    manifest = json.dumps({"backupId": backup_id, "archiveSha256": archive_hash}, separators=(",", ":")).encode()
    manifest_hash = hashlib.sha256(manifest).hexdigest()
    checksums = f"{archive_hash}  {archive_name}\n{manifest_hash}  {manifest_name}\n".encode()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as bundle:
        bundle.writestr(archive_name, archive)
        bundle.writestr(manifest_name, manifest)
        bundle.writestr(checksums_name, checksums)
    return buffer.getvalue()


class OriginalSourceTests(unittest.TestCase):
    def stage(self, raw: bytes, directory: Path, backup_id: str = "synthetic-1") -> None:
        materialize_verified_backup_bundle(
            raw,
            directory,
            expected_zip_bytes=len(raw),
            expected_zip_sha256=hashlib.sha256(raw).hexdigest(),
            expected_backup_id=backup_id,
        )

    def test_stages_only_verified_ciphertext_manifest_and_checksums(self) -> None:
        raw = make_bundle()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "backup"
            self.stage(raw, output)
            self.assertEqual(
                sorted(path.name for path in output.iterdir()),
                ["synthetic-1.checksums.sha256", "synthetic-1.dump.age", "synthetic-1.manifest.json"],
            )
            self.assertEqual((output / "synthetic-1.dump.age").read_bytes(), b"age-encryption.org/v1\nsynthetic")
            self.assertEqual(output.stat().st_mode & 0o777, 0o700)
            self.assertTrue(all((path.stat().st_mode & 0o777) == 0o600 for path in output.iterdir()))

    def test_rejects_modified_outer_zip_before_creating_output(self) -> None:
        raw = make_bundle()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "backup"
            with self.assertRaises(RewrapError):
                materialize_verified_backup_bundle(
                    raw,
                    output,
                    expected_zip_bytes=len(raw),
                    expected_zip_sha256="0" * 64,
                    expected_backup_id="synthetic-1",
                )
            self.assertFalse(output.exists())

    def test_rejects_bundle_with_unexpected_member(self) -> None:
        raw = make_bundle()
        buffer = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(raw)) as source, zipfile.ZipFile(buffer, "w") as altered:
            for item in source.infolist():
                altered.writestr(item, source.read(item.filename))
            altered.writestr("../escape.dump.age", b"synthetic")
        malicious = buffer.getvalue()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "backup"
            with self.assertRaises(RewrapError):
                self.stage(malicious, output)
            self.assertFalse(output.exists())

    def test_pins_source_artifact_expiry(self) -> None:
        run = {
            "id": HISTORICAL_RUN_ID,
            "head_sha": HISTORICAL_RUN_HEAD,
            "head_branch": "main",
            "status": "completed",
            "conclusion": "success",
        }
        artifact = {
            "id": HISTORICAL_ARTIFACT_ID,
            "name": f"leo540-runtime-backup-{HISTORICAL_RUN_ID}",
            "size_in_bytes": APPROVED_ZIP_BYTES,
            "expired": False,
            "digest": f"sha256:{APPROVED_ZIP_SHA256}",
            "expires_at": "2026-10-30T14:27:48Z",
            "workflow_run": {"id": HISTORICAL_RUN_ID, "head_sha": HISTORICAL_RUN_HEAD},
        }
        validate_source_metadata(run, artifact, expected_expires_at="2026-10-30T14:27:48Z")
        artifact["expires_at"] = "2026-10-30T14:27:49Z"
        with self.assertRaises(RewrapError):
            validate_source_metadata(run, artifact, expected_expires_at="2026-10-30T14:27:48Z")


if __name__ == "__main__":
    unittest.main()
