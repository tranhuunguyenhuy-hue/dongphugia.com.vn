#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"

output_dir="${OUTPUT_DIR:-backup-output}"
backup_id="${BACKUP_ID:-leo540-$(date -u +%Y%m%dT%H%M%SZ)}"
retention_days="${BACKUP_RETENTION_DAYS:-}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! "$backup_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=preflight reason=invalid_backup_id'
  exit 1
fi
if [[ "$retention_days" != '14' ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=preflight reason=retention_policy_mismatch'
  exit 1
fi
if [[ ! "$AGE_RECIPIENT" =~ ^age1[[:alnum:]]+$ ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=preflight reason=recipient_contract_invalid'
  exit 1
fi

for command in age jq pg_dump psql sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "LEO540_BACKUP status=FAIL stage=preflight reason=missing_${command}"
    exit 1
  }
done
export PGOPTIONS='-c role=dpg_backup'

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"
tmp_dir="$(mktemp --directory /dev/shm/leo540-backup.XXXXXX)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if ! mount_type="$(findmnt --noheadings --output FSTYPE --target "$tmp_dir" 2>/dev/null)" || [[ "$mount_type" != 'tmpfs' ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=preflight reason=plaintext_workspace_not_tmpfs'
  exit 1
fi

target_contract="$tmp_dir/target-contract.txt"
if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c 'select 1' \
  >"$tmp_dir/connection.status" 2>"$tmp_dir/connection.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=connection reason=database_connection_failed'
  exit 1
fi
if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "select project_name || '|' || region || '|' || environment || '|' || data_class || '|' || production_data_allowed || '|' || production_credentials_allowed || '|' || production_writes_allowed || '|' || hard_database_ceiling_bytes || '|' || (current_user = 'dpg_backup' and session_user = 'dpg_backup_login' and current_setting('transaction_read_only') = 'on' and not exists (select 1 from pg_tables where schemaname = 'dpg_app' and not has_table_privilege(current_user, schemaname || '.' || tablename, 'SELECT'))) from dpg_control.target_contract where singleton" \
  >"$target_contract" 2>"$tmp_dir/target-contract.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=target_attestation reason=database_query_failed'
  exit 1
fi
if [[ "$(<"$target_contract")" != 'dongphugia-runtime|ap-southeast-1|preview|production-derived-reduced-runtime|t|f|f|367001600|t' ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=target_attestation reason=target_contract_mismatch'
  exit 1
fi

if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "select case when pg_database_size(current_database()) >= hard_database_ceiling_bytes then 'HARD_STOP' when pg_database_size(current_database()) >= 314572800 then 'ALERT_300_MIB' when pg_database_size(current_database()) >= 262144000 then 'ALERT_250_MIB' else 'WITHIN_BUDGET' end from dpg_control.target_contract where singleton" \
  >"$tmp_dir/free-tier.status" 2>"$tmp_dir/free-tier.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=free_tier_guard reason=database_query_failed'
  exit 1
fi
if [[ "$(<"$tmp_dir/free-tier.status")" != 'WITHIN_BUDGET' ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=free_tier_guard reason=budget_not_within_contract'
  exit 1
fi

manifest_raw="$tmp_dir/runtime-manifest.json"
if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -f "$repo_root/scripts/backup/runtime-manifest.sql" \
  >"$manifest_raw" 2>"$tmp_dir/manifest.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=manifest reason=manifest_query_failed'
  exit 1
fi
if ! node "$repo_root/scripts/backup/manifest-contract.mjs" validate "$manifest_raw" >/dev/null 2>"$tmp_dir/manifest-contract.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=manifest reason=manifest_contract_failed'
  exit 1
fi

plain_dump="$tmp_dir/runtime.dump"
encrypted_dump="$output_dir/${backup_id}.dump.age"
manifest="$output_dir/${backup_id}.manifest.json"
checksums="$output_dir/${backup_id}.checksums.sha256"
if ! pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --no-comments \
  --schema=dpg_app --schema=dpg_control --file="$plain_dump" \
  2>"$tmp_dir/pg_dump.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=logical_dump reason=pg_dump_failed'
  exit 1
fi
if ! age --encrypt --recipient "$AGE_RECIPIENT" --output "$encrypted_dump" "$plain_dump" \
  2>"$tmp_dir/age.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=encryption reason=age_failed'
  exit 1
fi
rm -f "$plain_dump"

archive_sha="$(sha256sum "$encrypted_dump" | awk '{ print $1 }')"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if ! jq --arg backupId "$backup_id" --arg createdAt "$created_at" --arg archiveSha256 "$archive_sha" \
  '. + {backupId: $backupId, createdAt: $createdAt, archiveSha256: $archiveSha256, retentionDays: 14}' \
  "$manifest_raw" >"$manifest"; then
  echo 'LEO540_BACKUP status=FAIL stage=manifest reason=manifest_finalize_failed'
  exit 1
fi
manifest_sha="$(sha256sum "$manifest" | awk '{ print $1 }')"
{
  printf '%s  %s\n' "$archive_sha" "$(basename "$encrypted_dump")"
  printf '%s  %s\n' "$manifest_sha" "$(basename "$manifest")"
} >"$checksums"

printf 'LEO540_BACKUP status=PASS backup_id=%s archive_bytes=%s retention_days=14 encrypted=true manifest=PASS checksum=PASS\n' \
  "$backup_id" "$(wc -c <"$encrypted_dump" | tr -d ' ')"
