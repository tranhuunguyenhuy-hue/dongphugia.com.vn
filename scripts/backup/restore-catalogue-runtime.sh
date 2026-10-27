#!/usr/bin/env bash
set -euo pipefail

: "${MODE:?MODE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${EXPECTED_PR_NUMBER:?EXPECTED_PR_NUMBER is required}"
: "${EXPECTED_CANDIDATE_SHA:?EXPECTED_CANDIDATE_SHA is required}"
: "${EXPECTED_CONTROL_SHA:?EXPECTED_CONTROL_SHA is required}"
: "${EXPECTED_MERGE_SHA:?EXPECTED_MERGE_SHA is required}"
: "${EXPECTED_WORKFLOW_RUN_ID:?EXPECTED_WORKFLOW_RUN_ID is required}"

if [[ "$MODE" != 'rehearsal' && "$MODE" != 'preflight' &&
      "$MODE" != 'container-preflight' && "$MODE" != 'apply' ]]; then
  echo 'CATALOGUE_REHOME status=FAIL reason=mode_invalid'
  exit 1
fi
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
contract="$repo_root/scripts/backup/catalogue-restore-contract.mjs"
target_contract="$repo_root/scripts/backup/supabase-runtime-target.mjs"
psql_wrapper="$repo_root/scripts/backup/supabase-runtime-psql.mjs"
preflight_sql="$repo_root/scripts/backup/catalogue-rehome-preflight.sql"
# shellcheck source=scripts/backup/c-actions-container-staging.sh
source "$repo_root/scripts/backup/c-actions-container-staging.sh"
postgres_image="${POSTGRES_IMAGE:-postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3}"
hosted_recovery="${HOSTED_RECOVERY:-false}"
keep_output_dir="${KEEP_OUTPUT_DIR:-false}"
recovery_age_recipient="${EXPECTED_AGE_RECIPIENT:-age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr}"
case "$recovery_age_recipient" in
  age1cvg7hkdl4ctfdfv8a3a4vkcgc7ge7anyls2rn4y62vtnsxuczawqw4h0dr|\
  age12zqtv9r2fc4v2j0kk6v79xrvy66gxcht2uqfxvqske4lzh83uq2qtqhfmc) ;;
  *) echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_recipient_not_allowlisted'; exit 1 ;;
esac
if [[ "$hosted_recovery" != false && "$hosted_recovery" != true ]]; then
  echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=hosted_mode_invalid'
  exit 1
fi
if [[ "$keep_output_dir" != false && "$keep_output_dir" != true ]]; then
  echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=keep_output_dir_invalid'
  exit 1
fi
if [[ "$MODE" == 'apply' && "$hosted_recovery" != true ]]; then
  echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=hosted_apply_required'
  exit 1
fi

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
  if [[ "$hosted_recovery" == true && "$keep_output_dir" != true && -n "${output_dir:-}" ]]; then
    rm -rf "$output_dir"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in age docker findmnt jq node sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "CATALOGUE_REHOME status=FAIL stage=preflight reason=missing_${command}"
    exit 1
  }
done

if [[ "$MODE" == 'rehearsal' || "$MODE" == 'container-preflight' || "$MODE" == 'apply' ]]; then
  # Rehearsal handles the full source dump. Reject remote daemons and image pulls
  # before decryption, and keep generated evidence inside tmpfs.
  # shellcheck source=scripts/backup/postgres-image-pin.sh
  source "$repo_root/scripts/backup/postgres-image-pin.sh"
  if ! postgres_image="$(dpg_resolve_postgres_image)"; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_image_reference_invalid'
    exit 1
  fi
  if [[ "$MODE" == 'rehearsal' || "$MODE" == 'container-preflight' ]]; then
    if [[ -n "${SUPABASE_REHOME_DATABASE_URL:-}" ]]; then
      echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=remote_target_present'
      exit 1
    fi
  elif [[ -z "${SUPABASE_REHOME_DATABASE_URL:-}" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=target_missing'
    exit 1
  fi
  if [[ "$hosted_recovery" == false ]]; then
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
  elif [[ "${GITHUB_ACTIONS:-}" != true || "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
          "${GITHUB_REF:-}" != refs/heads/main ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=hosted_context_invalid'
    exit 1
  fi
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
    x86_64) if [[ "$hosted_recovery" == true ]]; then expected_platform='linux/amd64';
            else echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=unsupported_host_arch'; exit 1; fi ;;
    *) echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=unsupported_host_arch'; exit 1 ;;
  esac
  if [[ "$image_platform" != "$expected_platform" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_image_platform_mismatch'
    exit 1
  fi
  if [[ "$hosted_recovery" == true ]]; then
    available_tmpfs="$(df -B1 --output=avail /dev/shm | tail -1 | xargs)"
    available_disk="$(df -B1 --output=avail "$RUNNER_TEMP" | tail -1 | xargs)"
    available_memory_kib="$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo)"
    [[ "$available_tmpfs" =~ ^[0-9]+$ && "$available_disk" =~ ^[0-9]+$ &&
       "$available_memory_kib" =~ ^[0-9]+$ ]] || exit 1
    if (( available_tmpfs < 6442450944 || available_disk < 4294967296 ||
          available_memory_kib < 6291456 )); then
      echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=runner_capacity_insufficient'
      exit 1
    fi
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

start_rehearsal_container() {
  local pg_tmpfs_size='1g'
  local pg_memory='1536m'
  local pg_memory_bytes='1610612736'
  local postgres_uid
  local postgres_gid
  local mount_report
  local -a recovery_tmpfs=()
  if [[ "$hosted_recovery" == true ]]; then
    # The runner and Docker daemon remain network-connected. The key is sent
    # only over the local Docker socket; key processing and plaintext stay in
    # this network-disabled container.
    pg_tmpfs_size='3g'
    pg_memory='6g'
    pg_memory_bytes='6442450944'
  fi
  postgres_uid="$(docker run --rm --pull=never --network none --read-only \
    --user postgres --entrypoint id "$postgres_image" -u postgres 2>/dev/null)" || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_uid_unavailable'
    return 1
  }
  postgres_gid="$(docker run --rm --pull=never --network none --read-only \
    --user postgres --entrypoint id "$postgres_image" -g postgres 2>/dev/null)" || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_gid_unavailable'
    return 1
  }
  if [[ ! "$postgres_uid" =~ ^[0-9]+$ || ! "$postgres_gid" =~ ^[0-9]+$ ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_identity_invalid'
    return 1
  fi
  if [[ "$hosted_recovery" == true && ( "$postgres_uid" != 999 || "$postgres_gid" != 999 ) ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=postgres_identity_mismatch'
    return 1
  fi
  if [[ "$hosted_recovery" == true ]]; then
    recovery_tmpfs=(
      --tmpfs "/recovery-data:rw,nosuid,nodev,noexec,size=2200m,uid=${postgres_uid},gid=${postgres_gid},mode=0700"
      --tmpfs "/recovery-tools:rw,nosuid,nodev,exec,size=32m,uid=${postgres_uid},gid=${postgres_gid},mode=0700"
    )
  fi
  docker run --rm --detach --name "$container_name" --pull=never --log-driver=none \
    --user "$postgres_uid:$postgres_gid" \
    --network none --read-only --pids-limit 256 --memory "$pg_memory" --memory-swap "$pg_memory" \
    --cap-drop ALL --security-opt no-new-privileges=true --ulimit core=0 \
    --tmpfs "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=${pg_tmpfs_size},uid=${postgres_uid},gid=${postgres_gid},mode=0700" \
    --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=128m,uid=${postgres_uid},gid=${postgres_gid},mode=0700" \
    --tmpfs "/var/run/postgresql:rw,nosuid,nodev,noexec,size=64m,uid=${postgres_uid},gid=${postgres_gid},mode=0700" \
    "${recovery_tmpfs[@]}" \
    --env POSTGRES_HOST_AUTH_METHOD=trust "$postgres_image" >/dev/null
  container_started='true'
  test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")" = 'none'
  test "$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_name")" = 'none'
  test "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container_name")" = 'true'
  test "$(docker inspect --format '{{.Config.User}}' "$container_name")" = "$postgres_uid:$postgres_gid"
  test "$(docker inspect --format '{{json .HostConfig.CapDrop}}' "$container_name")" = '["ALL"]'
  test "$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$container_name")" = '["no-new-privileges=true"]'
  test "$(docker inspect --format '{{.HostConfig.Memory}}' "$container_name")" = "$pg_memory_bytes"
  test "$(docker inspect --format '{{.HostConfig.MemorySwap}}' "$container_name")" = "$pg_memory_bytes"
  container_ulimits="$(docker inspect --format '{{json .HostConfig.Ulimits}}' "$container_name")"
  jq -e 'any(.[]?; .Name == "core" and .Soft == 0 and .Hard == 0)' \
    <<<"$container_ulimits" >/dev/null
  mount_report="$(docker inspect --format '{{range .Mounts}}{{.Type}} {{.Destination}}{{"\n"}}{{end}}' "$container_name")"
  while read -r mount_type mount_target; do
    [[ -z "$mount_type" ]] && continue
    [[ "$mount_type" == tmpfs ]] || return 1
    case "$mount_target" in
      /var/lib/postgresql/data|/tmp|/var/run/postgresql|/recovery-data|/recovery-tools) ;;
      *) return 1 ;;
    esac
  done <<<"$mount_report"
  if [[ "$hosted_recovery" == true ]]; then
    test "$(docker inspect --format '{{len .HostConfig.Tmpfs}}' "$container_name")" -ge 5
  else
    test "$(docker inspect --format '{{len .HostConfig.Tmpfs}}' "$container_name")" -ge 3
  fi
  if ! docker exec --user postgres "$container_name" sh -c '
    set -eu
    test "$(id -u)" -ne 0
    test "$(ulimit -c)" = 0
    awk '\''$1 == "CapEff:" { if ($2 != "0000000000000000") exit 1; found = 1 } END { exit !found }'\'' /proc/self/status
    if [ -r /sys/fs/cgroup/memory.swap.max ]; then
      test "$(cat /sys/fs/cgroup/memory.swap.max)" = 0
    elif [ -r /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes ]; then
      test "$(cat /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes)" = "$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)"
    else
      exit 1
    fi
    awk '\''NR > 2 { iface = $1; sub(/:$/, "", iface); seen = 1; if (iface != "lo") other = 1 } END { exit (!seen || other) }'\'' /proc/net/dev
    if ( : > /recovery-rootfs-write-probe ) 2>/dev/null; then exit 1; fi
  ' >/dev/null 2>&1; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=container_isolation_unproved'
    return 1
  fi
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
create database source;
create database target;
SQL

  # CREATE DATABASE clones template1, not postgres. The archive contains RLS
  # policies that call auth.uid(), so each restore database needs its own stub.
  for database in source target; do
    docker exec -i "$container_name" psql -U postgres -d "$database" -X -q -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
  done
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

mapfile -t restore_table_args < <(node "$contract" table-args)
test "${#restore_table_args[@]}" -gt 0

if [[ "$MODE" == 'rehearsal' || "$MODE" == 'container-preflight' || "$MODE" == 'apply' ]]; then
  start_rehearsal_container
fi

if [[ "$MODE" == 'container-preflight' ]]; then
  echo 'CATALOGUE_REHOME_PREFLIGHT status=PASS container=nonroot readonly network_none swap_zero tmpfs_only'
  exit 0
fi

if [[ "$hosted_recovery" == true ]]; then
  if [[ -n "${AGE_IDENTITY:-}${AGE_IDENTITY_FILE:-}" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=host_identity_environment_disallowed'
    exit 1
  fi
  age_binary="$(command -v age 2>/dev/null)" || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_tools_invalid'
    exit 1
  }
  age_keygen_binary="$(command -v age-keygen 2>/dev/null)" || {
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_tools_invalid'
    exit 1
  }
  if [[ ! -f "$age_binary" || -L "$age_binary" || ! -x "$age_binary" ||
        ! -f "$age_keygen_binary" || -L "$age_keygen_binary" || ! -x "$age_keygen_binary" ]]; then
    echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_tools_invalid'
    exit 1
  fi
  docker exec --user postgres "$container_name" install -d -m 0700 /recovery-data
  docker exec --user postgres "$container_name" install -d -m 0700 /recovery-tools
  stage_container_tmpfs_file "$container_name" "$archive" /recovery-data/archive.age postgres:postgres 0400 ||
    sensitive_failure container_staging
  stage_container_tmpfs_file "$container_name" "$age_binary" /recovery-tools/age postgres:postgres 0555 ||
    sensitive_failure container_staging
  stage_container_tmpfs_file "$container_name" "$age_keygen_binary" /recovery-tools/age-keygen postgres:postgres 0555 ||
    sensitive_failure container_staging

  identity="$(cat)" || {
    echo 'CATALOGUE_REHOME status=FAIL stage=recipient reason=identity_missing'
    exit 1
  }
  if [[ -z "$identity" ]]; then
    unset identity
    echo 'CATALOGUE_REHOME status=FAIL stage=recipient reason=identity_missing'
    exit 1
  fi
  if ! printf '%s' "$identity" |
    verify_container_age_identity_from_stdin "$container_name" "$recovery_age_recipient"; then
    unset identity
    sensitive_failure recipient
  fi
  unset identity
  if ! docker exec --user postgres "$container_name" sh -c '
    set -eu
    umask 077
    /recovery-tools/age --decrypt --identity /recovery-data/age-identity \
      --output /recovery-data/runtime.dump /recovery-data/archive.age 2>/dev/null
    rm -f /recovery-data/age-identity
  ' >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure decrypt
  fi
  plain_bytes="$(docker exec --user postgres "$container_name" stat -c %s /recovery-data/runtime.dump 2>/dev/null)" || sensitive_failure decrypt
  if [[ ! "$plain_bytes" =~ ^[0-9]+$ ]]; then sensitive_failure decrypt; fi
  if (( plain_bytes > 2147483648 )); then
    echo 'CATALOGUE_REHOME status=FAIL stage=capacity reason=source_dump_too_large'
    exit 1
  fi
  plain_dump='/recovery-data/runtime.dump'
else
  if [[ -n "${AGE_IDENTITY_FILE:-}" ]]; then
    if [[ -n "${AGE_IDENTITY:-}" || ! -f "$AGE_IDENTITY_FILE" || -L "$AGE_IDENTITY_FILE" ||
          "$(findmnt --noheadings --output FSTYPE --target "$AGE_IDENTITY_FILE" | xargs)" != 'tmpfs' ]]; then
      echo 'CATALOGUE_REHOME status=FAIL stage=preflight reason=age_identity_file_invalid'
      exit 1
    fi
    cat -- "$AGE_IDENTITY_FILE" >"$tmp_dir/age-identity"
    rm -f -- "$AGE_IDENTITY_FILE"
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
fi
rm -f "$tmp_dir/sensitive.error"

container_pg_restore() {
  if [[ "$hosted_recovery" == true ]]; then
    docker exec --user postgres "$container_name" pg_restore "$@" "$plain_dump"
  else
    docker exec -i "$container_name" pg_restore "$@" <"$plain_dump"
  fi
}

if [[ "$MODE" == 'rehearsal' ]]; then

  if ! container_pg_restore -U postgres -d source --exit-on-error --no-owner --no-privileges \
    >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_source_restore
  fi
  if ! node "$contract" snapshot-sql | docker exec -i "$container_name" \
    psql -U postgres -d source -X -q -A -t -v ON_ERROR_STOP=1 \
      >"$output_dir/catalogue-expected.json" 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_source_manifest
  fi

  if ! container_pg_restore -U postgres -d target --schema-only --exit-on-error --no-owner --no-privileges \
    >/dev/null 2>"$tmp_dir/sensitive.error"; then
    sensitive_failure rehearsal_schema_restore
  fi
  for table_arg in "${restore_table_args[@]}"; do
    if ! container_pg_restore --data-only --no-owner --no-privileges --exit-on-error \
      --schema=dpg_app --strict-names "$table_arg" -U postgres -d target \
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
  if [[ "$hosted_recovery" == true ]]; then
    source_bytes="$(docker exec "$container_name" psql -U postgres -d source -X -A -t -v ON_ERROR_STOP=1 -c "select pg_database_size('source')" 2>/dev/null)" || sensitive_failure rehearsal_capacity
    [[ "$source_bytes" =~ ^[0-9]+$ ]] || sensitive_failure rehearsal_capacity
    target_bytes="$(docker exec "$container_name" psql -U postgres -d target -X -A -t -v ON_ERROR_STOP=1 -c "select pg_database_size('target')" 2>/dev/null)" || sensitive_failure rehearsal_capacity
    [[ "$target_bytes" =~ ^[0-9]+$ ]] || sensitive_failure rehearsal_capacity
    if (( target_bytes >= 367001600 )); then
      echo "CATALOGUE_REHOME_CAPACITY status=STOP source_database_bytes=$source_bytes target_database_bytes=$target_bytes target_ceiling_bytes=367001600"
      echo 'CATALOGUE_REHOME status=FAIL stage=capacity reason=target_database_ceiling'
      exit 1
    fi
    table_count="$(jq -r '.tables | length' "$output_dir/catalogue-expected.json")"
    if [[ "$table_count" != 27 ]]; then
      echo "CATALOGUE_REHOME_EVIDENCE status=STOP tables=$table_count expected_tables=27 source_database_bytes=$source_bytes target_database_bytes=$target_bytes"
      echo 'CATALOGUE_REHOME status=FAIL stage=rehearsal_aggregate reason=unexpected_table_count'
      exit 1
    fi
    jq -n \
      --argjson sourceDatabaseBytes "$source_bytes" \
      --argjson filteredTargetDatabaseBytes "$target_bytes" \
      --argjson hardCeilingBytes 367001600 \
      '{format:"dpg-rehearsal-capacity-v1",sourceDatabaseBytes:$sourceDatabaseBytes,filteredTargetDatabaseBytes:$filteredTargetDatabaseBytes,hardCeilingBytes:$hardCeilingBytes}' \
      >"$output_dir/rehearsal-capacity.json"
    chmod 0600 "$output_dir/rehearsal-capacity.json"
    echo "CATALOGUE_REHOME_CAPACITY status=PASS source_dump_bytes=$plain_bytes source_database_bytes=$source_bytes target_database_bytes=$target_bytes target_ceiling_bytes=367001600"
    echo "CATALOGUE_REHOME_EVIDENCE status=PASS tables=$table_count excluded=0"
  fi
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
  if ! docker exec --user postgres "$container_name" \
    pg_restore --data-only --no-owner --no-privileges --exit-on-error \
      --schema=dpg_app --strict-names \
      "$table_arg" --file - "$plain_dump" >>"$restore_sql" \
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
  "\\i '$validation_sql'" >"$driver_sql"
cat >>"$driver_sql" <<'SQL'
do $catalogue_size_guard$
begin
  if pg_database_size(current_database()) >= 367001600 then
    raise exception 'catalogue_database_size_limit';
  end if;
end
$catalogue_size_guard$;
commit;
SQL

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
