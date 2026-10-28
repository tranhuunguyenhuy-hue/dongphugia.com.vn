#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'SUPABASE_RUNTIME_SNAPSHOT status=STOP reason=%s\n' "$1" >&2
  exit 1
}

: "${OUTPUT_DIR:?OUTPUT_DIR is required}"
: "${SUPABASE_REHOME_DATABASE_URL:?SUPABASE_REHOME_DATABASE_URL is required}"
: "${SUPABASE_REHOME_ROOT_CA_CERTIFICATE:?SUPABASE_REHOME_ROOT_CA_CERTIFICATE is required}"
: "${BACKUP_AGE_PRIVATE_KEY:?BACKUP_AGE_PRIVATE_KEY is required}"
: "${EXPECTED_SOURCE_AGE_RECIPIENT:?EXPECTED_SOURCE_AGE_RECIPIENT is required}"

if [[ "${GITHUB_ACTIONS:-}" != true || "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
      "${GITHUB_REF:-}" != refs/heads/main || "${GITHUB_RUN_ATTEMPT:-}" != 1 ]]; then
  fail execution_context_invalid
fi
case "$EXPECTED_SOURCE_AGE_RECIPIENT" in
  age12zqtv9r2fc4v2j0kk6v79xrvy66gxcht2uqfxvqske4lzh83uq2qtqhfmc) ;;
  *) fail source_recipient_invalid ;;
esac

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
identity_value="$BACKUP_AGE_PRIVATE_KEY"
unset BACKUP_AGE_PRIVATE_KEY
printf '%s' "$identity_value" >"$identity_file"
unset identity_value
chmod 0600 "$identity_file"
if ! age-keygen -y "$identity_file" >"$tmp_dir/derived-recipient" 2>/dev/null ||
   ! printf '%s\n' "$EXPECTED_SOURCE_AGE_RECIPIENT" >"$tmp_dir/expected-recipient" ||
   ! cmp -s "$tmp_dir/derived-recipient" "$tmp_dir/expected-recipient"; then
  fail validated_backup_identity_mismatch
fi
unset EXPECTED_SOURCE_AGE_RECIPIENT

dump_script='scripts/backup/supabase-runtime-pg-dump.mjs'
database_snapshot="$OUTPUT_DIR/affected-schemas.custom.age"
public_snapshot="$OUTPUT_DIR/public-schema.custom.age"
acl_snapshot="$OUTPUT_DIR/auth-extension-schema-acls.json.age"
globals_snapshot="$OUTPUT_DIR/global-roles.no-passwords.sql.age"
snapshot_recipient="$(cat "$tmp_dir/expected-recipient")"
schema_acl_query='scripts/backup/supabase-runtime-schema-acl-snapshot.sql'
role_state_query='scripts/backup/supabase-runtime-role-state-snapshot.sql'
cp -- "$schema_acl_query" "$tmp_dir/schema-acl-snapshot.sql" || fail snapshot_query_unavailable
cp -- "$role_state_query" "$tmp_dir/role-state-snapshot.sql" || fail snapshot_query_unavailable
chmod 0400 "$tmp_dir/schema-acl-snapshot.sql"
chmod 0400 "$tmp_dir/role-state-snapshot.sql"

capture_encrypted_snapshot() {
  local dump_mode="$1"
  local ciphertext_path="$2"
  local hash_path="$3"
  local snapshot_name
  local fifo_path
  local hash_pid
  local plaintext_hash
  snapshot_name="$(basename "$ciphertext_path")"
  fifo_path="$tmp_dir/$snapshot_name.plaintext.pipe"
  mkfifo "$fifo_path" || fail snapshot_pipeline_unavailable
  sha256sum <"$fifo_path" | awk '{ print $1 }' >"$hash_path" &
  hash_pid=$!
  if ! node "$dump_script" "$dump_mode" \
       2>"$tmp_dir/$snapshot_name.dump.stderr" |
       tee "$fifo_path" |
       age --recipient "$snapshot_recipient" --output "$ciphertext_path" \
         2>"$tmp_dir/$snapshot_name.encrypt.stderr"; then
    wait "$hash_pid" 2>/dev/null || true
    fail snapshot_capture_failed
  fi
  wait "$hash_pid" || fail snapshot_hash_failed
  plaintext_hash="$(cat "$hash_path")"
  [[ "$plaintext_hash" =~ ^[0-9a-f]{64}$ ]] || fail snapshot_hash_failed
  rm -f -- "$fifo_path"
}

database_plain_hash="$tmp_dir/database.plain.sha256"
public_plain_hash="$tmp_dir/public-schema.plain.sha256"
acl_plain_hash="$tmp_dir/schema-acls.plain.sha256"
globals_plain_hash="$tmp_dir/global-roles.plain.sha256"
capture_encrypted_snapshot --affected-state-snapshot "$database_snapshot" "$database_plain_hash"
capture_encrypted_snapshot --affected-public-schema-snapshot "$public_snapshot" "$public_plain_hash"
capture_encrypted_snapshot --auth-extension-schema-acls "$acl_snapshot" "$acl_plain_hash"
capture_encrypted_snapshot --global-roles-snapshot "$globals_snapshot" "$globals_plain_hash"

capture_logical_hash() {
  local mode="$1"
  local hash
  hash="$(node "$dump_script" "$mode" 2>"$tmp_dir/$mode.stderr" |
    normalize_pg_dump_stream | sha256sum | awk '{print $1}')" ||
    fail "${mode#--}_capture_failed"
  [[ "$hash" =~ ^[0-9a-f]{64}$ ]] || fail "${mode#--}_hash_failed"
  printf '%s' "$hash"
}

normalize_pg_dump_stream() {
  # pg_dump includes server-version headers and a random psql \restrict token.
  # Remove only those non-state lines so equivalent source/restore SQL hashes
  # remain comparable across PostgreSQL minor versions and dump invocations.
  awk '
    /^-- Dumped from database version / { next }
    /^-- Dumped by pg_dump version / { next }
    /^\\(un)?restrict [^[:space:]]+$/ { next }
    { print }
  '
}

schema_equivalence_sha256="$(capture_logical_hash --schema-only-equivalence)"
data_equivalence_sha256="$(capture_logical_hash --data-only-equivalence)"
source_role_state="$tmp_dir/role-state.source.json"
if ! node "$dump_script" --role-state-manifest >"$source_role_state" \
     2>"$tmp_dir/role-state.source.stderr"; then
  fail role_state_snapshot_failed
fi
chmod 0600 "$source_role_state"
jq -e '
  .format == "dpg-runtime-role-state-v1" and
  .reservedBootstrapRoleAbsent == true and
  (.roles | type == "array") and
  (.memberships | type == "array")
' "$source_role_state" >/dev/null || fail isolated_restore_role_collision
jq -S 'del(.reservedBootstrapRoleAbsent)' "$source_role_state" \
  >"$tmp_dir/role-state.source.normalized.json"
role_state_equivalence_sha256="$(sha256sum "$tmp_dir/role-state.source.normalized.json" | awk '{print $1}')"

acl_plain="$tmp_dir/auth-extension-schema-acls.json"
if ! age --decrypt --identity "$identity_file" "$acl_snapshot" >"$acl_plain" \
     2>"$tmp_dir/schema-acls.decrypt.stderr"; then
  fail destination_acl_snapshot_decrypt_failed
fi
chmod 0600 "$acl_plain"
test "$(sha256sum "$acl_plain" | awk '{print $1}')" = "$(cat "$acl_plain_hash")" ||
  fail destination_acl_snapshot_hash_mismatch
jq -e '
  .format == "dpg-runtime-schema-acl-v1" and
  (.roles | type == "array" and length > 0) and
  (.schemas | map(.name) | sort == ["auth", "extensions"])
' "$acl_plain" >/dev/null || fail destination_acl_snapshot_invalid

unset SUPABASE_REHOME_ROOT_CA_CERTIFICATE SUPABASE_REHOME_DATABASE_URL

docker run --detach --name "$container_name" --network none --read-only --log-driver=none \
  --pids-limit 128 --memory 512m \
  --mount "type=bind,source=$tmp_dir/schema-acl-snapshot.sql,target=/run/schema-acl-snapshot.sql,readonly" \
  --mount "type=bind,source=$tmp_dir/role-state-snapshot.sql,target=/run/role-state-snapshot.sql,readonly" \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=384m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16m \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=512m \
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

stage_encrypted_snapshot() {
  local ciphertext_path="$1"
  local hash_path="$2"
  local staged_path="$3"
  local failure_reason="$4"
  local expected_hash
  local actual_hash
  if ! age --decrypt --identity "$identity_file" "$ciphertext_path" \
       2>"$tmp_dir/snapshot.decrypt.stderr" |
       docker exec --interactive --user postgres "$container_name" \
         sh -c 'umask 077; cat > "$1"' sh "$staged_path" \
         >/dev/null 2>"$tmp_dir/snapshot-stage.stderr"; then
    fail "$failure_reason"
  fi
  expected_hash="$(cat "$hash_path")"
  actual_hash="$(docker exec --user postgres "$container_name" \
    sha256sum "$staged_path" 2>/dev/null | awk '{print $1}')" || fail snapshot_hash_check_failed
  [[ "$actual_hash" == "$expected_hash" ]] || fail snapshot_plaintext_hash_mismatch
}

stage_encrypted_snapshot "$globals_snapshot" "$globals_plain_hash" \
  /tmp/global-roles.no-passwords.sql isolated_roles_restore_failed
if ! docker exec --user postgres "$container_name" \
     psql -U dpg_snapshot_restore -X -q -v ON_ERROR_STOP=1 -d postgres \
       --file=/tmp/global-roles.no-passwords.sql \
       >/dev/null 2>"$tmp_dir/globals-restore.error"; then
  fail isolated_roles_restore_failed
fi
docker exec --user postgres "$container_name" rm -f /tmp/global-roles.no-passwords.sql \
  >/dev/null 2>&1 || fail isolated_roles_restore_failed

docker exec --interactive --user postgres "$container_name" \
  psql -U dpg_snapshot_restore -X -q -v ON_ERROR_STOP=1 -d postgres >/dev/null 2>"$tmp_dir/bootstrap.error" <<'SQL' ||
fail isolated_restore_bootstrap_failed
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function auth.role() returns text language sql stable as $$ select null::text $$;
SQL

node scripts/backup/supabase-runtime-schema-acl.mjs restore-sql "$acl_plain" |
  docker exec --interactive --user postgres "$container_name" \
    psql -U dpg_snapshot_restore -X -q -v ON_ERROR_STOP=1 -d postgres \
    >/dev/null 2>"$tmp_dir/schema-acl-restore.error" || fail isolated_acl_restore_failed

if ! docker exec --user postgres "$container_name" \
     psql -U dpg_snapshot_restore -X -q -A -t -v ON_ERROR_STOP=1 -d postgres \
       --file=/run/schema-acl-snapshot.sql >"$tmp_dir/restored-schema-acls.json" \
       2>"$tmp_dir/schema-acl-verify.error"; then
  fail isolated_acl_verification_failed
fi
jq -S 'del(.roles) | .schemas |= map(.grants |= sort_by(.grantee, .privilege, .grantable))' \
  "$acl_plain" >"$tmp_dir/source-schema-acls.normalized.json"
jq -S 'del(.roles) | .schemas |= map(.grants |= sort_by(.grantee, .privilege, .grantable))' \
  "$tmp_dir/restored-schema-acls.json" >"$tmp_dir/restored-schema-acls.normalized.json"
cmp -s "$tmp_dir/source-schema-acls.normalized.json" "$tmp_dir/restored-schema-acls.normalized.json" ||
  fail isolated_acl_equivalence_failed

stage_encrypted_snapshot "$database_snapshot" "$database_plain_hash" \
  /tmp/affected-schemas.dump isolated_database_restore_failed
stage_encrypted_snapshot "$public_snapshot" "$public_plain_hash" \
  /tmp/public-schema.dump isolated_public_schema_restore_failed

if ! docker exec --user postgres "$container_name" \
     pg_restore --format=custom --username=dpg_snapshot_restore --exit-on-error \
       --single-transaction --dbname=postgres /tmp/affected-schemas.dump \
       >/dev/null 2>"$tmp_dir/database-restore.error"; then
  fail isolated_database_restore_failed
fi
if ! docker exec --user postgres "$container_name" \
     pg_restore --format=custom --username=dpg_snapshot_restore --clean --if-exists --exit-on-error \
       --single-transaction --dbname=postgres /tmp/public-schema.dump \
       >/dev/null 2>"$tmp_dir/public-schema-restore.error"; then
  fail isolated_public_schema_restore_failed
fi

schema_args=(--schema-only --schema=dpg_app --schema=dpg_control --schema=dpg_v1 --schema=dpg_v1_api --schema=public)
data_args=(--data-only --column-inserts --schema=dpg_app --schema=dpg_control --schema=dpg_v1 --schema=dpg_v1_api)
restored_schema_equivalence_sha256="$(docker exec --user postgres "$container_name" \
  pg_dump -U dpg_snapshot_restore -d postgres "${schema_args[@]}" 2>"$tmp_dir/schema-equivalence.stderr" |
  normalize_pg_dump_stream |
  sha256sum | awk '{print $1}')" || fail isolated_schema_equivalence_failed
restored_data_equivalence_sha256="$(docker exec --user postgres "$container_name" \
  pg_dump -U dpg_snapshot_restore -d postgres "${data_args[@]}" 2>"$tmp_dir/data-equivalence.stderr" |
  normalize_pg_dump_stream |
  sha256sum | awk '{print $1}')" || fail isolated_data_equivalence_failed
[[ "$restored_schema_equivalence_sha256" == "$schema_equivalence_sha256" ]] ||
  fail isolated_schema_equivalence_failed
[[ "$restored_data_equivalence_sha256" == "$data_equivalence_sha256" ]] ||
  fail isolated_data_equivalence_failed

if ! docker exec --user postgres "$container_name" \
     psql -U dpg_snapshot_restore -X -q -A -t -v ON_ERROR_STOP=1 -d postgres \
       --file=/run/role-state-snapshot.sql >"$tmp_dir/role-state.restored.json" \
       2>"$tmp_dir/role-state.restored.stderr"; then
  fail isolated_role_state_snapshot_failed
fi
jq -e '.format == "dpg-runtime-role-state-v1" and (.roles | type == "array") and (.memberships | type == "array")' \
  "$tmp_dir/role-state.restored.json" >/dev/null || fail isolated_role_state_snapshot_failed
jq -S 'del(.reservedBootstrapRoleAbsent)' "$tmp_dir/role-state.restored.json" \
  >"$tmp_dir/role-state.restored.normalized.json"
cmp -s "$tmp_dir/role-state.source.normalized.json" "$tmp_dir/role-state.restored.normalized.json" ||
  fail isolated_role_state_equivalence_failed

expected_runtime_tables="$(docker exec --user postgres "$container_name" \
  pg_restore --list /tmp/affected-schemas.dump 2>/dev/null | \
  awk -F'; ' '$2 ~ /^[0-9]+ [0-9]+ TABLE / { count += 1 } END { print count + 0 }')" ||
  fail isolated_restore_verification_failed
expected_public_tables="$(docker exec --user postgres "$container_name" \
  pg_restore --list /tmp/public-schema.dump 2>/dev/null | \
  awk -F'; ' '$2 ~ /^[0-9]+ [0-9]+ TABLE / { count += 1 } END { print count + 0 }')" ||
  fail isolated_restore_verification_failed
expected_tables=$((expected_runtime_tables + expected_public_tables))
[[ "$expected_runtime_tables" =~ ^[1-9][0-9]*$ && "$expected_public_tables" =~ ^[0-9]+$ ]] ||
  fail isolated_restore_verification_failed
rm -f -- "$identity_file" "$tmp_dir/derived-recipient" "$tmp_dir/expected-recipient"

restored_tables="$(docker exec --user postgres "$container_name" \
  psql -U dpg_snapshot_restore -X -q -A -t -v ON_ERROR_STOP=1 -d postgres \
  -c "select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('dpg_app','dpg_control','dpg_v1','public') and c.relkind in ('r','p')" 2>/dev/null)" ||
  fail isolated_restore_verification_failed
[[ "$restored_tables" =~ ^[1-9][0-9]*$ && "$restored_tables" == "$expected_tables" ]] ||
  fail isolated_restore_verification_failed
docker exec --user postgres "$container_name" rm -f \
  /tmp/affected-schemas.dump /tmp/public-schema.dump /tmp/global-roles.no-passwords.sql ||
  fail isolated_restore_verification_failed

database_bytes="$(wc -c <"$database_snapshot" | xargs)"
public_bytes="$(wc -c <"$public_snapshot" | xargs)"
acl_bytes="$(wc -c <"$acl_snapshot" | xargs)"
globals_bytes="$(wc -c <"$globals_snapshot" | xargs)"
database_sha256="$(sha256sum "$database_snapshot" | awk '{print $1}')"
public_sha256="$(sha256sum "$public_snapshot" | awk '{print $1}')"
acl_sha256="$(sha256sum "$acl_snapshot" | awk '{print $1}')"
globals_sha256="$(sha256sum "$globals_snapshot" | awk '{print $1}')"
jq -n \
  --arg sourceSha "${GITHUB_SHA:?GITHUB_SHA is required}" \
  --arg projectRef 'bonxyxluzlxfkdetryoo' \
  --arg databaseSha256 "$database_sha256" \
  --arg publicSha256 "$public_sha256" \
  --arg aclSha256 "$acl_sha256" \
  --arg globalsSha256 "$globals_sha256" \
  --arg schemaEquivalenceSha256 "$schema_equivalence_sha256" \
  --arg dataEquivalenceSha256 "$data_equivalence_sha256" \
  --arg roleStateEquivalenceSha256 "$role_state_equivalence_sha256" \
  --argjson databaseCiphertextBytes "$database_bytes" \
  --argjson publicCiphertextBytes "$public_bytes" \
  --argjson aclCiphertextBytes "$acl_bytes" \
  --argjson globalsCiphertextBytes "$globals_bytes" \
  --argjson isolatedRestoredTableEntries "$restored_tables" \
  '{format:"dpg-supabase-destination-snapshot-v3",sourceSha:$sourceSha,projectRef:$projectRef,snapshotScopes:["dpg_app data/schema/sequences/grants/RLS/functions","dpg_control data/schema/sequences/grants/RLS/functions","dpg_v1 data/schema/sequences/grants/RLS/functions","dpg_v1_api schema/grants/RLS/functions","public schema/grants/functions","auth/extensions schema grants only","global role attributes/memberships without passwords"],databaseCiphertextBytes:$databaseCiphertextBytes,databaseCiphertextSha256:$databaseSha256,publicCiphertextBytes:$publicCiphertextBytes,publicCiphertextSha256:$publicSha256,authExtensionAclCiphertextBytes:$aclCiphertextBytes,authExtensionAclCiphertextSha256:$aclSha256,globalsCiphertextBytes:$globalsCiphertextBytes,globalsCiphertextSha256:$globalsSha256,schemaEquivalenceSha256:$schemaEquivalenceSha256,dataAndSequenceEquivalenceSha256:$dataEquivalenceSha256,roleStateEquivalenceSha256:$roleStateEquivalenceSha256,isolatedRestoredTableEntries:$isolatedRestoredTableEntries,isolatedArchiveHashChecks:"PASS",isolatedSchemaEquivalence:"PASS",isolatedDataAndSequenceEquivalence:"PASS",isolatedRoleStateEquivalence:"PASS",isolatedSchemaAclEquivalence:"PASS",rolePasswordsCaptured:false}' \
  >"$OUTPUT_DIR/snapshot-receipt.json"
chmod 0600 "$OUTPUT_DIR"/*
printf 'SUPABASE_RUNTIME_SNAPSHOT status=PASS database_ciphertext_bytes=%s public_schema_ciphertext_bytes=%s schema_acl_ciphertext_bytes=%s globals_ciphertext_bytes=%s isolated_restore=PASS schema_equivalence=PASS data_sequence_equivalence=PASS role_state_equivalence=PASS acl_equivalence=PASS restored_table_entries=%s\n' \
  "$database_bytes" "$public_bytes" "$acl_bytes" "$globals_bytes" "$restored_tables"
