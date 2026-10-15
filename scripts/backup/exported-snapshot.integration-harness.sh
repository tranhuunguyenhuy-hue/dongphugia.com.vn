#!/usr/bin/env bash
set -euo pipefail

: "${SNAPSHOT_TEST_DATABASE_URL:?SNAPSHOT_TEST_DATABASE_URL is required}"
: "${SNAPSHOT_TEST_WORKSPACE:?SNAPSHOT_TEST_WORKSPACE is required}"
: "${SNAPSHOT_TEST_PID_FILE:?SNAPSHOT_TEST_PID_FILE is required}"
: "${SNAPSHOT_TEST_APP_FILE:?SNAPSHOT_TEST_APP_FILE is required}"
: "${SNAPSHOT_TEST_MODE:?SNAPSHOT_TEST_MODE is required}"
: "${POSTGRES_IMAGE:?POSTGRES_IMAGE is required}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$repo_root/scripts/backup/exported-snapshot.sh"
mkdir -p "$SNAPSHOT_TEST_WORKSPACE"

cleanup() {
  cleanup_snapshot_keeper 'ROLLBACK'
  rm -rf "$SNAPSHOT_TEST_WORKSPACE"
}
trap cleanup EXIT

export PGAPPNAME="leo540-snapshot-integration-$$"
printf '%s' "$PGAPPNAME" >"$SNAPSHOT_TEST_APP_FILE"
if ! start_snapshot_keeper "$SNAPSHOT_TEST_DATABASE_URL" "$SNAPSHOT_TEST_WORKSPACE"; then
  echo "SNAPSHOT_INTEGRATION status=FAIL stage=start reason=$snapshot_keeper_failure_reason"
  exit 20
fi
printf '%s' "$snapshot_keeper_pid" >"$SNAPSHOT_TEST_PID_FILE"

case "$SNAPSHOT_TEST_MODE" in
  hold)
    : >"$SNAPSHOT_TEST_WORKSPACE/ready"
    for _ in {1..600}; do
      if [[ -f "$SNAPSHOT_TEST_WORKSPACE/release" ]]; then
        break
      fi
      sleep 0.1
    done
    if [[ ! -f "$SNAPSHOT_TEST_WORKSPACE/release" ]]; then
      echo 'SNAPSHOT_INTEGRATION status=FAIL stage=hold reason=release_timeout'
      exit 21
    fi
    if ! finalize_snapshot_keeper 'COMMIT'; then
      echo 'SNAPSHOT_INTEGRATION status=FAIL stage=finalize reason=keeper_failed'
      exit 22
    fi
    echo 'SNAPSHOT_INTEGRATION status=PASS stage=complete'
    ;;
  manifest-failure)
    if {
      printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'
      printf "SET TRANSACTION SNAPSHOT '%s';\n" "$exported_snapshot_id"
      printf 'SELECT * FROM snapshot_contract_test.missing_manifest_relation;\n'
    } | "${PSQL_BIN:-psql}" "$SNAPSHOT_TEST_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 \
      >/dev/null 2>"$SNAPSHOT_TEST_WORKSPACE/injected-manifest.error"; then
      echo 'SNAPSHOT_INTEGRATION status=FAIL stage=manifest reason=injection_unexpectedly_succeeded'
      exit 23
    fi
    echo 'SNAPSHOT_INTEGRATION status=EXPECTED_FAIL stage=manifest reason=injected_failure'
    exit 41
    ;;
  dump-failure)
    if docker run --rm --network host \
      --env DATABASE_URL="$SNAPSHOT_TEST_DATABASE_URL" \
      --env SNAPSHOT_ID="$exported_snapshot_id" \
      "$POSTGRES_IMAGE" \
      sh -ceu 'pg_dump "$DATABASE_URL" --snapshot="$SNAPSHOT_ID" --table=snapshot_contract_test.missing_dump_relation' \
      >/dev/null 2>"$SNAPSHOT_TEST_WORKSPACE/injected-dump.error"; then
      echo 'SNAPSHOT_INTEGRATION status=FAIL stage=dump reason=injection_unexpectedly_succeeded'
      exit 24
    fi
    echo 'SNAPSHOT_INTEGRATION status=EXPECTED_FAIL stage=dump reason=injected_failure'
    exit 42
    ;;
  *)
    echo 'SNAPSHOT_INTEGRATION status=FAIL stage=preflight reason=unknown_mode'
    exit 25
    ;;
esac
