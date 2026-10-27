#!/usr/bin/env python3
"""Stage the exact original encrypted runtime backup without decrypting it."""

from __future__ import annotations

import io
import os
import shutil
import sys
import zipfile
from pathlib import Path

from b11_rewrap_core import (
    APPROVED_ZIP_BYTES,
    APPROVED_ZIP_SHA256,
    HISTORICAL_RUN_ID,
    RewrapError,
    verify_artifact_zip,
)
from b11_rewrap_io import fetch_exact_artifact

BACKUP_ID = f"leo540-{HISTORICAL_RUN_ID}"
EXPECTED_EXPIRES_AT = "2026-10-30T14:27:48Z"


def _write_private_file(path: Path, contents: bytes) -> None:
    descriptor = os.open(
        path,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
        0o600,
    )
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(contents)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def materialize_verified_backup_bundle(
    raw_zip: bytes,
    output_dir: Path,
    *,
    expected_zip_bytes: int,
    expected_zip_sha256: str,
    expected_backup_id: str,
) -> None:
    """Write only the verified ciphertext, manifest, and checksums to a new directory."""
    archive = verify_artifact_zip(
        raw_zip,
        expected_zip_bytes,
        expected_zip_sha256,
        expected_backup_id=expected_backup_id,
    )
    archive_name = f"{expected_backup_id}.dump.age"
    manifest_name = f"{expected_backup_id}.manifest.json"
    checksums_name = f"{expected_backup_id}.checksums.sha256"
    with zipfile.ZipFile(io.BytesIO(raw_zip)) as bundle:
        names = bundle.namelist()
        if len(names) != 3 or set(names) != {archive_name, manifest_name, checksums_name}:
            raise RewrapError("bundle_shape_invalid")
        manifest = bundle.read(manifest_name)
        checksums = bundle.read(checksums_name)

    if output_dir.exists() or output_dir.is_symlink():
        raise RewrapError("output_directory_exists")
    output_dir.mkdir(mode=0o700)
    try:
        _write_private_file(output_dir / archive_name, archive)
        _write_private_file(output_dir / manifest_name, manifest)
        _write_private_file(output_dir / checksums_name, checksums)
    except BaseException:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise


def prepare_original(output_dir: Path, source_token: str) -> None:
    if not source_token or output_dir.exists() or output_dir.is_symlink():
        raise RewrapError("input_invalid")
    original_zip = output_dir.parent / "c-actions-source.zip"
    original_manifest = output_dir.parent / "c-actions-source.manifest.json"
    try:
        fetch_exact_artifact(
            source_token,
            original_zip,
            original_manifest,
            expected_expires_at=EXPECTED_EXPIRES_AT,
        )
        materialize_verified_backup_bundle(
            original_zip.read_bytes(),
            output_dir,
            expected_zip_bytes=APPROVED_ZIP_BYTES,
            expected_zip_sha256=APPROVED_ZIP_SHA256,
            expected_backup_id=BACKUP_ID,
        )
        if (output_dir / f"{BACKUP_ID}.manifest.json").read_bytes() != original_manifest.read_bytes():
            raise RewrapError("source_manifest_mismatch")
    except BaseException:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise
    finally:
        original_zip.unlink(missing_ok=True)
        original_manifest.unlink(missing_ok=True)


def main() -> int:
    try:
        prepare_original(Path(os.environ["BACKUP_DIR"]), os.environ["GH_TOKEN"])
    except RewrapError as exc:
        print(f"C_ORIGINAL_SOURCE status=FAIL reason={exc}", file=sys.stderr)
        return 1
    except BaseException:
        print("C_ORIGINAL_SOURCE status=FAIL reason=unexpected", file=sys.stderr)
        return 1
    print("C_ORIGINAL_SOURCE status=PASS ciphertext=exact manifest=exact")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
