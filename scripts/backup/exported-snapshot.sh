#!/usr/bin/env bash

# Shared lifecycle for a PostgreSQL exported snapshot. Callers own the EXIT
# trap and must invoke cleanup_snapshot_keeper so an interrupted operation
# cannot leave the exporting transaction open.
snapshot_keeper_pid=''
snapshot_keeper_started='false'
exported_snapshot_id=''
snapshot_keeper_failure_reason=''

cleanup_snapshot_keeper() {
  local statement="${1:-ROLLBACK}"
  if [[ "$snapshot_keeper_started" != 'true' ]]; then
    return 0
  fi

  set +e
  if kill -0 "$snapshot_keeper_pid" >/dev/null 2>&1; then
    printf '%s;\n\\q\n' "$statement" >&9 2>/dev/null
  fi
  exec 9>&-
  wait "$snapshot_keeper_pid" >/dev/null 2>&1
  snapshot_keeper_started='false'
  set -e
}

finalize_snapshot_keeper() {
  local statement="$1"
  local status=0

  if ! printf '%s;\n\\q\n' "$statement" >&9; then
    status=1
  fi
  exec 9>&-
  if ! wait "$snapshot_keeper_pid"; then
    status=1
  fi
  snapshot_keeper_started='false'
  return "$status"
}

start_snapshot_keeper() {
  local database_url="$1"
  local workspace="$2"
  local psql_bin="${PSQL_BIN:-psql}"
  local snapshot_keeper_control="$workspace/snapshot-control"
  local snapshot_id_file="$workspace/snapshot.id"
  local candidate=''

  # These globals are the deliberately narrow result channel for callers that
  # source this lifecycle helper.
  # shellcheck disable=SC2034
  exported_snapshot_id=''
  # shellcheck disable=SC2034
  snapshot_keeper_failure_reason='snapshot_export_failed'
  if ! mkfifo "$snapshot_keeper_control"; then
    # shellcheck disable=SC2034
    snapshot_keeper_failure_reason='snapshot_control_create_failed'
    return 1
  fi
  if ! { exec 9<>"$snapshot_keeper_control"; }; then
    # shellcheck disable=SC2034
    snapshot_keeper_failure_reason='snapshot_control_open_failed'
    return 1
  fi
  "$psql_bin" "$database_url" -X -q -A -t -v ON_ERROR_STOP=1 \
    <&9 >"$workspace/snapshot-keeper.output" 2>"$workspace/snapshot-keeper.error" &
  snapshot_keeper_pid="$!"
  snapshot_keeper_started='true'

  if ! printf '\\o %s\n%s\n%s\n\\o\n' \
    "$snapshot_id_file" \
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' \
    'SELECT pg_export_snapshot();' \
    >&9; then
    # shellcheck disable=SC2034
    snapshot_keeper_failure_reason='snapshot_keeper_start_failed'
    return 1
  fi

  for _ in {1..200}; do
    if [[ -s "$snapshot_id_file" ]]; then
      candidate="$(tr -d '\r\n' <"$snapshot_id_file")"
      break
    fi
    if ! kill -0 "$snapshot_keeper_pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
  if [[ -z "$candidate" ]]; then
    # shellcheck disable=SC2034
    snapshot_keeper_failure_reason='snapshot_export_failed'
    return 1
  fi
  if [[ ! "$candidate" =~ ^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$ ]]; then
    # shellcheck disable=SC2034
    snapshot_keeper_failure_reason='snapshot_identifier_invalid'
    return 1
  fi

  # shellcheck disable=SC2034
  exported_snapshot_id="$candidate"
}
