#!/usr/bin/env bash
set -euo pipefail
set +x

image="${RECIPIENT_DIAGNOSTIC_IMAGE:-}"
if [[ "$image" != 'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3' ]]; then
  printf 'C_RECIPIENT_CONTAINER_PREFLIGHT outcome=STOP stage=image_pin\n'
  exit 1
fi

container_output="$(
  docker run --rm --pull never \
    --network none \
    --read-only \
    --log-driver none \
    --tmpfs /run/recipient-diagnostic:rw,noexec,nosuid,nodev,size=64k,uid=65534,gid=65534,mode=0700 \
    --user 65534:65534 \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --pids-limit 16 \
    --memory 64m \
    --memory-swap 64m \
    --ulimit core=0 \
    --entrypoint /bin/sh \
    "$image" -c '
      set -eu
      test "$(id -u)" = 65534
      test "$(ulimit -c)" = 0

      if [ -r /sys/fs/cgroup/memory.swap.max ]; then
        test "$(cat /sys/fs/cgroup/memory.max)" = 67108864
        test "$(cat /sys/fs/cgroup/memory.swap.max)" = 0
      elif [ -r /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes ]; then
        memory_limit="$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)"
        swap_limit="$(cat /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes)"
        test "$memory_limit" = "$swap_limit"
      else
        printf "%s\n" "STOP unsupported_cgroup_swap_control"
        exit 1
      fi

      if ( : > /recipient-diagnostic-write-probe ) 2>/dev/null; then
        exit 1
      fi
      awk '\''$2 == "/run/recipient-diagnostic" && $3 == "tmpfs" { found = 1 } END { exit !found }'\'' /proc/mounts
      test -w /run/recipient-diagnostic
      printf "%s\n" smoke > /run/recipient-diagnostic/probe
      rm /run/recipient-diagnostic/probe

      awk '\''NR > 2 { iface = $1; sub(/:$/, "", iface); seen = 1; if (iface != "lo") other = 1 } END { exit (!seen || other) }'\'' /proc/net/dev
      awk '\''$1 == "CapEff:" { if ($2 != "0000000000000000") exit 1; found = 1 } END { exit !found }'\'' /proc/self/status
      printf "%s\n" "C_RECIPIENT_CONTAINER_PREFLIGHT outcome=PASS"
    '
)"

if [[ "$container_output" != 'C_RECIPIENT_CONTAINER_PREFLIGHT outcome=PASS' ]]; then
  printf 'C_RECIPIENT_CONTAINER_PREFLIGHT outcome=STOP stage=container_controls\n'
  exit 1
fi

printf '%s\n' "$container_output"
