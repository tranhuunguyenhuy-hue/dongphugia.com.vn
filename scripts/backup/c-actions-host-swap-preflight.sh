#!/usr/bin/env bash
set -euo pipefail
set +x

read_swap_total_kib() {
  awk '$1 == "SwapTotal:" { print $2; found = 1 } END { if (!found) exit 1 }' /proc/meminfo
}

read_active_swap_devices() {
  awk 'NR > 1 { count++ } END { print count + 0 }' /proc/swaps
}

before_total="$(read_swap_total_kib)"
before_devices="$(read_active_swap_devices)"
printf 'C_RECIPIENT_HOST_SWAP phase=before total_kib=%s active_devices=%s\n' "$before_total" "$before_devices"

if (( EUID == 0 )); then
  swapoff --all
else
  sudo -n swapoff --all
fi

after_total="$(read_swap_total_kib)"
after_devices="$(read_active_swap_devices)"
printf 'C_RECIPIENT_HOST_SWAP phase=after total_kib=%s active_devices=%s\n' "$after_total" "$after_devices"

if [[ ! "$after_total" =~ ^0+$ || "$after_devices" != 0 ]]; then
  printf 'C_RECIPIENT_HOST_SWAP outcome=STOP stage=disable_or_verify\n' >&2
  exit 1
fi

printf 'C_RECIPIENT_HOST_SWAP outcome=PASS\n'
