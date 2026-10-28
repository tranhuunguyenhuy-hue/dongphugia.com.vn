"""Generate only in a swap-free runner; persist GitHub-sealed ciphertext only."""
import base64
import json
import os
import pathlib
import subprocess
import tempfile


def command(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, **kw).stdout


def main():
    assert os.environ.get("GITHUB_ACTIONS") == "true"
    assert os.environ.get("GITHUB_REF") == "refs/heads/main"
    assert os.environ.get("GITHUB_ACTOR") == "tranhuunguyenhuy-hue"
    assert os.environ.get("GITHUB_RUN_ATTEMPT") == "1"
    assert os.environ["APPROVED_SHA"] == os.environ["GITHUB_SHA"]
    assert len(pathlib.Path("/proc/swaps").read_text().strip().splitlines()) == 1
    assert command(["findmnt", "-no", "FSTYPE", "-T", "/dev/shm"]).strip() == b"tmpfs"
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="direct-key-", dir="/dev/shm") as root:
        root = pathlib.Path(root)
        identity = root / "identity"
        mode = os.environ["KEY_MODE"]
        if mode == "generate":
            command(["age-keygen", "-o", str(identity)])
        else:
            assert mode == "verify"
            identity.write_text(os.environ["DIRECT_CHECKPOINT_AGE_IDENTITY"])
        recipient = command(["age-keygen", "-y", str(identity)]).decode().strip()
        assert recipient.startswith("age1") and recipient.isalnum()
        probe = b"dpg-direct-checkpoint-key-probe-v1\n"
        encrypted = command(["age", "--encrypt", "--recipient", recipient], input=probe)
        assert command(["age", "--decrypt", "--identity", str(identity)], input=encrypted) == probe
        if mode == "generate":
            from nacl.public import PublicKey, SealedBox
            key = PublicKey(base64.b64decode(os.environ["ENV_PUBLIC_KEY"], validate=True))
            sealed = SealedBox(key).encrypt(identity.read_bytes())
            output = pathlib.Path(os.environ["SEALED_OUTPUT"])
            output.write_text(json.dumps({"key_id": os.environ["ENV_KEY_ID"],
                "encrypted_value": base64.b64encode(sealed).decode(), "recipient": recipient,
                "source_sha": os.environ["GITHUB_SHA"]}))
        else:
            assert recipient == os.environ["EXPECTED_RECIPIENT"]
        print(json.dumps({"status": "PASS", "mode": mode, "recipient": recipient}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print('DIRECT_KEY status=STOP reason=PROTECTED_OPERATION_FAILED')
        raise SystemExit(1)
