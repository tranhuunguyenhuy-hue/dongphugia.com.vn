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

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
contract="$repo_root/scripts/backup/catalogue-restore-contract.mjs"
preflight_sql="$repo_root/scripts/backup/catalogue-rehome-preflight.sql"
postgres_image="${POSTGRES_IMAGE:-postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3}"
output_dir="${OUTPUT_DIR:-$RUNNER_TEMP/catalogue-rehome-evidence}"
mkdir -p "$output_dir"

tmp_parent='/dev/shm'
if [[ ! -d "$tmp_parent" ]]; then
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

for command in age docker jq node sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "CATALOGUE_REHOME status=FAIL stage=preflight reason=missing_${command}"
    exit 1
  }
done

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
  node -e '
    const value = process.env.SUPABASE_REHOME_DATABASE_URL;
    if (!value) process.exit(1);
    const url = new URL(value);
    const ref = "bonxyxluzlxfkdetryoo";
    const direct = url.hostname === `db.${ref}.supabase.co` && url.username === "postgres";
    const pooler = url.hostname === "aws-0-ap-southeast-1.pooler.supabase.com"
      && url.username === `postgres.${ref}`;
    if ((!direct && !pooler) || url.pathname !== "/postgres") process.exit(1);
  '
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
  psql "$SUPABASE_REHOME_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 \
    --file "$preflight_sql" >/dev/null
  echo 'CATALOGUE_REHOME status=PASS mode=preflight target=exact empty=true'
  exit 0
fi

: "${AGE_IDENTITY:?AGE_IDENTITY is required}"
printf '%s\n' "$AGE_IDENTITY" >"$tmp_dir/age-identity"
chmod 600 "$tmp_dir/age-identity"
plain_dump="$tmp_dir/runtime.dump"
age --decrypt --identity "$tmp_dir/age-identity" --output "$plain_dump" "$archive" 2>"$tmp_dir/age.error"
rm -f "$tmp_dir/age-identity"

mapfile -t restore_table_args < <(node "$contract" table-args)
test "${#restore_table_args[@]}" -gt 0

if [[ "$MODE" == 'rehearsal' ]]; then
  docker run --rm --detach --name "$container_name" \
    --network none --read-only --pids-limit 256 --memory 1536m \
    --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g \
    --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m \
    --tmpfs /var/run/postgresql:rw,nosuid,nodev,noexec,size=64m \
    --env POSTGRES_HOST_AUTH_METHOD=trust "$postgres_image" >/dev/null
  container_started='true'
  test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")" = 'none'
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

  cat "$plain_dump" | docker exec -i "$container_name" \
    pg_restore -U postgres -d source --exit-on-error --no-owner --no-privileges >/dev/null
  node "$contract" snapshot-sql | docker exec -i "$container_name" \
    psql -U postgres -d source -X -q -A -t -v ON_ERROR_STOP=1 \
    >"$output_dir/catalogue-expected.json"

  cat "$plain_dump" | docker exec -i "$container_name" \
    pg_restore -U postgres -d target --schema-only --exit-on-error --no-owner --no-privileges >/dev/null
  cat "$plain_dump" | docker exec -i "$container_name" \
    pg_restore --data-only --no-owner --no-privileges --exit-on-error \
      "${restore_table_args[@]}" -U postgres -d target >/dev/null
  node "$contract" snapshot-sql | docker exec -i "$container_name" \
    psql -U postgres -d target -X -q -A -t -v ON_ERROR_STOP=1 \
    >"$tmp_dir/catalogue-actual.json"
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

docker run --rm --network none --read-only \
  --volume "$tmp_dir:/work:rw" "$postgres_image" \
  pg_restore --data-only --no-owner --no-privileges --exit-on-error \
    "${restore_table_args[@]}" --file /work/catalogue-restore.sql /work/runtime.dump
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

psql "$SUPABASE_REHOME_DATABASE_URL" -X -q --file "$driver_sql" >/dev/null
node "$contract" snapshot-sql | psql "$SUPABASE_REHOME_DATABASE_URL" \
  -X -q -A -t -v ON_ERROR_STOP=1 >"$output_dir/catalogue-actual.json"
node "$contract" compare "$EXPECTED_CATALOGUE_MANIFEST" \
  "$output_dir/catalogue-actual.json" >/dev/null
echo 'CATALOGUE_REHOME status=PASS mode=apply target=exact transaction=committed'
