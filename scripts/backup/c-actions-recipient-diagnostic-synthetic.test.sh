#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
validator="$script_dir/c-actions-recipient-diagnostic-container.sh"
tmpdir="$(mktemp -d)"
trap 'rm -rf -- "$tmpdir"' EXIT
chmod 0700 "$tmpdir"
runtime_dir="$tmpdir/runtime"
mkdir -m 0700 "$runtime_dir"

fake_age_keygen="$tmpdir/age-keygen"
cat >"$fake_age_keygen" <<'FAKE_AGE_KEYGEN'
#!/bin/sh
set -eu

if [ "$#" -ne 2 ] || [ "$1" != -y ]; then
  exit 1
fi

identity_count=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|'#'*) continue ;;
    AGE-SECRET-KEY-1-SYNTHETIC-ONLY) identity_count=$((identity_count + 1)) ;;
    *) exit 1 ;;
  esac
done <"$2"

if [ "$identity_count" -ne 1 ]; then
  exit 1
fi

printf '%s\n' "$SYNTHETIC_RECIPIENT"
FAKE_AGE_KEYGEN
chmod 0700 "$fake_age_keygen"

fake_bin="$tmpdir/bin"
mkdir -m 0700 "$fake_bin"
cat >"$fake_bin/docker" <<'FAKE_DOCKER'
#!/bin/sh
set -eu

arguments=" $* "
for required in \
  '--network none' \
  '--read-only' \
  '--log-driver none' \
  '--memory-swap 64m' \
  '--ulimit core=0' \
  '--entrypoint /usr/local/bin/recipient-diagnostic'; do
  case "$arguments" in
    *" $required "*) ;;
    *) exit 2 ;;
  esac
done
case "$arguments" in
  *'target=/usr/local/bin/age-keygen,readonly'*) ;;
  *) exit 2 ;;
esac
case "$arguments" in
  *'target=/usr/local/bin/recipient-diagnostic,readonly'*) ;;
  *) exit 2 ;;
esac
printf '%s' "$arguments" | awk -F 'target=/usr/local/bin/age-keygen,readonly' 'END { if (NF != 2) exit 2 }'
printf '%s' "$arguments" | awk -F 'target=/usr/local/bin/recipient-diagnostic,readonly' 'END { if (NF != 2) exit 2 }'

exec env \
  AGE_KEYGEN_PATH="$SYNTHETIC_AGE_KEYGEN_PATH" \
  B11_TRUSTED_RECIPIENT="$SYNTHETIC_RECIPIENT" \
  SYNTHETIC_RECIPIENT="$SYNTHETIC_RECIPIENT" \
  sh "$SYNTHETIC_VALIDATOR" "$SYNTHETIC_RUNTIME_DIR"
FAKE_DOCKER
chmod 0700 "$fake_bin/docker"

synthetic_recipient='age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
other_recipient='age1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
valid_fixture='# age synthetic fixture\n\nAGE-SECRET-KEY-1-SYNTHETIC-ONLY\n# trailing comment\n\n'

run_case() {
  local expected="$1"
  local recipient="$2"
  local input="$3"
  local wanted="$4"
  local actual

  actual="$(printf '%b' "$input" | env -i \
    PATH="$PATH" \
    B11_TRUSTED_RECIPIENT="$expected" \
    AGE_KEYGEN_PATH="$fake_age_keygen" \
    SYNTHETIC_RECIPIENT="$recipient" \
    sh "$validator" "$runtime_dir")"
  if [[ "$actual" != "$wanted" ]]; then
    printf 'synthetic recipient diagnostic case failed: expected=%s actual=%s\n' "$wanted" "$actual" >&2
    exit 1
  fi
  if [[ -e "$runtime_dir/identity" ]]; then
    printf '%s\n' 'synthetic recipient diagnostic left identity staging behind' >&2
    exit 1
  fi
}

run_case "$synthetic_recipient" "$synthetic_recipient" "$valid_fixture" 'VALID_MATCH recipient_compare'
run_case "$other_recipient" "$synthetic_recipient" "$valid_fixture" 'VALID_MISMATCH recipient_compare'
run_case "$synthetic_recipient" "$synthetic_recipient" 'AGE-SECRET-KEY-1-MALFORMED\n' 'INVALID_FORMAT identity_format'
run_case "$synthetic_recipient" "$synthetic_recipient" '' 'INCONCLUSIVE secret_input'

host_result="$(printf '%b' "$valid_fixture" | env -i \
  PATH="$fake_bin:$PATH" \
  B11_TRUSTED_RECIPIENT="$synthetic_recipient" \
  RECIPIENT_DIAGNOSTIC_IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3' \
  AGE_KEYGEN_PATH="$fake_age_keygen" \
  DIAGNOSTIC_SCRIPT_PATH="$validator" \
  SYNTHETIC_AGE_KEYGEN_PATH="$fake_age_keygen" \
  SYNTHETIC_RECIPIENT="$synthetic_recipient" \
  SYNTHETIC_VALIDATOR="$validator" \
  SYNTHETIC_RUNTIME_DIR="$runtime_dir" \
  bash "$script_dir/c-actions-recipient-diagnostic.sh")"
if [[ "$host_result" != 'C_RECIPIENT_DIAGNOSTIC outcome=VALID_MATCH stage=recipient_compare' ]]; then
  printf 'synthetic host wrapper case failed: actual=%s\n' "$host_result" >&2
  exit 1
fi
if [[ -e "$runtime_dir/identity" ]]; then
  printf '%s\n' 'synthetic host wrapper left identity staging behind' >&2
  exit 1
fi

printf '%s\n' 'C_RECIPIENT_DIAGNOSTIC_SYNTHETIC outcome=PASS cases=5'
