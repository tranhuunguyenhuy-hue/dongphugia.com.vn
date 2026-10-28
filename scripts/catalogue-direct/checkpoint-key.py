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
            stage = ("CONTENTS_WRITE" if method == "POST" else "CONTENTS_READ" if "/git/blobs/" in path
                     else "PRIVATE_SCOPE_LIST" if path.startswith("user/repos?") else "METADATA")
            raise VaultGate("VAULT_" + stage + "_HTTP_" + str(error.code)) from None
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
            "existing_refs_modified": False, "scope_evidence": "no_classic_scopes_one_visible_private_repo",
            "least_privilege_scope": "REQUIRES_PAT_SETTINGS_VERIFICATION"}


def command(args, **kw):
    return subprocess.run(args, check=True, capture_output=True, **kw).stdout


def verify_affected_state(identity):
    """Read the immutable pre-setup snapshot, verify ciphertext and decrypt in RAM."""
    repo = os.environ["DIRECT_VAULT_REPOSITORY"]
    assert re.fullmatch(r"tranhuunguyenhuy-hue/[A-Za-z0-9_.-]+", repo)
    commit = "354efb8cfe4740936c50f2f34030cf2081ab2a6d"
    request = urllib.request.Request(
        "https://api.github.com/repos/" + repo + "/contents/affected-state.age?ref=" + commit,
        headers={"Authorization": "Bearer " + os.environ["DIRECT_VAULT_TOKEN"],
                 "Accept": "application/vnd.github+json"})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        payload = json.load(response)
    encrypted = base64.b64decode(payload["content"])
    assert len(encrypted) == 92031
    assert hashlib.sha256(encrypted).hexdigest() == "df0de24f7d41ff965c4fbd872058fdac73fed7f4d77d82f595116df58c8868f2"
    plaintext = command(["age", "--decrypt", "--identity", str(identity)], input=encrypted)
    assert hashlib.sha256(plaintext).hexdigest() == "7d48235d944077cc0173fc64b8acf1f7208184476ba1ec51791d7151130183d3"
    snapshot = json.loads(plaintext)
    assert snapshot["contract"] == "dpg:affected-state-before-setup:v1"
    assert snapshot["target"] == "bonxyxluzlxfkdetryoo"
    assert len(snapshot["tables"]) == 27 and all(t["rows"] == 0 for t in snapshot["tables"])
    assert snapshot["new_roles"] == [] and snapshot["new_helper"] is None
    assert len(snapshot["sequence_state"]) == 27
    print(json.dumps({"affected_state_decryption": "PASS", "checkpoint_commit": commit,
        "target_tables": 27, "target_rows": 0, "sequence_states": 27,
        "live_target_comparison": "REQUIRED_BEFORE_WRITE", "database_queries": False}))


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
            assert mode in ("verify", "vault-check", "checkpoint-verify")
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
        if mode == "checkpoint-verify":
            verify_affected_state(identity)
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
