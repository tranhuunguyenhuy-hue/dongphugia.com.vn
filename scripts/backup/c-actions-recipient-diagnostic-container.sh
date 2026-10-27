#!/bin/sh

set -eu
set +x
umask 077

emit_result() {
  printf '%s %s\n' "$1" "$2"
}

expected_recipient="${B11_TRUSTED_RECIPIENT:-}"
age_keygen="${AGE_KEYGEN_PATH:-/usr/local/bin/age-keygen}"
runtime_dir="${1:-/run/recipient-diagnostic}"
identity_file="$runtime_dir/identity"
recipient=''

cleanup() {
  rm -f -- "$identity_file" 2>/dev/null || :
  unset recipient
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if ! cat >"$identity_file"; then
  emit_result INCONCLUSIVE secret_input
  exit 0
fi

if [ ! -s "$identity_file" ]; then
  emit_result INCONCLUSIVE secret_input
  exit 0
fi

# Let age-keygen parse the complete identity file. Its supported comment and
# blank-line format must not be rejected by a wrapper line-count check.
if ! recipient=$("$age_keygen" -y "$identity_file" 2>/dev/null); then
  emit_result INVALID_FORMAT identity_format
  exit 0
fi

case "$recipient" in
  age1*) ;;
  *)
    emit_result INVALID_FORMAT identity_format
    exit 0
    ;;
esac

case "$recipient" in
  *'
'*)
    emit_result INCONCLUSIVE identity_output
    exit 0
    ;;
esac

if [ "$recipient" = "$expected_recipient" ]; then
  emit_result VALID_MATCH recipient_compare
else
  emit_result VALID_MISMATCH recipient_compare
fi
