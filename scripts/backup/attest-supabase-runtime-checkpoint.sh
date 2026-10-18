#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_REHOME_DATABASE_URL:?SUPABASE_REHOME_DATABASE_URL is required}"
: "${CHECKPOINT_ATTESTATION_MODE:=readonly}"

if [[ "$CHECKPOINT_ATTESTATION_MODE" != 'readonly' \
      && "$CHECKPOINT_ATTESTATION_MODE" != 'behavioral' ]]; then
  echo 'SUPABASE_CHECKPOINT status=FAIL reason=mode_invalid'
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
postgres_image='postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3'
tmp_parent='/dev/shm'

if ! command -v findmnt >/dev/null 2>&1 \
   || [[ "$(findmnt --noheadings --output FSTYPE --target "$tmp_parent" | xargs)" != 'tmpfs' ]]; then
  echo 'SUPABASE_CHECKPOINT status=FAIL reason=tmpfs_unavailable'
  exit 1
fi

tmp_dir="$(mktemp --directory "$tmp_parent/supabase-checkpoint.XXXXXX")"
container_name="supabase-checkpoint-${RANDOM}${RANDOM}"
container_started='false'

cleanup() {
  if [[ "$container_started" == 'true' ]]; then
    docker rm --force "$container_name" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fail_sensitive() {
  local stage="$1"
  rm -f "$tmp_dir/sensitive.error"
  echo "SUPABASE_CHECKPOINT status=FAIL stage=$stage reason=attestation_failed"
  exit 1
}

checkpoint_migrations=(
  '20260827204635_leo539_security_boundary.sql'
  '20260827204730_leo539_control_rls_hardening.sql'
  '20260827210019_leo539_login_and_fail_closed_writes.sql'
  '20260828110000_leo538_runtime_schema.sql'
  '20260828120000_leo538_runtime_data_boundary.sql'
  '20260828130000_leo538_reconciliation_manifest_authority.sql'
  '20260828163113_leo541_runtime_api.sql'
)

docker run --rm --detach --name "$container_name" \
  --network none --read-only --pids-limit 256 --memory 1536m \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,noexec,size=64m \
  --env POSTGRES_HOST_AUTH_METHOD=trust "$postgres_image" >/dev/null
container_started='true'

ready='false'
for _ in {1..45}; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
    ready='true'
    break
  fi
  sleep 1
done
[[ "$ready" == 'true' ]] || fail_sensitive local_postgres_start

if ! docker exec -i "$container_name" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 \
  > /dev/null 2>"$tmp_dir/sensitive.error" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable
as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create table auth.users (id uuid primary key);
create table storage.objects (id uuid primary key);
alter database postgres set search_path to "$user", public, extensions;
set search_path to "$user", public, extensions;
SQL
then
  fail_sensitive local_bootstrap
fi

for migration in "${checkpoint_migrations[@]}"; do
  if ! docker exec -i "$container_name" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 \
    <"$repo_root/supabase/migrations/$migration" \
    >/dev/null 2>"$tmp_dir/sensitive.error"; then
    fail_sensitive local_checkpoint_replay
  fi
done

if ! docker exec "$container_name" pg_dump -U postgres -d postgres \
  --schema-only --schema=dpg_app --schema=dpg_control \
  >"$tmp_dir/local.sql" 2>"$tmp_dir/sensitive.error"; then
  fail_sensitive local_schema_dump
fi

if ! SUPABASE_PSQL_TMPDIR="$tmp_dir" \
  node "$repo_root/scripts/backup/supabase-runtime-pg-dump.mjs" --checkpoint-schema \
  >"$tmp_dir/remote.sql" 2>"$tmp_dir/sensitive.error"; then
  fail_sensitive remote_schema_dump
fi

sed -E '/^--/d; /^\\(un)?restrict /d; /^[[:space:]]*$/d' \
  "$tmp_dir/local.sql" >"$tmp_dir/local.normalized.sql"
sed -E '/^--/d; /^\\(un)?restrict /d; /^[[:space:]]*$/d' \
  "$tmp_dir/remote.sql" >"$tmp_dir/remote.normalized.sql"

local_hash="$(sha256sum "$tmp_dir/local.normalized.sql" | cut -d' ' -f1)"
remote_hash="$(sha256sum "$tmp_dir/remote.normalized.sql" | cut -d' ' -f1)"
[[ "$local_hash" == "$remote_hash" ]] || fail_sensitive schema_equivalence

if ! SUPABASE_PSQL_TMPDIR="$tmp_dir" \
  node "$repo_root/scripts/backup/supabase-runtime-psql.mjs" \
    --file "$repo_root/supabase/tests/supabase_runtime_adoption_checkpoint.sql" \
  >/dev/null 2>"$tmp_dir/sensitive.error"; then
  fail_sensitive readonly_acceptance
fi

if [[ "$CHECKPOINT_ATTESTATION_MODE" == 'behavioral' ]] && \
   ! SUPABASE_PSQL_TMPDIR="$tmp_dir" \
     node "$repo_root/scripts/backup/supabase-runtime-psql.mjs" \
       --file "$repo_root/supabase/tests/supabase_runtime_adoption_behavior.sql" \
     >/dev/null 2>"$tmp_dir/sensitive.error"; then
  fail_sensitive rollback_only_behavioral_acceptance
fi

rm -f "$tmp_dir/sensitive.error"
echo "SUPABASE_CHECKPOINT status=PASS schema=equivalent mode=$CHECKPOINT_ATTESTATION_MODE rows=persisted_zero"
