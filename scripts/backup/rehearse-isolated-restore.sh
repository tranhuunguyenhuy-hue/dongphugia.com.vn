#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${AGE_IDENTITY:?AGE_IDENTITY is required}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
postgres_image="${POSTGRES_IMAGE:-postgres:17.6-bookworm@sha256:45cd22f8d32e189d245403954882f88e7a8714301fda80dab6da90f1265b25a3}"
tmp_dir="$(mktemp --directory /dev/shm/leo540-restore.XXXXXX)"
container_name="leo540-restore-${RANDOM}${RANDOM}"
stage='preflight'
result='FAIL'
checksum_verified='false'
network_isolated='false'
manifest_compared='false'
product_validation='UNKNOWN'
family_validation='UNKNOWN'
blog_validation='UNKNOWN'
container_started='false'

cleanup() {
  if [[ "$container_started" == 'true' ]]; then
    docker rm --force "$container_name" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
  printf 'LEO540_RESTORE status=%s stage=%s checksum=%s isolated=%s manifest=%s product=%s family_ms885=%s blog=%s\n' \
    "$result" "$stage" "$checksum_verified" "$network_isolated" "$manifest_compared" \
    "$product_validation" "$family_validation" "$blog_validation"
}
trap cleanup EXIT

for command in age docker jq node sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "LEO540_RESTORE status=FAIL stage=preflight reason=missing_${command}"
    exit 1
  }
done
if [[ "$(findmnt --noheadings --output FSTYPE --target "$tmp_dir" 2>/dev/null)" != 'tmpfs' ]]; then
  echo 'LEO540_RESTORE status=FAIL stage=preflight reason=plaintext_workspace_not_tmpfs'
  exit 1
fi

shopt -s nullglob
archives=("$BACKUP_DIR"/*.dump.age)
manifests=("$BACKUP_DIR"/*.manifest.json)
checksum_files=("$BACKUP_DIR"/*.checksums.sha256)
shopt -u nullglob
if [[ "${#archives[@]}" != '1' || "${#manifests[@]}" != '1' || "${#checksum_files[@]}" != '1' ]]; then
  echo 'LEO540_RESTORE status=FAIL stage=preflight reason=backup_bundle_shape_invalid'
  exit 1
fi
archive="${archives[0]}"
manifest="${manifests[0]}"
checksums="${checksum_files[0]}"

archive_name="$(basename "$archive")"
manifest_archive_sha="$(jq -r '.archiveSha256 // empty' "$manifest")"
checksum_archive_sha="$(awk -v name="$archive_name" '$2 == name { print $1 }' "$checksums")"
if [[ ! "$manifest_archive_sha" =~ ^[a-f0-9]{64}$ ]] || [[ "$manifest_archive_sha" != "$checksum_archive_sha" ]]; then
  echo 'LEO540_RESTORE status=FAIL stage=preflight reason=manifest_checksum_link_invalid'
  exit 1
fi

stage='checksum_verification'
if ! (cd "$BACKUP_DIR" && sha256sum -c "$(basename "$checksums")" >/dev/null 2>"$tmp_dir/checksum.error"); then
  echo 'LEO540_RESTORE status=FAIL stage=checksum_verification reason=checksum_mismatch'
  exit 1
fi
checksum_verified='true'
node "$repo_root/scripts/backup/manifest-contract.mjs" validate "$manifest" >/dev/null 2>"$tmp_dir/manifest.error" || {
  echo 'LEO540_RESTORE status=FAIL stage=manifest reason=manifest_contract_failed'
  exit 1
}

printf '%s\n' "$AGE_IDENTITY" >"$tmp_dir/age-identity"
chmod 600 "$tmp_dir/age-identity"
plain_dump="$tmp_dir/runtime.dump"
stage='decryption'
if ! age --decrypt --identity "$tmp_dir/age-identity" --output "$plain_dump" "$archive" 2>"$tmp_dir/age.error"; then
  echo 'LEO540_RESTORE status=FAIL stage=decryption reason=age_failed'
  exit 1
fi
rm -f "$tmp_dir/age-identity"

stage='container_start'
docker pull "$postgres_image" >/dev/null 2>"$tmp_dir/docker-pull.error"
docker run --rm --detach --name "$container_name" \
  --network none \
  --read-only \
  --pids-limit 256 \
  --memory 1536m \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,noexec,size=64m \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  "$postgres_image" >/dev/null 2>"$tmp_dir/docker-run.error"
container_started='true'
test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")" = 'none'
test "$(docker inspect --format '{{len .Mounts}}' "$container_name")" = '0'
test "$(docker inspect --format '{{len .HostConfig.Tmpfs}}' "$container_name")" -ge 3
network_isolated='true'

stage='database_ready'
database_ready='false'
for _ in {1..45}; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then
    database_ready='true'
    break
  fi
  sleep 1
done
test "$database_ready" = 'true'

# The isolated PostgreSQL container has no Supabase-managed roles or auth
# schema. These inert stubs make the archive's RLS policies restorable without
# granting a capability or reaching a network target.
docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - <<'SQL' >/dev/null 2>"$tmp_dir/bootstrap.error"
CREATE ROLE dpg_migration NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE dpg_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE dpg_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
SQL

stage='restore'
if ! cat "$plain_dump" | docker exec --interactive "$container_name" \
  pg_restore -U postgres -d postgres --exit-on-error --no-owner --no-privileges \
  >/dev/null 2>"$tmp_dir/pg_restore.error"; then
  echo 'LEO540_RESTORE status=FAIL stage=restore reason=pg_restore_failed'
  exit 1
fi
rm -f "$plain_dump"

stage='manifest_comparison'
actual_manifest="$tmp_dir/actual.manifest.json"
if ! docker exec -i "$container_name" psql -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1 \
  -f - <"$repo_root/scripts/backup/runtime-manifest.sql" \
  >"$actual_manifest" 2>"$tmp_dir/actual-manifest.error"; then
  echo 'LEO540_RESTORE status=FAIL stage=manifest_comparison reason=manifest_query_failed'
  exit 1
fi
node "$repo_root/scripts/backup/manifest-contract.mjs" compare "$manifest" "$actual_manifest" >/dev/null 2>"$tmp_dir/manifest-compare.error" || {
  echo 'LEO540_RESTORE status=FAIL stage=manifest_comparison reason=manifest_mismatch'
  exit 1
}
manifest_compared='true'

stage='product_family_blog_validation'
if ! docker exec -i "$container_name" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 \
  -f - <"$repo_root/scripts/backup/validate-runtime.sql" \
  >"$tmp_dir/runtime-validation.out" 2>"$tmp_dir/runtime-validation.error"; then
  echo 'LEO540_RESTORE status=FAIL stage=product_family_blog_validation reason=validation_failed'
  exit 1
fi
product_validation='PASS'
family_validation='PASS'
blog_validation='PASS'
result='PASS'
stage='complete'
