"""Public synthetic Linux tests; no project backup or Owner identity is used."""

import hashlib
import os
import pathlib
import subprocess
import tempfile
import unittest

from b11_rewrap_core import RewrapError, stream_rewrap


@unittest.skipUnless(hasattr(os, "memfd_create") and os.environ.get("B11_TEST_AGE_BIN"), "Linux age fixture required")
class LinuxAgeTests(unittest.TestCase):
    def test_real_age_rewrap_synthetic_bytes(self):
        age = os.environ["B11_TEST_AGE_BIN"]
        keygen = os.environ["B11_TEST_AGE_KEYGEN_BIN"]
        with tempfile.TemporaryDirectory() as temp:
            old_key = pathlib.Path(temp, "old-fixture-key")
            new_key = pathlib.Path(temp, "new-fixture-key")
            for key in (old_key, new_key):
                subprocess.run([keygen, "-o", str(key)], check=True, capture_output=True)
            old_recipient = subprocess.run([keygen, "-y", str(old_key)], check=True, capture_output=True).stdout.decode().strip()
            new_recipient = subprocess.run([keygen, "-y", str(new_key)], check=True, capture_output=True).stdout.decode().strip()
            synthetic = b"B11 PUBLIC SYNTHETIC FIXTURE ONLY\n" * 64
            original_ciphertext = subprocess.run(
                [age, "--encrypt", "--recipient", old_recipient],
                input=synthetic, check=True, capture_output=True,
            ).stdout
            new_ciphertext = stream_rewrap(
                original_ciphertext,
                old_key.read_bytes(),
                new_recipient,
                age,
                hashlib.sha256(pathlib.Path(age).read_bytes()).hexdigest(),
                timeout_seconds=20,
            )
            self.assertTrue(new_ciphertext.startswith(b"age-encryption.org/v1\n"))
            self.assertNotIn(synthetic, new_ciphertext)
            restored = subprocess.run(
                [age, "--decrypt", "--identity", str(new_key)],
                input=new_ciphertext, check=True, capture_output=True,
            ).stdout
            self.assertEqual(restored, synthetic)

    def test_stalled_age_has_deadline(self):
        fake = pathlib.Path(os.environ["B11_TEST_STALLED_AGE_BIN"])
        with self.assertRaisesRegex(RewrapError, "age_timeout"):
            stream_rewrap(
                b"synthetic ciphertext", b"fixture identity",
                "age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr",
                str(fake), hashlib.sha256(fake.read_bytes()).hexdigest(),
                timeout_seconds=1,
            )


if __name__ == "__main__":
    unittest.main()
