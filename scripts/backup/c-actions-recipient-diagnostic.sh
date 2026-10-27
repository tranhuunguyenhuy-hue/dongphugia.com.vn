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

# The protected workflow validates these non-secret inputs in a separate step
# before it binds B11_RECOVERY_AGE_IDENTITY to the diagnostic process.

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
    --entrypoint /bin/sh \
    "$image" -c '
      set -eu
      umask 077
      identity_file=/run/recipient-diagnostic/identity
      cat >"$identity_file"
      if [ ! -s "$identity_file" ]; then
        printf "%s\\n" "INCONCLUSIVE secret_input"
        exit 0
      fi
      if [ "$(wc -l <"$identity_file")" -ne 1 ]; then
        printf "%s\\n" "INVALID_FORMAT identity_format"
        exit 0
      fi
      IFS= read -r identity <"$identity_file"
      if [ -z "$identity" ]; then
        printf "%s\\n" "INCONCLUSIVE secret_input"
        exit 0
      fi
      unset identity
      if recipient="$(/usr/local/bin/age-keygen -y "$identity_file" 2>/dev/null)"; then
        case "$recipient" in
          age1*) ;;
          *) printf "%s\\n" "INVALID_FORMAT identity_format"; exit 0 ;;
        esac
      else
        printf "%s\\n" "INVALID_FORMAT identity_format"
        exit 0
      fi
      if [ "$recipient" = "$B11_TRUSTED_RECIPIENT" ]; then
        printf "%s\\n" "VALID_MATCH recipient_compare"
      else
        printf "%s\\n" "VALID_MISMATCH recipient_compare"
      fi
    '
)"; then
  emit_result INCONCLUSIVE container
  exit 0
fi

case "$container_output" in
  'VALID_MATCH recipient_compare') emit_result VALID_MATCH recipient_compare ;;
  'VALID_MISMATCH recipient_compare') emit_result VALID_MISMATCH recipient_compare ;;
  'INVALID_FORMAT identity_format') emit_result INVALID_FORMAT identity_format ;;
  'INCONCLUSIVE secret_input') emit_result INCONCLUSIVE secret_input ;;
  *) emit_result INCONCLUSIVE container_output ;;
esac
