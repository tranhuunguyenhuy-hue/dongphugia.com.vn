"""Generate only in a swap-free runner; persist GitHub-sealed ciphertext only."""
import base64
import json
import os
import pathlib
import subprocess
import tempfile
import hashlib
import re
import urllib.request
import urllib.error


class VaultGate(Exception):
    pass


def check_vault(encrypted):
    repo = os.environ["DIRECT_VAULT_REPOSITORY"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", repo):
        raise VaultGate("VAULT_REPOSITORY_FORMAT")
    def api(path, method="GET", payload=None):
        request = urllib.request.Request("https://api.github.com/" + path,
            data=None if payload is None else json.dumps(payload).encode(), method=method,
            headers={"Authorization": "Bearer " + os.environ["DIRECT_VAULT_TOKEN"],
                     "Accept": "application/vnd.github+json", "Content-Type": "application/json"})
        # Never forward bearer credentials through an HTTP redirect.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        try:
            with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
                if response.headers.get("X-OAuth-Scopes", "").strip():
                    raise VaultGate("VAULT_CLASSIC_OAUTH_SCOPES_REJECTED")
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise VaultGate("VAULT_HTTP_" + str(error.code)) from None
    metadata = api("repos/" + repo)
    if not metadata.get("private") or metadata.get("owner", {}).get("login") != "tranhuunguyenhuy-hue":
        raise VaultGate("VAULT_OWNER_OR_PRIVACY_MISMATCH")
    visible = api("user/repos?visibility=private&affiliation=owner&per_page=100")
    if len(visible) != 1 or visible[0].get("full_name") != repo:
        raise VaultGate("VAULT_PRIVATE_REPOSITORY_SCOPE_MISMATCH")
    blob = api("repos/" + repo + "/git/blobs", "POST",
               {"encoding": "base64", "content": base64.b64encode(encrypted).decode()})
    readback = api("repos/" + repo + "/git/blobs/" + blob["sha"])
    if hashlib.sha256(base64.b64decode(readback["content"])).digest() != hashlib.sha256(encrypted).digest():
        raise VaultGate("VAULT_PROBE_HASH_MISMATCH")
    return {"vault_contents_read_write": "PASS", "probe_blob_sha": blob["sha"],
            "existing_refs_modified": False, "scope_evidence": "no_classic_scopes_one_visible_private_repo"}


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
            assert os.environ.get("KEY_ALREADY_PRESENT") == "false"
            command(["age-keygen", "-o", str(identity)])
        else:
            assert mode in ("verify", "vault-check")
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
        if mode == "vault-check":
            print(json.dumps(check_vault(encrypted)))
        print(json.dumps({"status": "PASS", "mode": mode, "recipient": recipient}))


if __name__ == "__main__":
    try:
        main()
    except VaultGate as error:
        print("DIRECT_VAULT status=STOP reason=" + str(error))
        raise SystemExit(1)
    except Exception:
        print('DIRECT_KEY status=STOP reason=PROTECTED_OPERATION_FAILED')
        raise SystemExit(1)
