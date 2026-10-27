#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077

emit_result() {
  printf 'C_RECIPIENT_DIAGNOSTIC outcome=%s stage=%s\n' "$1" "$2"
}

expected_recipient="${B11_TRUSTED_RECIPIENT:-}"
image="${RECIPIENT_DIAGNOSTIC_IMAGE:-}"
age_keygen="${AGE_KEYGEN_PATH:-}"
container_validator="${DIAGNOSTIC_SCRIPT_PATH:-}"

container_output=''
if ! container_output="$(
  docker run --rm --interactive \
    --pull never \
    --network none \
    --read-only \
    --log-driver none \
    --tmpfs /run/recipient-diagnostic:rw,noexec,nosuid,nodev,size=64k,uid=65534,gid=65534,mode=0700 \
    --mount "type=bind,source=$age_keygen,target=/usr/local/bin/age-keygen,readonly" \
    --user 65534:65534 \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --pids-limit 16 \
    --memory 64m \
    --memory-swap 64m \
    --ulimit core=0 \
    --env "B11_TRUSTED_RECIPIENT=$expected_recipient" \
    --mount "type=bind,source=$container_validator,target=/usr/local/bin/recipient-diagnostic,readonly" \
    --entrypoint /usr/local/bin/recipient-diagnostic \
    "$image" 2>/dev/null
)"; then
  emit_result INCONCLUSIVE container
  exit 0
fi

case "$container_output" in
  'VALID_MATCH recipient_compare') emit_result VALID_MATCH recipient_compare ;;
  'VALID_MISMATCH recipient_compare') emit_result VALID_MISMATCH recipient_compare ;;
  'INVALID_FORMAT identity_format') emit_result INVALID_FORMAT identity_format ;;
  'INCONCLUSIVE secret_input') emit_result INCONCLUSIVE secret_input ;;
  'INCONCLUSIVE container') emit_result INCONCLUSIVE container ;;
  'INCONCLUSIVE identity_output') emit_result INCONCLUSIVE identity_output ;;
  *) emit_result INCONCLUSIVE container_output ;;
esac
