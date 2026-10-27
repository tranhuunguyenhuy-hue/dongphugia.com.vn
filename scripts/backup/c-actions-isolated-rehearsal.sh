#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

fail() {
  local stage="$1"
  echo "C_RECOVERY_GATE status=FAIL stage=$stage"
  exit 1
}

if ! command -v ip >/dev/null 2>&1 || [[ ! -d /sys/class/net/lo ]]; then
  fail network_isolation
fi
if ! route4="$(ip -4 route show 2>/dev/null)" ||
   ! route6="$(ip -6 route show 2>/dev/null)" ||
   [[ -n "$route4$route6" ]]; then
  fail network_isolation
fi
for interface in /sys/class/net/*; do
  [[ "${interface##*/}" == lo ]] || fail network_isolation
done

unset DOCKER_CONTEXT
export DOCKER_HOST='unix:///var/run/docker.sock'

identity=''
identity_file=''
cleanup() {
  if [[ -n "$identity_file" ]]; then
    rm -f -- "$identity_file"
  fi
  unset identity B11_RECOVERY_AGE_IDENTITY AGE_IDENTITY AGE_IDENTITY_FILE
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

IFS= read -r identity || fail recipient
[[ -n "$identity" ]] || fail recipient
identity_file="$(mktemp --tmpdir=/dev/shm c-actions-age-identity.XXXXXX)" || fail recipient
chmod 0600 "$identity_file"
printf '%s\n' "$identity" >"$identity_file"
unset identity

recipient="$(age-keygen -y "$identity_file" 2>/dev/null)" || fail recipient
[[ "$recipient" == 'age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr' ]] || fail recipient
echo 'C_RECOVERY_GATE status=PASS recipient=exact'

export AGE_IDENTITY_FILE="$identity_file"
bash scripts/backup/restore-catalogue-runtime.sh
