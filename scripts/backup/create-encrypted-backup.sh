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
  -c 'set role dpg_backup; select 1' \
  >"$tmp_dir/connection.status" 2>"$tmp_dir/connection.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=connection reason=database_connection_failed'
  exit 1
fi
if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "set role dpg_backup; select count(*) from dpg_control.target_contract where singleton and project_name = 'dongphugia-runtime' and region = 'ap-southeast-1' and environment = 'preview' and data_class = 'production-derived-reduced-runtime' and production_data_allowed is true and production_credentials_allowed is false and production_writes_allowed is false and hard_database_ceiling_bytes = 367001600" \
  >"$target_contract" 2>"$tmp_dir/target-contract.error"; then
  reason='target_contract_select_failed'
  if grep -Eqi 'permission denied|insufficient privilege' "$tmp_dir/target-contract.error"; then
    reason='target_attestation_permission_denied'
  elif grep -Eqi 'does not exist|undefined|undefined_function' "$tmp_dir/target-contract.error"; then
    reason='target_contract_relation_or_function_missing'
  elif grep -Eqi 'syntax error|invalid input syntax' "$tmp_dir/target-contract.error"; then
    reason='target_contract_syntax_failed'
  fi
  echo "LEO540_BACKUP status=FAIL stage=target_attestation reason=$reason"
  exit 1
fi
if [[ "$(<"$target_contract")" != '1' ]]; then
  echo "LEO540_BACKUP status=FAIL stage=target_attestation reason=target_contract_mismatch checks=$(<"$target_contract")"
  exit 1
fi

role_attestation="$tmp_dir/role-attestation.txt"
if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "set role dpg_backup; select (current_user = 'dpg_backup') || '|' || (session_user = 'dpg_backup_login') || '|' || (current_setting('transaction_read_only') = 'on')" \
  >"$role_attestation" 2>"$tmp_dir/role-attestation.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=target_attestation reason=backup_role_attestation_failed'
  exit 1
fi
if [[ "$(<"$role_attestation")" != 'true|true|true' ]]; then
  echo "LEO540_BACKUP status=FAIL stage=target_attestation reason=backup_role_state_mismatch checks=$(<"$role_attestation")"
  exit 1
fi

if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "set role dpg_backup; select not exists (select 1 from pg_tables where schemaname = 'dpg_app' and not has_table_privilege(current_user, schemaname || '.' || tablename, 'SELECT'))" \
  >"$tmp_dir/table-select.status" 2>"$tmp_dir/table-select.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=target_attestation reason=table_select_attestation_failed'
  exit 1
fi
if [[ "$(<"$tmp_dir/table-select.status")" != 't' ]]; then
  echo 'LEO540_BACKUP status=FAIL stage=target_attestation reason=table_select_coverage_failed'
  exit 1
fi

if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  -c "set role dpg_backup; select case when pg_database_size(current_database()) >= hard_database_ceiling_bytes then 'HARD_STOP' when pg_database_size(current_database()) >= 314572800 then 'ALERT_300_MIB' when pg_database_size(current_database()) >= 262144000 then 'ALERT_250_MIB' else 'WITHIN_BUDGET' end from dpg_control.target_contract where singleton" \
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
  -c "set role dpg_backup" \
  >/dev/null 2>"$tmp_dir/manifest-role.error"; then
  echo 'LEO540_BACKUP status=FAIL stage=manifest reason=backup_role_switch_failed'
  exit 1
fi
manifest_probe() {
  local component="$1"
  local query="$2"
  if ! psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
    -c "set role dpg_backup; $query" \
    >"$tmp_dir/manifest-probe.status" 2>"$tmp_dir/manifest-probe.error"; then
    echo "LEO540_BACKUP status=FAIL stage=manifest reason=manifest_${component}_failed"
    exit 1
  fi
}
manifest_probe 'table_catalog' "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('dpg_app', 'dpg_control') and c.relkind in ('r', 'p')"
manifest_probe 'column_defaults' "select count(md5(pg_get_expr(ad.adbin, ad.adrelid))) from pg_attribute a join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum where a.attnum > 0 and not a.attisdropped"
manifest_probe 'index_catalog' "select count(*) from pg_indexes where schemaname in ('dpg_app', 'dpg_control')"
manifest_probe 'index_definitions' "select count(md5(indexdef)) from pg_indexes where schemaname in ('dpg_app', 'dpg_control')"
manifest_probe 'constraint_catalog' "select count(*) from pg_constraint con join pg_class cls on cls.oid = con.conrelid join pg_namespace ns on ns.oid = cls.relnamespace where ns.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'constraint_definitions' "select count(md5(pg_get_constraintdef(con.oid))) from pg_constraint con join pg_class cls on cls.oid = con.conrelid join pg_namespace ns on ns.oid = cls.relnamespace where ns.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'view_catalog' "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('dpg_app', 'dpg_control') and c.relkind in ('v', 'm')"
manifest_probe 'view_definitions' "select count(md5(pg_get_viewdef(c.oid, true))) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('dpg_app', 'dpg_control') and c.relkind in ('v', 'm')"
manifest_probe 'function_catalog' "select count(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'function_config' "select count(md5(coalesce(array_to_string(p.proconfig, E'\\n'), ''))) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'trigger_catalog' "select count(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'policy_catalog' "select count(pg_get_expr(p.polqual, p.polrelid)) from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('dpg_app', 'dpg_control')"
manifest_probe 'policy_check' "select count(pg_get_expr(p.polwithcheck, p.polrelid)) from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('dpg_app', 'dpg_control')"
if { printf 'set role dpg_backup;\n'; cat "$repo_root/scripts/backup/runtime-manifest.sql"; } | psql "$DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
  >"$manifest_raw" 2>"$tmp_dir/manifest.error"; then
  :
else
  psql_status="$?"
  reason='manifest_query_failed'
  if grep -Eqi 'permission denied|insufficient privilege' "$tmp_dir/manifest.error"; then
    reason='manifest_permission_denied'
  elif grep -Eqi 'statement timeout|canceling statement' "$tmp_dir/manifest.error"; then
    reason='manifest_query_timeout'
  elif grep -Eqi 'does not exist|undefined|undefined_function' "$tmp_dir/manifest.error"; then
    reason='manifest_catalog_or_function_missing'
  elif grep -Eqi 'syntax error|invalid input syntax' "$tmp_dir/manifest.error"; then
    reason='manifest_query_syntax_failed'
  fi
  sqlstate="$(awk '/ERROR:/{for (field = 1; field <= NF; field++) if ($field != "ERROR:" && $field ~ /^[0-9A-Z]{5}:?$/) {gsub(/:/, "", $field); print $field; exit}}' "$tmp_dir/manifest.error")"
  if [[ ! "$sqlstate" =~ ^[0-9A-Z]{5}$ ]]; then sqlstate='unknown'; fi
  echo "LEO540_BACKUP status=FAIL stage=manifest reason=$reason sqlstate=$sqlstate exit_code=$psql_status"
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
if ! pg_dump "$DATABASE_URL" --role=dpg_backup --format=custom --no-owner --no-privileges --no-comments \
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
