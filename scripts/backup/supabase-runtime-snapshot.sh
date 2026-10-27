#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'SUPABASE_RUNTIME_SNAPSHOT status=STOP reason=%s\n' "$1" >&2
  exit 1
}

: "${OUTPUT_DIR:?OUTPUT_DIR is required}"
: "${SUPABASE_REHOME_DATABASE_URL:?SUPABASE_REHOME_DATABASE_URL is required}"
: "${SUPABASE_REHOME_ROOT_CA_CERTIFICATE:?SUPABASE_REHOME_ROOT_CA_CERTIFICATE is required}"
: "${SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT:?SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT is required}"
: "${SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY:?SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY is required}"
: "${EXPECTED_SOURCE_AGE_RECIPIENT:?EXPECTED_SOURCE_AGE_RECIPIENT is required}"

if [[ "${GITHUB_ACTIONS:-}" != true || "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
      "${GITHUB_REF:-}" != refs/heads/main || "${GITHUB_RUN_ATTEMPT:-}" != 1 ]]; then
  fail execution_context_invalid
fi
if [[ ! "$SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT" =~ ^age1[0-9a-z]+$ ]] ||
   [[ "$SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT" == "$EXPECTED_SOURCE_AGE_RECIPIENT" ]]; then
  fail snapshot_recipient_invalid
fi

tmp_parent='/dev/shm'
if ! command -v findmnt >/dev/null 2>&1 ||
   [[ "$(findmnt --noheadings --output FSTYPE --target "$tmp_parent" | xargs)" != tmpfs ]]; then
  fail tmpfs_required
fi
mkdir -m 0700 -- "$OUTPUT_DIR" 2>/dev/null || fail output_directory_unavailable
if [[ "$(findmnt --noheadings --output FSTYPE --target "$OUTPUT_DIR" | xargs)" != tmpfs ]]; then
  fail output_directory_not_tmpfs
fi

for command in age age-keygen docker findmnt jq node sha256sum; do
  command -v "$command" >/dev/null 2>&1 || fail "missing_${command}"
done

postgres_image="${POSTGRES_IMAGE:-postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3}"
if [[ "$postgres_image" != 'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3' ]]; then
  fail postgres_image_invalid
fi
if [[ -n "${DOCKER_HOST:-}" && "$DOCKER_HOST" != unix://* ]]; then
  fail docker_remote_daemon_disallowed
fi
docker_context="${DOCKER_CONTEXT:-}"
if [[ -z "$docker_context" && -z "${DOCKER_HOST:-}" ]]; then
  docker_context="$(docker context show 2>/dev/null)" || fail docker_context_unavailable
fi
if [[ -n "$docker_context" ]]; then
  docker_endpoint="$(docker context inspect --format '{{(index .Endpoints "docker").Host}}' "$docker_context" 2>/dev/null)" ||
    fail docker_context_unavailable
else
  docker_endpoint="$DOCKER_HOST"
fi
[[ "$docker_endpoint" == unix://* ]] || fail docker_remote_daemon_disallowed
[[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$postgres_image" 2>/dev/null)" == 'linux/amd64' ]] ||
  fail postgres_image_not_pinned_local

umask 077
tmp_dir="$(mktemp -d "$tmp_parent/dpg-runtime-snapshot.XXXXXX")"
container_name="dpg-runtime-snapshot-${RANDOM}${RANDOM}"
container_started=false
cleanup() {
  if [[ "$container_started" == true ]]; then docker rm --force "$container_name" >/dev/null 2>&1 || true; fi
  rm -rf -- "$tmp_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

identity_file="$tmp_dir/snapshot-identity"
printf '%s\n' "$SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY" >"$identity_file"
chmod 0600 "$identity_file"
unset SUPABASE_REHOME_SNAPSHOT_AGE_IDENTITY
if ! age-keygen -y "$identity_file" >"$tmp_dir/derived-recipient" 2>/dev/null ||
   ! printf '%s\n' "$SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT" >"$tmp_dir/expected-recipient" ||
   ! cmp -s "$tmp_dir/derived-recipient" "$tmp_dir/expected-recipient"; then
  fail snapshot_identity_recipient_mismatch
fi
unset SUPABASE_REHOME_SNAPSHOT_AGE_RECIPIENT

dump_script='scripts/backup/supabase-runtime-pg-dump.mjs'
database_snapshot="$OUTPUT_DIR/affected-schemas.custom.age"
globals_snapshot="$OUTPUT_DIR/global-roles.no-passwords.sql.age"
if ! node "$dump_script" --affected-state-snapshot |
     age --recipient "$(cat "$tmp_dir/expected-recipient")" --output "$database_snapshot" 2>"$tmp_dir/database-encrypt.error"; then
  fail destination_snapshot_failed
fi
if ! node "$dump_script" --global-roles-snapshot |
     age --recipient "$(cat "$tmp_dir/expected-recipient")" --output "$globals_snapshot" 2>"$tmp_dir/globals-encrypt.error"; then
  fail destination_roles_snapshot_failed
fi
unset SUPABASE_REHOME_ROOT_CA_CERTIFICATE SUPABASE_REHOME_DATABASE_URL

docker run --detach --name "$container_name" --network none --read-only --log-driver=none \
  --pids-limit 128 --memory 512m \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=384m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16m \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  --env POSTGRES_USER=dpg_snapshot_restore \
  "$postgres_image" >/dev/null 2>&1 || fail isolated_restore_start_failed
container_started=true
[[ "$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container_name")" == 'none' ]] ||
  fail isolated_restore_logging_enabled
ready=false
for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready -U dpg_snapshot_restore -d postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || fail isolated_restore_not_ready

if ! age --decrypt --identity "$identity_file" "$globals_snapshot" 2>"$tmp_dir/globals-decrypt.error" |
     docker exec --interactive --user postgres "$container_name" \
       psql -U dpg_snapshot_restore -X -q -v ON_ERROR_STOP=1 -d postgres >/dev/null 2>"$tmp_dir/globals-restore.error"; then
  fail isolated_roles_restore_failed
fi
docker exec --interactive --user postgres "$container_name" \
  psql -U dpg_snapshot_restore -X -q -v ON_ERROR_STOP=1 -d postgres >/dev/null 2>"$tmp_dir/bootstrap.error" <<'SQL' ||
fail isolated_restore_bootstrap_failed
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql stable as $$ select null::text $$;
SQL

if ! age --decrypt --identity "$identity_file" "$database_snapshot" 2>"$tmp_dir/database-decrypt.error" |
     docker exec --interactive --user postgres "$container_name" \
       sh -c 'umask 077; cat > /tmp/affected-schemas.dump' \
       >/dev/null 2>"$tmp_dir/database-stage.error"; then
  fail isolated_database_restore_failed
fi
expected_tables="$(docker exec --user postgres "$container_name" \
  pg_restore --list /tmp/affected-schemas.dump 2>/dev/null | \
  awk -F'; ' '$2 ~ /^[0-9]+ [0-9]+ TABLE / { count += 1 } END { print count + 0 }')" ||
  fail isolated_restore_verification_failed
[[ "$expected_tables" =~ ^[1-9][0-9]*$ ]] || fail isolated_restore_verification_failed
if ! docker exec --user postgres "$container_name" \
  pg_restore --format=custom --username=dpg_snapshot_restore --exit-on-error \
    --single-transaction --dbname=postgres /tmp/affected-schemas.dump \
    >/dev/null 2>"$tmp_dir/database-restore.error"; then
  fail isolated_database_restore_failed
fi
rm -f -- "$identity_file" "$tmp_dir/derived-recipient" "$tmp_dir/expected-recipient"

restored_tables="$(docker exec --user postgres "$container_name" \
  psql -U dpg_snapshot_restore -X -q -A -t -v ON_ERROR_STOP=1 -d postgres \
  -c "select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('dpg_app','dpg_control') and c.relkind in ('r','p')" 2>/dev/null)" ||
  fail isolated_restore_verification_failed
[[ "$restored_tables" =~ ^[1-9][0-9]*$ && "$restored_tables" == "$expected_tables" ]] ||
  fail isolated_restore_verification_failed
docker exec --user postgres "$container_name" rm -f /tmp/affected-schemas.dump ||
  fail isolated_restore_verification_failed

database_bytes="$(wc -c <"$database_snapshot" | xargs)"
globals_bytes="$(wc -c <"$globals_snapshot" | xargs)"
database_sha256="$(sha256sum "$database_snapshot" | awk '{print $1}')"
globals_sha256="$(sha256sum "$globals_snapshot" | awk '{print $1}')"
jq -n \
  --arg sourceSha "${GITHUB_SHA:?GITHUB_SHA is required}" \
  --arg projectRef 'bonxyxluzlxfkdetryoo' \
  --arg databaseSha256 "$database_sha256" \
  --arg globalsSha256 "$globals_sha256" \
  --argjson databaseCiphertextBytes "$database_bytes" \
  --argjson globalsCiphertextBytes "$globals_bytes" \
  --argjson isolatedRestoredTableEntries "$restored_tables" \
  '{format:"dpg-supabase-destination-snapshot-v1",sourceSha:$sourceSha,projectRef:$projectRef,databaseCiphertextBytes:$databaseCiphertextBytes,databaseCiphertextSha256:$databaseSha256,globalsCiphertextBytes:$globalsCiphertextBytes,globalsCiphertextSha256:$globalsSha256,isolatedRestoredTableEntries:$isolatedRestoredTableEntries}' \
  >"$OUTPUT_DIR/snapshot-receipt.json"
chmod 0600 "$OUTPUT_DIR"/*
printf 'SUPABASE_RUNTIME_SNAPSHOT status=PASS database_ciphertext_bytes=%s globals_ciphertext_bytes=%s isolated_restore=PASS restored_table_entries=%s\n' \
  "$database_bytes" "$globals_bytes" "$restored_tables"
