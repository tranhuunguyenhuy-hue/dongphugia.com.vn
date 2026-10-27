#!/usr/bin/env bash

# Host-side docker cp uses daemon archive extraction, which can reject writes
# into tmpfs mounts when the container root filesystem is read-only. Stream the
# files through docker exec so writes land directly on the approved tmpfs.
stage_container_tmpfs_file() {
  local container_name="$1"
  local source_path="$2"
  local destination="$3"
  local owner="$4"
  local mode="$5"

  case "$destination|$owner|$mode" in
    '/recovery-data/archive.age|postgres:postgres|0400'|\
    '/recovery-tools/age|root:root|0555'|\
    '/recovery-tools/age-keygen|root:root|0555') ;;
    *) return 2 ;;
  esac
  [[ -f "$source_path" && ! -L "$source_path" ]] || return 2

  docker exec --user 0 -i "$container_name" sh -c '
    set -eu
    umask 077
    destination=$1
    owner=$2
    mode=$3
    cat >"$destination"
    chown "$owner" "$destination"
    chmod "$mode" "$destination"
  ' sh "$destination" "$owner" "$mode" <"$source_path" >/dev/null 2>&1
}

# The identity is received only on stdin and stored only on the recovery tmpfs.
# The expected recipient is public; age-keygen validates the protected identity
# inside the network-disabled container.
verify_container_age_identity_from_stdin() {
  local container_name="$1"
  local expected_recipient="$2"
  [[ -n "$expected_recipient" ]] || return 2

  env -u AGE_IDENTITY -u AGE_IDENTITY_FILE \
    docker exec --user postgres -i "$container_name" sh -c '
      set -eu
      umask 077
      identity_file=/recovery-data/age-identity
      cat >"$identity_file"
      chmod 0600 "$identity_file"
      recipient="$(/recovery-tools/age-keygen -y "$identity_file" 2>/dev/null)" || exit 1
      test "$recipient" = "$1"
    ' sh "$expected_recipient" >/dev/null 2>&1
}
