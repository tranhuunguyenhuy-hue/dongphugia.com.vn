"""Prepare only the pinned B11 ciphertext and its verified public manifest."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import zipfile
from pathlib import Path

from b11_rewrap_core import DESTINATION_REPOSITORY, OUTPUT_NAME, RewrapError
from b11_rewrap_io import (
    DESTINATION_PATH,
    _api_json,
    fetch_exact_artifact,
    verify_destination_audience,
)

EXPECTED_BYTES = 9_240_647
EXPECTED_SHA256 = "15d8ec3d1d22e884ed280fd9eb810ce8a7f7257553e180a2aa9e9aff7a49b50a"
BACKUP_ID = "leo540-38915575745"
SOURCE_REPOSITORY = "tranhuunguyenhuy-hue/dongphugia.com.vn"


def require_single_dispatch(token: str, run_id: int, head_sha: str) -> None:
    runs = _api_json(
        f"/repos/{SOURCE_REPOSITORY}/actions/workflows/c-actions-recovery.yml/runs"
        "?event=workflow_dispatch&per_page=2", token
    )
    listed = runs.get("workflow_runs")
    if (runs.get("total_count") != 1 or not isinstance(listed, list) or
            len(listed) != 1 or listed[0].get("id") != run_id or
            listed[0].get("head_sha") != head_sha or
            listed[0].get("head_branch") != "main" or
            listed[0].get("event") != "workflow_dispatch" or
            listed[0].get("run_attempt") != 1):
        raise RewrapError("single_dispatch_unproved")


def prepare(output_dir: Path, source_token: str, vault_token: str) -> None:
    if not source_token or not vault_token or output_dir.exists():
        raise RewrapError("input_invalid")
    output_dir.mkdir(mode=0o700)
    original_zip = output_dir.parent / "c-actions-source.zip"
    original_manifest = output_dir.parent / "c-actions-source.manifest.json"
    try:
        fetch_exact_artifact(source_token, original_zip, original_manifest)
        verify_destination_audience(vault_token)
        item = _api_json(
            f"/repos/{DESTINATION_REPOSITORY}/contents/{DESTINATION_PATH}", vault_token
        )
        if item.get("type") != "file" or item.get("path") != DESTINATION_PATH:
            raise RewrapError("vault_item_invalid")
        blob_sha = item.get("sha")
        if (item.get("size") != EXPECTED_BYTES or
                not isinstance(blob_sha, str) or
                re.fullmatch(r"[a-f0-9]{40}", blob_sha) is None):
            raise RewrapError("vault_item_invalid")
        blob = _api_json(
            f"/repos/{DESTINATION_REPOSITORY}/git/blobs/{blob_sha}", vault_token
        )
        if blob.get("encoding") != "base64" or blob.get("size") != EXPECTED_BYTES:
            raise RewrapError("vault_blob_invalid")
        try:
            ciphertext = base64.b64decode(blob["content"], validate=False)
        except (KeyError, TypeError, ValueError) as exc:
            raise RewrapError("vault_content_invalid") from exc
        if (len(ciphertext) != EXPECTED_BYTES or
                hashlib.sha256(ciphertext).hexdigest() != EXPECTED_SHA256 or
                not ciphertext.startswith(b"age-encryption.org/v1\n")):
            raise RewrapError("vault_ciphertext_mismatch")
        with zipfile.ZipFile(original_zip) as bundle:
            names = bundle.namelist()
            manifests = [name for name in names if name.endswith(".manifest.json")]
            if len(manifests) != 1:
                raise RewrapError("source_manifest_shape_invalid")
            manifest = json.loads(bundle.read(manifests[0]))
        if manifest.get("archiveSha256") == EXPECTED_SHA256:
            raise RewrapError("source_manifest_not_original")
        manifest["archiveSha256"] = EXPECTED_SHA256
        archive_name = f"{BACKUP_ID}.dump.age"
        manifest_name = f"{BACKUP_ID}.manifest.json"
        manifest_bytes = (json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n").encode()
        outputs = {
            archive_name: ciphertext,
            manifest_name: manifest_bytes,
            f"{BACKUP_ID}.checksums.sha256": (
                f"{EXPECTED_SHA256}  {archive_name}\n"
                f"{hashlib.sha256(manifest_bytes).hexdigest()}  {manifest_name}\n"
            ).encode(),
        }
        for name, contents in outputs.items():
            path = output_dir / name
            with path.open("xb") as file:
                file.write(contents)
            path.chmod(0o600)
    finally:
        original_zip.unlink(missing_ok=True)
        original_manifest.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("single-dispatch", "prepare"):
            raise RewrapError("mode_invalid")
        if sys.argv[1] == "single-dispatch":
            require_single_dispatch(
                os.environ["GH_TOKEN"], int(os.environ["GITHUB_RUN_ID"]),
                os.environ["GITHUB_SHA"],
            )
            print("C_RECOVERY_DISPATCH status=PASS count=1 attempt=1")
        else:
            prepare(
                Path(os.environ["BACKUP_DIR"]),
                os.environ["GH_TOKEN"],
                os.environ["B11_VAULT_CONTENTS_TOKEN"],
            )
            print("C_RECOVERY_SOURCE status=PASS ciphertext=exact manifest=derived")
    except RewrapError as exc:
        print(f"C_RECOVERY_SOURCE status=FAIL reason={exc}", file=sys.stderr)
        raise SystemExit(1) from None
    except BaseException:
        print("C_RECOVERY_SOURCE status=FAIL reason=unexpected", file=sys.stderr)
        raise SystemExit(1) from None
