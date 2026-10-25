"""Offline candidate: verify an exact encrypted artifact and rewrap its archive.

This module has no network or GitHub API capability. Never pass real keys or
protected backup bytes to its tests or to a Codex session.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import resource
import select
import signal
import subprocess
import sys
import threading
import time
import zipfile
from pathlib import Path


class RewrapError(Exception):
    pass


_HEX64 = re.compile(r"[0-9a-f]{64}\Z")
_RECIPIENT = re.compile(r"age1[023456789acdefghjklmnpqrstuvwxyz]{20,120}\Z")
_MAX_MEMBER_BYTES = 64 * 1024 * 1024
HISTORICAL_RUN_HEAD = "ce64e8cc7caf91b8bf2e4e2315d49e21bacdfffc"
HISTORICAL_RUN_ID = 38915575745
HISTORICAL_ARTIFACT_ID = 12052107648
APPROVED_ZIP_BYTES = 9_286_999
APPROVED_ZIP_SHA256 = "348431a2837ae5c3f473d80f5ca8807242e5bb1e164caf71f740a4bb76049e57"
APPROVED_RECIPIENT = "age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr"
DESTINATION_REPOSITORY = "tranhuunguyenhuy-hue/dpg-ciphertext-vault-20261025"
PINNED_AGE_BINARY_SHA256 = "eb7dd1b518f0a307c99cd97782623c5321da049154b04acd2d98d21aa7bc9b2c"
OUTPUT_NAME = "leo540-38915575745-rewrapped.dump.age"


def verify_approved_artifact_zip(raw: bytes) -> bytes:
    return verify_artifact_zip(
        raw, APPROVED_ZIP_BYTES, APPROVED_ZIP_SHA256,
        expected_backup_id=f"leo540-{HISTORICAL_RUN_ID}",
    )


def verify_artifact_zip(
    raw: bytes, expected_bytes: int, expected_sha256: str, *, expected_backup_id: str | None = None
) -> bytes:
    """Return only the still-encrypted .dump.age bytes after exact verification."""
    if len(raw) != expected_bytes or hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise RewrapError("artifact_identity_mismatch")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
            infos = bundle.infolist()
            if len(infos) != 3 or len({i.filename for i in infos}) != 3:
                raise RewrapError("bundle_shape_invalid")
            if any(
                "/" in i.filename
                or "\\" in i.filename
                or i.is_dir()
                or ((i.external_attr >> 16) & 0o170000) == 0o120000
                or i.file_size > _MAX_MEMBER_BYTES
                for i in infos
            ):
                raise RewrapError("bundle_member_invalid")
            names = [i.filename for i in infos]
            archives = [n for n in names if n.endswith(".dump.age")]
            manifests = [n for n in names if n.endswith(".manifest.json")]
            checksums = [n for n in names if n.endswith(".checksums.sha256")]
            if len(archives) != 1 or len(manifests) != 1 or len(checksums) != 1:
                raise RewrapError("bundle_shape_invalid")
            archive = bundle.read(archives[0])
            manifest_bytes = bundle.read(manifests[0])
            checksum_bytes = bundle.read(checksums[0])
    except (zipfile.BadZipFile, RuntimeError, ValueError, OSError) as exc:
        raise RewrapError("bundle_read_failed") from exc
    try:
        manifest = json.loads(manifest_bytes)
        lines = checksum_bytes.decode("ascii").splitlines()
    except (UnicodeError, ValueError, TypeError) as exc:
        raise RewrapError("manifest_or_checksum_invalid") from exc
    if not isinstance(manifest, dict) or len(lines) != 2:
        raise RewrapError("manifest_or_checksum_invalid")
    if expected_backup_id is not None and (
        manifest.get("backupId") != expected_backup_id
        or archives[0] != f"{expected_backup_id}.dump.age"
        or manifests[0] != f"{expected_backup_id}.manifest.json"
        or checksums[0] != f"{expected_backup_id}.checksums.sha256"
    ):
        raise RewrapError("backup_identity_mismatch")
    entries = {}
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64})  ([A-Za-z0-9._-]+)", line)
        if match is None or match.group(2) in entries:
            raise RewrapError("checksum_format_invalid")
        entries[match.group(2)] = match.group(1)
    archive_sha = hashlib.sha256(archive).hexdigest()
    if (
        set(entries) != {archives[0], manifests[0]}
        or not isinstance(manifest.get("archiveSha256"), str)
        or _HEX64.fullmatch(manifest["archiveSha256"]) is None
        or manifest["archiveSha256"] != archive_sha
        or entries[archives[0]] != archive_sha
        or entries[manifests[0]] != hashlib.sha256(manifest_bytes).hexdigest()
    ):
        raise RewrapError("checksum_mismatch")
    return archive


def stream_rewrap(
    encrypted_archive: bytes,
    identity: bytes,
    recipient: str,
    age_executable: str,
    expected_age_sha256: str,
    *,
    max_ciphertext_bytes: int = _MAX_MEMBER_BYTES,
    timeout_seconds: int = 120,
) -> bytes:
    """Pipe plaintext between age processes; return only new ciphertext bytes.

    Linux-only candidate. Caller must separately pin the age binary, sandbox
    this step, and provision the identity outside Codex capture. No network,
    ZIP download, or destination upload is performed here.
    """
    if _RECIPIENT.fullmatch(recipient) is None or not encrypted_archive or not identity:
        raise RewrapError("input_invalid")
    if len(encrypted_archive) > _MAX_MEMBER_BYTES or len(identity) > 4096:
        raise RewrapError("input_limit_exceeded")
    if not hasattr(os, "memfd_create") or not age_executable.startswith("/"):
        raise RewrapError("platform_or_age_path_invalid")
    if _HEX64.fullmatch(expected_age_sha256) is None or timeout_seconds <= 0:
        raise RewrapError("pin_or_timeout_invalid")
    try:
        with open(age_executable, "rb") as binary:
            digest = hashlib.sha256(binary.read()).hexdigest()
    except OSError as exc:
        raise RewrapError("age_binary_unavailable") from exc
    if digest != expected_age_sha256:
        raise RewrapError("age_binary_pin_mismatch")
    # This core must run as one dedicated worker process. Core dumps are
    # disabled for it and both age children before any identity is loaded.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    fd = os.memfd_create("age-identity", flags=os.MFD_CLOEXEC)
    decrypt = None
    encrypt = None
    writer_error = []
    age_env = {"PATH": "/usr/bin:/bin", "HOME": "/nonexistent", "LANG": "C"}
    try:
        os.write(fd, identity)
        os.lseek(fd, 0, os.SEEK_SET)
        decrypt = subprocess.Popen(
            [age_executable, "--decrypt", "--identity", f"/proc/self/fd/{fd}"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            pass_fds=(fd,),
            close_fds=True,
            env=age_env,
            start_new_session=True,
        )
        encrypt = subprocess.Popen(
            [age_executable, "--encrypt", "--recipient", recipient],
            stdin=decrypt.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            env=age_env,
            start_new_session=True,
        )
        decrypt.stdout.close()

        def feed() -> None:
            try:
                decrypt.stdin.write(encrypted_archive)
                decrypt.stdin.close()
            except (BrokenPipeError, OSError) as exc:
                writer_error.append(exc)

        writer = threading.Thread(target=feed, daemon=True)
        writer.start()
        chunks = []
        total = 0
        deadline = time.monotonic() + timeout_seconds
        output_fd = encrypt.stdout.fileno()
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RewrapError("age_timeout")
            readable, _, _ = select.select([output_fd], [], [], remaining)
            if not readable:
                raise RewrapError("age_timeout")
            chunk = os.read(output_fd, 65536)
            if not chunk:
                break
            total += len(chunk)
            if total > max_ciphertext_bytes:
                raise RewrapError("output_limit_exceeded")
            chunks.append(chunk)
        writer.join(timeout=max(0, deadline - time.monotonic()))
        if writer.is_alive():
            raise RewrapError("input_writer_stalled")
        remaining = max(0, deadline - time.monotonic())
        if decrypt.wait(timeout=remaining) != 0 or encrypt.wait(timeout=remaining) != 0 or writer_error:
            raise RewrapError("age_failed")
        result = b"".join(chunks)
        if not result:
            raise RewrapError("empty_output")
        return result
    except subprocess.TimeoutExpired as exc:
        raise RewrapError("age_timeout") from exc
    except (OSError, subprocess.SubprocessError) as exc:
        raise RewrapError("age_execution_failed") from exc
    finally:
        for process in (decrypt, encrypt):
            if process is not None and process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
        if encrypt is not None and encrypt.stdout is not None:
            encrypt.stdout.close()
        if decrypt is not None and decrypt.stdin is not None and not decrypt.stdin.closed:
            decrypt.stdin.close()
        os.close(fd)


def stream_rewrap_to_approved_recipient(
    encrypted_archive: bytes,
    identity: bytes,
    age_executable: str,
    expected_age_sha256: str,
) -> bytes:
    """Future workflow entry point; executable digest still needs approval."""
    return stream_rewrap(
        encrypted_archive,
        identity,
        APPROVED_RECIPIENT,
        age_executable,
        expected_age_sha256,
    )


def main() -> int:
    """Protected, fixed-path container entry point; no network or API code."""
    try:
        encrypted_archive = verify_approved_artifact_zip(Path("/input/artifact.zip").read_bytes())
        identity = sys.stdin.buffer.read(4097)
        if not identity or len(identity) > 4096:
            raise RewrapError("identity_size_invalid")
        ciphertext = stream_rewrap_to_approved_recipient(
            encrypted_archive, identity, "/opt/age", PINNED_AGE_BINARY_SHA256
        )
        if not ciphertext.startswith(b"age-encryption.org/v1\n"):
            raise RewrapError("ciphertext_header_invalid")
        output_path = f"/output/{OUTPUT_NAME}"
        fd = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, "wb") as output:
                output.write(ciphertext)
        except BaseException:
            os.unlink(output_path)
            raise
        print("B11_REWRAP status=PASS output=ciphertext_only")
        return 0
    except RewrapError as exc:
        print(f"B11_REWRAP status=FAIL reason={exc}", file=sys.stderr)
        return 1
    except BaseException:
        print("B11_REWRAP status=FAIL reason=unexpected", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
