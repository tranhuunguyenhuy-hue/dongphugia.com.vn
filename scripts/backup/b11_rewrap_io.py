"""GitHub transport for the single approved, encrypted B11 recovery artifact.

Fetch and upload are separate CLI modes. Neither mode reads an age identity or
decrypts data. The protected rewrap itself runs in a network-disabled container.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

from b11_rewrap_core import (
    APPROVED_ZIP_BYTES,
    APPROVED_ZIP_SHA256,
    DESTINATION_REPOSITORY,
    HISTORICAL_ARTIFACT_ID,
    HISTORICAL_RUN_HEAD,
    HISTORICAL_RUN_ID,
    OUTPUT_NAME,
    RewrapError,
    verify_approved_artifact_zip,
)

SOURCE_REPOSITORY = "tranhuunguyenhuy-hue/dongphugia.com.vn"
ARTIFACT_NAME = f"leo540-runtime-backup-{HISTORICAL_RUN_ID}"
DESTINATION_PATH = f"recovery/{OUTPUT_NAME}"
API_ROOT = "https://api.github.com"
MAX_JSON_BYTES = 24 * 1024 * 1024
OWNER_LOGIN = "tranhuunguyenhuy-hue"


def _api_request(path: str, token: str, *, method: str = "GET", body: bytes | None = None) -> bytes:
    if not token or not path.startswith("/"):
        raise RewrapError("api_input_invalid")
    request = urllib.request.Request(
        API_ROOT + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    # All authenticated requests must remain on api.github.com.
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(request, timeout=30) as response:
            if response.url != API_ROOT + path:
                raise RewrapError("api_redirect_disallowed")
            result = response.read(MAX_JSON_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise RewrapError(f"api_http_{exc.code}") from None
    except urllib.error.URLError as exc:
        raise RewrapError("api_transport_failed") from None
    if len(result) > MAX_JSON_BYTES:
        raise RewrapError("api_response_too_large")
    return result


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def _api_json(path: str, token: str, *, method: str = "GET", body: bytes | None = None) -> dict:
    try:
        value = json.loads(_api_request(path, token, method=method, body=body))
    except (UnicodeError, ValueError) as exc:
        raise RewrapError("api_json_invalid") from exc
    if not isinstance(value, dict):
        raise RewrapError("api_json_invalid")
    return value


def validate_source_metadata(run: dict, artifact: dict) -> None:
    """Bind API metadata to the exact historical run and artifact roles."""
    workflow_run = artifact.get("workflow_run") or {}
    if (
        run.get("id") != HISTORICAL_RUN_ID
        or run.get("head_sha") != HISTORICAL_RUN_HEAD
        or run.get("head_branch") != "main"
        or run.get("status") != "completed"
        or run.get("conclusion") != "success"
        or artifact.get("id") != HISTORICAL_ARTIFACT_ID
        or artifact.get("name") != ARTIFACT_NAME
        or artifact.get("size_in_bytes") != APPROVED_ZIP_BYTES
        or artifact.get("expired") is not False
        or workflow_run.get("id") != HISTORICAL_RUN_ID
        or workflow_run.get("head_sha") != HISTORICAL_RUN_HEAD
    ):
        raise RewrapError("source_provenance_mismatch")
    digest = artifact.get("digest")
    if digest is not None and digest != f"sha256:{APPROVED_ZIP_SHA256}":
        raise RewrapError("source_digest_mismatch")


def _signed_host_allowed(url: str) -> bool:
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (
        host == "objects.githubusercontent.com"
        or host.endswith(".actions.githubusercontent.com")
        or host.endswith(".blob.core.windows.net")
    )


class _SignedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        if not _signed_host_allowed(newurl):
            raise RewrapError("signed_url_host_disallowed")
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def fetch_exact_artifact(token: str, output_zip: Path, output_manifest: Path) -> None:
    run = _api_json(f"/repos/{SOURCE_REPOSITORY}/actions/runs/{HISTORICAL_RUN_ID}", token)
    artifact = _api_json(f"/repos/{SOURCE_REPOSITORY}/actions/artifacts/{HISTORICAL_ARTIFACT_ID}", token)
    validate_source_metadata(run, artifact)
    request = urllib.request.Request(
        f"{API_ROOT}/repos/{SOURCE_REPOSITORY}/actions/artifacts/{HISTORICAL_ARTIFACT_ID}/zip",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
    )
    try:
        urllib.request.build_opener(_NoRedirect()).open(request, timeout=30)
    except urllib.error.HTTPError as exc:
        if exc.code not in (302, 307):
            raise RewrapError(f"artifact_http_{exc.code}") from None
        signed_url = exc.headers.get("Location", "")
    except urllib.error.URLError:
        raise RewrapError("artifact_transport_failed") from None
    else:
        raise RewrapError("artifact_redirect_missing")
    if not _signed_host_allowed(signed_url):
        raise RewrapError("signed_url_host_disallowed")
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(output_zip, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    try:
        digest = hashlib.sha256()
        size = 0
        # The signed request carries no Authorization header or other token.
        with urllib.request.build_opener(_SignedRedirect()).open(signed_url, timeout=60) as response:
            with os.fdopen(fd, "wb") as output:
                while chunk := response.read(65536):
                    size += len(chunk)
                    if size > APPROVED_ZIP_BYTES:
                        raise RewrapError("artifact_size_mismatch")
                    digest.update(chunk)
                    output.write(chunk)
        if size != APPROVED_ZIP_BYTES or digest.hexdigest() != APPROVED_ZIP_SHA256:
            raise RewrapError("artifact_hash_mismatch")
        verify_approved_artifact_zip(output_zip.read_bytes())
        with zipfile.ZipFile(output_zip) as bundle:
            manifests = [n for n in bundle.namelist() if n.endswith(".manifest.json")]
            if len(manifests) != 1:
                raise RewrapError("manifest_shape_invalid")
            manifest = bundle.read(manifests[0])
        manifest_fd = os.open(output_manifest, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        with os.fdopen(manifest_fd, "wb") as output:
            output.write(manifest)
    except BaseException:
        output_zip.unlink(missing_ok=True)
        output_manifest.unlink(missing_ok=True)
        raise


def validate_destination_metadata(repo: dict) -> None:
    if repo.get("full_name") != DESTINATION_REPOSITORY or repo.get("private") is not True:
        raise RewrapError("destination_audience_mismatch")
    if repo.get("archived") is not False or repo.get("disabled") is not False:
        raise RewrapError("destination_unavailable")
    if (repo.get("owner") or {}).get("login") != OWNER_LOGIN:
        raise RewrapError("destination_owner_mismatch")
    if (repo.get("permissions") or {}).get("push") is not True:
        raise RewrapError("destination_write_unproved")


def validate_destination_collaborators(collaborators: object) -> None:
    if (
        not isinstance(collaborators, list)
        or len(collaborators) != 1
        or not isinstance(collaborators[0], dict)
        or collaborators[0].get("login") != OWNER_LOGIN
        or (collaborators[0].get("permissions") or {}).get("admin") is not True
    ):
        raise RewrapError("destination_acl_mismatch")


def verify_destination_audience(token: str) -> None:
    repo = _api_json(f"/repos/{DESTINATION_REPOSITORY}", token)
    validate_destination_metadata(repo)
    actor = _api_json("/user", token)
    if actor.get("login") != OWNER_LOGIN:
        raise RewrapError("destination_token_actor_mismatch")
    try:
        collaborators = json.loads(_api_request(
            f"/repos/{DESTINATION_REPOSITORY}/collaborators?affiliation=all&per_page=2", token
        ))
    except (UnicodeError, ValueError) as exc:
        raise RewrapError("destination_acl_invalid") from exc
    validate_destination_collaborators(collaborators)


def preflight_destination(token: str) -> None:
    verify_destination_audience(token)
    content_path = f"/repos/{DESTINATION_REPOSITORY}/contents/{DESTINATION_PATH}"
    try:
        _api_request(content_path, token)
    except RewrapError as exc:
        if str(exc) != "api_http_404":
            raise
    else:
        raise RewrapError("destination_path_exists")


def upload_ciphertext(token: str, input_path: Path) -> str:
    if any(os.environ.get(name) for name in ("AGE_IDENTITY", "B11_OLD_AGE_IDENTITY", "BACKUP_AGE_PRIVATE_KEY")):
        raise RewrapError("identity_in_upload_environment")
    preflight_destination(token)
    if input_path.name != OUTPUT_NAME or input_path.is_symlink():
        raise RewrapError("ciphertext_path_invalid")
    ciphertext = input_path.read_bytes()
    if not ciphertext.startswith(b"age-encryption.org/v1\n") or not 1 <= len(ciphertext) <= 64 * 1024 * 1024:
        raise RewrapError("ciphertext_contract_invalid")
    sha256 = hashlib.sha256(ciphertext).hexdigest()
    content_path = f"/repos/{DESTINATION_REPOSITORY}/contents/{DESTINATION_PATH}"
    body = json.dumps({
        "message": "Retain single Owner-encrypted B11 recovery ciphertext",
        "content": base64.b64encode(ciphertext).decode("ascii"),
    }, separators=(",", ":")).encode()
    result = _api_json(content_path, token, method="PUT", body=body)
    blob_sha = ((result.get("content") or {}).get("sha"))
    commit_sha = ((result.get("commit") or {}).get("sha"))
    if not isinstance(blob_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", blob_sha):
        raise RewrapError("upload_receipt_invalid")
    if not isinstance(commit_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", commit_sha):
        raise RewrapError("upload_receipt_invalid")
    blob = _api_json(f"/repos/{DESTINATION_REPOSITORY}/git/blobs/{blob_sha}", token)
    if blob.get("encoding") != "base64" or blob.get("size") != len(ciphertext):
        raise RewrapError("destination_verify_invalid")
    try:
        retained = base64.b64decode(blob.get("content", ""), validate=False)
    except (ValueError, TypeError) as exc:
        raise RewrapError("destination_verify_invalid") from exc
    if hashlib.sha256(retained).hexdigest() != sha256:
        raise RewrapError("destination_verify_mismatch")
    verify_destination_audience(token)
    return sha256


def validate_single_dispatch(runs: dict, run_id: int) -> None:
    listed = runs.get("workflow_runs")
    if (
        runs.get("total_count") != 1
        or not isinstance(listed, list)
        or len(listed) != 1
        or listed[0].get("id") != run_id
        or listed[0].get("event") != "workflow_dispatch"
        or listed[0].get("run_attempt") != 1
    ):
        raise RewrapError("single_dispatch_unproved")


def preflight_single_dispatch(token: str, run_id: int) -> None:
    runs = _api_json(
        f"/repos/{SOURCE_REPOSITORY}/actions/workflows/b11-private-rewrap.yml/runs?event=workflow_dispatch&per_page=2",
        token,
    )
    validate_single_dispatch(runs, run_id)


def main() -> int:
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("fetch", "destination-preflight", "single-dispatch", "upload"):
            raise RewrapError("mode_invalid")
        if sys.argv[1] == "fetch":
            token = os.environ.get("GH_TOKEN", "")
            fetch_exact_artifact(token, Path(os.environ["B11_ARTIFACT_ZIP"]), Path(os.environ["B11_MANIFEST_JSON"]))
            print("B11_SOURCE status=PASS exact_zip=PASS")
        elif sys.argv[1] == "destination-preflight":
            preflight_destination(os.environ.get("B11_VAULT_CONTENTS_TOKEN", ""))
            print("B11_DESTINATION status=PASS collaborators=owner_only actor=owner push_access=visible path=vacant")
        elif sys.argv[1] == "single-dispatch":
            preflight_single_dispatch(os.environ.get("GH_TOKEN", ""), int(os.environ["GITHUB_RUN_ID"]))
            print("B11_DISPATCH status=PASS count=1 attempt=1")
        else:
            token = os.environ.get("B11_VAULT_CONTENTS_TOKEN", "")
            digest = upload_ciphertext(token, Path(os.environ["B11_CIPHERTEXT_PATH"]))
            print(f"B11_DESTINATION status=PASS ciphertext_sha256={digest}")
        return 0
    except RewrapError as exc:
        print(f"B11_TRANSPORT status=FAIL reason={exc}", file=sys.stderr)
        return 1
    except BaseException:
        print("B11_TRANSPORT status=FAIL reason=unexpected", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
