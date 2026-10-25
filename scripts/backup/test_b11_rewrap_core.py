import hashlib
import io
import json
import os
import pathlib
import tempfile
import unittest
import zipfile

from b11_rewrap_core import RewrapError, stream_rewrap, verify_approved_artifact_zip, verify_artifact_zip


def fixture_zip(*, wrong_archive_hash=False, archive_name="fixture.dump.age"):
    archive = b"SYNTHETIC-CIPHERTEXT-ONLY"
    archive_sha = hashlib.sha256(archive).hexdigest()
    manifest = json.dumps({"backupId": "fixture", "archiveSha256": "0" * 64 if wrong_archive_hash else archive_sha}).encode()
    manifest_name = "fixture.manifest.json"
    checksums = (
        f"{archive_sha}  {archive_name}\n"
        f"{hashlib.sha256(manifest).hexdigest()}  {manifest_name}\n"
    ).encode()
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(archive_name, archive)
        z.writestr(manifest_name, manifest)
        z.writestr("fixture.checksums.sha256", checksums)
    return out.getvalue(), archive


class VerifyTests(unittest.TestCase):
    def test_exact_synthetic_bundle(self):
        raw, archive = fixture_zip()
        self.assertEqual(verify_artifact_zip(raw, len(raw), hashlib.sha256(raw).hexdigest()), archive)

    def test_exact_zip_hash_required(self):
        raw, _ = fixture_zip()
        with self.assertRaisesRegex(RewrapError, "artifact_identity_mismatch"):
            verify_artifact_zip(raw, len(raw), "0" * 64)

    def test_manifest_must_link_archive(self):
        raw, _ = fixture_zip(wrong_archive_hash=True)
        with self.assertRaisesRegex(RewrapError, "checksum_mismatch"):
            verify_artifact_zip(raw, len(raw), hashlib.sha256(raw).hexdigest())

    def test_path_member_rejected(self):
        raw, _ = fixture_zip(archive_name="../fixture.dump.age")
        with self.assertRaisesRegex(RewrapError, "bundle_member_invalid"):
            verify_artifact_zip(raw, len(raw), hashlib.sha256(raw).hexdigest())

    def test_backup_identity_checked(self):
        raw, _ = fixture_zip()
        with self.assertRaisesRegex(RewrapError, "backup_identity_mismatch"):
            verify_artifact_zip(raw, len(raw), hashlib.sha256(raw).hexdigest(), expected_backup_id="different")

    def test_approved_entry_rejects_synthetic_artifact(self):
        raw, _ = fixture_zip()
        with self.assertRaisesRegex(RewrapError, "artifact_identity_mismatch"):
            verify_approved_artifact_zip(raw)


class RewrapTests(unittest.TestCase):
    def test_synthetic_pipe_has_no_plaintext_file(self):
        if not hasattr(os, "memfd_create"):
            self.skipTest("Linux memfd only")
        with tempfile.TemporaryDirectory() as temp:
            age = pathlib.Path(temp, "fake-age")
            age.write_text(
                "#!/usr/bin/env python3\n"
                "import sys\n"
                "args=sys.argv[1:]\n"
                "if '--decrypt' in args:\n"
                "    p=args[args.index('--identity')+1]\n"
                "    assert open(p,'rb').read()==b'fixture identity'\n"
                "    sys.stdout.buffer.write(sys.stdin.buffer.read())\n"
                "elif '--encrypt' in args:\n"
                "    sys.stdout.buffer.write(b'NEW-CIPHERTEXT:'+sys.stdin.buffer.read())\n"
                "else: sys.exit(2)\n"
            )
            age.chmod(0o700)
            output = stream_rewrap(
                b"SYNTHETIC-CIPHERTEXT-ONLY", b"fixture identity",
                "age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr",
                str(age),
                hashlib.sha256(age.read_bytes()).hexdigest(),
            )
            self.assertEqual(output, b"NEW-CIPHERTEXT:SYNTHETIC-CIPHERTEXT-ONLY")
            self.assertEqual({p.name for p in pathlib.Path(temp).iterdir()}, {"fake-age"})

    def test_recipient_rejected_before_process(self):
        with self.assertRaisesRegex(RewrapError, "input_invalid"):
            stream_rewrap(b"synthetic", b"fixture identity", "not-an-age-recipient", "/bin/false", "0" * 64)


if __name__ == "__main__":
    unittest.main()
