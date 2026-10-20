#!/usr/bin/env bash
set -euo pipefail

: "${MODE:?MODE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${EXPECTED_PR_NUMBER:?EXPECTED_PR_NUMBER is required}"
: "${EXPECTED_CANDIDATE_SHA:?EXPECTED_CANDIDATE_SHA is required}"
: "${EXPECTED_CONTROL_SHA:?EXPECTED_CONTROL_SHA is required}"
: "${EXPECTED_MERGE_SHA:?EXPECTED_MERGE_SHA is required}"
: "${EXPECTED_WORKFLOW_RUN_ID:?EXPECTED_WORKFLOW_RUN_ID is required}"

if [[ "$MODE" != 'rehearsal' && "$MODE" != 'preflight' && "$MODE" != 'apply' ]]; then
  echo 'CATALOGUE_REHOME status=FAIL reason=mode must be rehearsal, preflight, or apply'
  exit 1
fi
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
contract="$repo_root/scripts/backup/catalogue-restore-contract.mjs"
target_contract="$repo_root/scripts/backup/supabase-runtime-target.mjs"
psql_wrapper="$repo_root/scripts/backup/supabase-runtime-psql.mjs"
preflight_sql="$repo_root/scripts/backup/catalogue-rehome-preflight.sql"
postgres_image="${POSTGRES_IMAGE:-postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3}"

tmp_parent='/dev/shm'
if ! command -v findmnt >/dev/null 2>&1 \
   || [[ ! -d "$tmp_parent" ]] \
   || [[ "$(findmnt --noheadings --output FSTYPE --target "$tmp_parent" | xargs)" != 'tmpfs' ]]; then
  echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=tmpfs_unavailable'
  exit 1
fi
tmp_dir="$(mktemp --directory "$tmp_parent/catalogue-rehome.XXXXXX")"
container_name="catalogue-rehome-${RANDOM}${RANDOM}"
container_started='false'

cleanup() {
  if [[ "$container_started" == 'true' ]]; then
    docker rm --force "$container_name" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

for command in age docker findmnt jq node sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "CATALOGUE_REHOME status=FAIL stage=preflight reason=missing_${command}"
    exit 1
  }
done

if [[ "$MODE" == 'rehearsal' ]]; then
  # Rehearsal handles the full source dump. Reject remote daemons and image pulls
  # before decryption, and keep all generated evidence inside the guest tmpfs.
  # shellcheck source=scripts/backup/postgres-image-pin.sh
  source "$repo_root/scripts/backup/postgres-image-pin.sh"
  if ! postgres_image="$(dpg_resolve_postgres_image)"; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_image_reference_invalid'
    exit 1
  fi
  if [[ -n "${SUPABASE_REHOME_DATABASE_URL:-}" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=remote_target_present'
    exit 1
  fi
  if ! command -v ip >/dev/null 2>&1 ||
     ! route4="$(ip -4 route show default 2>/dev/null)" ||
     ! route6="$(ip -6 route show default 2>/dev/null)" ||
     [[ -n "$route4$route6" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=guest_network_not_isolated'
    exit 1
  fi
  for interface in /sys/class/net/*; do
    case "${interface##*/}" in
      lo|docker0) ;;
      *) echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=guest_network_not_isolated'; exit 1 ;;
    esac
  done
  if [[ -n "${DOCKER_HOST:-}" && "$DOCKER_HOST" != unix://* ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=docker_remote_daemon_disallowed'
    exit 1
  fi
  docker_context="${DOCKER_CONTEXT:-}"
  if [[ -z "$docker_context" && -z "${DOCKER_HOST:-}" ]]; then
    docker_context="$(docker context show 2>/dev/null)" || {
      echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=docker_context_unavailable'
      exit 1
    }
  fi
  if [[ -n "$docker_context" ]]; then
    docker_endpoint="$(docker context inspect --format '{{(index .Endpoints "docker").Host}}' "$docker_context" 2>/dev/null)" || {
      echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=docker_context_unavailable'
      exit 1
    }
  else
    docker_endpoint="$DOCKER_HOST"
  fi
  if [[ "$docker_endpoint" != unix://* ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=docker_remote_daemon_disallowed'
    exit 1
  fi
  if ! image_platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$postgres_image" 2>/dev/null)"; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_image_not_cached'
    exit 1
  fi
  case "$(uname -m)" in
    aarch64|arm64) expected_platform='linux/arm64' ;;
    *) echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=unsupported_host_arch'; exit 1 ;;
  esac
  if [[ "$image_platform" != "$expected_platform" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_image_platform_mismatch'
    exit 1
  fi
  output_dir="${OUTPUT_DIR:-$tmp_dir/evidence}"
  if ! command -v realpath >/dev/null 2>&1 ||
     [[ "$output_dir" != /dev/shm/* || "$(realpath -m -- "$output_dir")" != /dev/shm/* ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=evidence_workspace_not_tmpfs'
    exit 1
  fi
  mkdir -p "$output_dir"
  if [[ -L "$output_dir" ||
        "$(findmnt --noheadings --output FSTYPE --target "$output_dir" | xargs)" != 'tmpfs' ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=evidence_workspace_not_tmpfs'
    exit 1
  fi
  chmod 700 "$output_dir"
else
  output_dir="${OUTPUT_DIR:-${RUNNER_TEMP:?RUNNER_TEMP is required}/catalogue-rehome-evidence}"
  mkdir -p "$output_dir"
fi

shopt -s nullglob
archives=("$BACKUP_DIR"/*.dump.age)
manifests=("$BACKUP_DIR"/*.manifest.json)
checksum_files=("$BACKUP_DIR"/*.checksums.sha256)
shopt -u nullglob
if [[ "${#archives[@]}" != '1' || "${#manifests[@]}" != '1' || "${#checksum_files[@]}" != '1' ]]; then
  echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=backup_bundle_shape_invalid'
  exit 1
fi
archive="${archives[0]}"
manifest="${manifests[0]}"
checksums="${checksum_files[0]}"

if ! (cd "$BACKUP_DIR" && sha256sum -c "$(basename "$checksums")" >/dev/null); then
  echo 'CATALOGUE_REHOME status=FAIL stage=checksum reason=checksum_mismatch'
  exit 1
fi
node "$repo_root/scripts/backup/manifest-contract.mjs" validate "$manifest" >/dev/null
node "$contract" validate-source "$manifest" \
  "$EXPECTED_PR_NUMBER" "$EXPECTED_CANDIDATE_SHA" "$EXPECTED_CONTROL_SHA" \
  "$EXPECTED_WORKFLOW_RUN_ID" "$EXPECTED_MERGE_SHA" >/dev/null

validate_target_url() {
  node "$target_contract" validate-url >/dev/null
}

sensitive_failure() {
  local stage="$1"
  rm -f "$tmp_dir/sensitive.error"
  echo "CATALOGUE_REHOME status=FAIL stage=$stage reason=sensitive_operation_failed"
  exit 1
}

if [[ "$MODE" == 'preflight' ]]; then
  : "${SUPABASE_REHOME_DATABASE_URL:?SUPABASE_REHOME_DATABASE_URL is required}"
  command -v psql >/dev/null 2>&1 || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=missing_psql'
    exit 1
  }
  validate_target_url || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=target_url_mismatch'
    exit 1
  }
  if ! SUPABASE_PSQL_TMPDIR="$tmp_dir" node "$psql_wrapper" --file "$preflight_sql" \
    >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure remote_preflight
  fi
  rm -f "$tmp_dir/sensitive.error"
  echo 'CATALOGUE_REHOME status=PASS mode=preflight target=exact empty=true'
  exit 0
fi

if [[ -n "${AGE_IDENTITY_FILE:-}" ]]; then
  if [[ -n "${AGE_IDENTITY:-}" || ! -f "$AGE_IDENTITY_FILE" || -L "$AGE_IDENTITY_FILE" ||
        "$(findmnt --noheadings --output FSTYPE --target "$AGE_IDENTITY_FILE" | xargs)" != 'tmpfs' ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_identity_file_invalid'
    exit 1
  fi
  cat -- "$AGE_IDENTITY_FILE" >"$tmp_dir/age-identity"
else
  : "${AGE_IDENTITY:?AGE_IDENTITY or AGE_IDENTITY_FILE is required}"
  printf '%s\n' "$AGE_IDENTITY" >"$tmp_dir/age-identity"
fi
chmod 600 "$tmp_dir/age-identity"
plain_dump="$tmp_dir/runtime.dump"
if ! age --decrypt --identity "$tmp_dir/age-identity" --output "$plain_dump" "$archive" \
  2>"$tmp_dir/sensitive.error"; then
  sensitive_failure decrypt
fi
rm -f "$tmp_dir/age-identity"
rm -f "$tmp_dir/sensitive.error"

mapfile -t restore_table_args < <(node "$contract" table-args)
test "${#restore_table_args[@]}" -gt 0

if [[ "$MODE" == 'rehearsal' ]]; then
  docker run --rm --detach --name "$container_name" --pull=never --log-driver=none \
    --network none --read-only --pids-limit 256 --memory 1536m \
    --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g \
    --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m \
    --tmpfs /var/run/postgresql:rw,nosuid,nodev,noexec,size=64m \
    --env POSTGRES_HOST_AUTH_METHOD=trust "$postgres_image" >/dev/null
  container_started='true'
  test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")" = 'none'
  test "$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_name")" = 'none'
  test "$(docker inspect --format '{{len .Mounts}}' "$container_name")" = '0'
  test "$(docker inspect --format '{{len .HostConfig.Tmpfs}}' "$container_name")" -ge 3
  ready='false'
  for _ in {1..45}; do
    if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then ready='true'; break; fi
    sleep 1
  done
  test "$ready" = 'true'

  docker exec -i "$container_name" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 <<'SQL'
create role dpg_migration noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role dpg_runtime noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role dpg_readonly noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role dpg_backup noinherit nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create database source;
create database target;
SQL

  if ! docker exec -i "$container_name" \
    pg_restore -U postgres -d source --exit-on-error --no-owner --no-privileges \
      <"$plain_dump" >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_source_restore
  fi
  if ! node "$contract" snapshot-sql | docker exec -i "$container_name" \
    psql -U postgres -d source -X -q -A -t -v ON_ERROR_STOP=1 \
      >"$output_dir/catalogue-expected.json" 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_source_manifest
  fi

  if ! docker exec -i "$container_name" \
    pg_restore -U postgres -d target --schema-only --exit-on-error --no-owner --no-privileges \
      <"$plain_dump" >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_schema_restore
  fi
  for table_arg in "${restore_table_args[@]}"; do
    if ! docker exec -i "$container_name" \
      pg_restore --data-only --no-owner --no-privileges --exit-on-error \
        --schema=dpg_app --strict-names \
        "$table_arg" -U postgres -d target <"$plain_dump" \
        >/dev/null 2>"$tmp_dir/sensitive.error"; then
      sensitive_failure rehearsal_catalogue_restore
    fi
  done
  if ! node "$contract" rehearsal-target-check-sql | docker exec -i "$container_name" \
    psql -U postgres -d target -X -q -v ON_ERROR_STOP=1 \
      >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_target_exclusions
  fi
  if ! node "$contract" snapshot-sql | docker exec -i "$container_name" \
    psql -U postgres -d target -X -q -A -t -v ON_ERROR_STOP=1 \
      >"$tmp_dir/catalogue-actual.json" 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_target_manifest
  fi
  rm -f "$tmp_dir/sensitive.error"
  node "$contract" compare "$output_dir/catalogue-expected.json" \
    "$tmp_dir/catalogue-actual.json" >/dev/null
  echo 'CATALOGUE_REHOME status=PASS mode=rehearsal network=none filtered=true'
  exit 0
fi

: "${SUPABASE_REHOME_DATABASE_URL:?SUPABASE_REHOME_DATABASE_URL is required}"
: "${EXPECTED_CATALOGUE_MANIFEST:?EXPECTED_CATALOGUE_MANIFEST is required}"
command -v psql >/dev/null 2>&1 || {
  echo 'CATALOGUE_REHOME status=FAIL stage=apply reason=missing_psql'
  exit 1
}
validate_target_url || {
  echo 'CATALOGUE_REHOME status=FAIL stage=apply reason=target_url_mismatch'
  exit 1
}

restore_sql="$tmp_dir/catalogue-restore.sql"
validation_sql="$tmp_dir/catalogue-validation.sql"
sequence_sql="$tmp_dir/catalogue-sequences.sql"
driver_sql="$tmp_dir/catalogue-driver.sql"

: >"$restore_sql"
for table_arg in "${restore_table_args[@]}"; do
  if ! docker run --rm --network none --read-only \
    --volume "$tmp_dir:/work:rw" "$postgres_image" \
    pg_restore --data-only --no-owner --no-privileges --exit-on-error \
      --schema=dpg_app --strict-names \
      "$table_arg" --file - /work/runtime.dump >>"$restore_sql" \
      2>"$tmp_dir/sensitive.error"; then
    sensitive_failure generate_catalogue_restore
  fi
done
node "$contract" validation-sql "$EXPECTED_CATALOGUE_MANIFEST" >"$validation_sql"
node "$contract" sequence-sql >"$sequence_sql"

printf '%s\n' \
  '\set ON_ERROR_STOP on' \
  'begin transaction isolation level serializable;' \
  "\\i '$preflight_sql'" \
  "\\i '$restore_sql'" \
  "\\i '$sequence_sql'" \
  "\\i '$validation_sql'" \
  'commit;' >"$driver_sql"

if ! SUPABASE_PSQL_TMPDIR="$tmp_dir" node "$psql_wrapper" --file "$driver_sql" \
  >/dev/null 2>"$tmp_dir/sensitive.error"; then
  sensitive_failure remote_apply
fi
if ! node "$contract" snapshot-sql | SUPABASE_PSQL_TMPDIR="$tmp_dir" \
  node "$psql_wrapper" --tuples-only >"$output_dir/catalogue-actual.json" \
  2>"$tmp_dir/sensitive.error"; then
  sensitive_failure remote_manifest
fi
rm -f "$tmp_dir/sensitive.error"
node "$contract" compare "$EXPECTED_CATALOGUE_MANIFEST" \
  "$output_dir/catalogue-actual.json" >/dev/null
echo 'CATALOGUE_REHOME status=PASS mode=apply target=exact transaction=committed'
