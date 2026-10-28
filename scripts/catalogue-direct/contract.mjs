import { createHash } from 'node:crypto'
import { checkServerIdentity } from 'node:tls'
import { CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER } from '../backup/catalogue-restore-contract.mjs'

export { CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER }
export const CONTRACT = 'dpg:direct-catalogue:v1'
export const SOURCE = 'tygjmrhandbffjllxveu'
export const TARGET = 'bonxyxluzlxfkdetryoo'
export const ENVIRONMENT = 'catalogue-direct-migration'
export const DATABASE_CEILING = 367001600
export const CHECKPOINT_CEILING = 200000000
export const HASH = /^[a-f0-9]{64}$/
export const SHA = /^[a-f0-9]{40}$/
export const digest = (value) => createHash('sha256').update(value).digest('hex')
export function requireGate(condition, code) {
  if (!condition) throw new Error(code)
}
export function tableIdentifier(table) {
  requireGate(CATALOGUE_TABLES.includes(table), 'TABLE_OUTSIDE_ALLOWLIST')
  return `"${table}"`
}
export function identifier(name) {
  requireGate(typeof name === 'string' && /^[a-z][a-z0-9_]*$/.test(name), 'UNSAFE_IDENTIFIER')
  return `"${name}"`
}
export function connectionConfig(value, ca, project) {
  requireGate([SOURCE, TARGET].includes(project), 'PROJECT_OUTSIDE_SCOPE')
  let url
  try { url = new URL(value) } catch { throw new Error('INVALID_CONNECTION') }
  const direct = url.hostname === `db.${project}.supabase.co`
  const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  const username = decodeURIComponent(url.username)
  requireGate(url.protocol === 'postgresql:' && url.pathname === '/postgres', 'INVALID_CONNECTION')
  requireGate(direct || (pooler && username.endsWith(`.${project}`)), 'WRONG_PROJECT')
  requireGate((url.port || '5432') === '5432', 'SESSION_CONNECTION_REQUIRED')
  requireGate(url.search === '' && url.hash === '', 'CONNECTION_OPTIONS_FORBIDDEN')
  requireGate(!['postgres', `postgres.${project}`].includes(username), 'ADMIN_CREDENTIAL_FORBIDDEN')
  requireGate(ca?.includes('-----BEGIN CERTIFICATE-----'), 'CA_REQUIRED')
  return {
    host: url.hostname, port: 5432, database: 'postgres', user: username,
    password: decodeURIComponent(url.password), connectionTimeoutMillis: 15000,
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname, checkServerIdentity },
    application_name: 'dpg-direct-catalogue',
    options: '-c search_path=pg_catalog -c statement_timeout=180000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=180000',
  }
}
export function assertBudget(attestation, now = Date.now()) {
  requireGate(attestation && attestation.billableUsd === 0 && attestation.paidUsageBlocked === true,
    'ZERO_COST_EVIDENCE_REQUIRED')
  requireGate(Number.isSafeInteger(attestation.checkpointBytesRemaining)
    && attestation.checkpointBytesRemaining >= CHECKPOINT_CEILING, 'CHECKPOINT_QUOTA_REQUIRED')
  const time = Date.parse(attestation.verifiedAt)
  requireGate(Number.isFinite(time) && now >= time && now - time <= 86400000, 'BUDGET_EVIDENCE_STALE')
}
export function assertManifest(manifest) {
  requireGate(manifest?.contract === CONTRACT && manifest.source === SOURCE
    && manifest.target === TARGET && SHA.test(manifest.codeSha), 'MANIFEST_IDENTITY')
  requireGate(Array.isArray(manifest.tables) && manifest.tables.length === 27, 'MANIFEST_TABLE_SET')
  const names = manifest.tables.map((t) => t.name)
  requireGate(new Set(names).size === 27 && CATALOGUE_TABLES.every((t) => names.includes(t)), 'MANIFEST_TABLE_SET')
  for (const table of manifest.tables) {
    requireGate(Number.isSafeInteger(table.count) && table.count >= 0 && HASH.test(table.hash), 'MANIFEST_DATA')
  }
  return manifest
}
export function normalizeDefinition(value) {
  return value.replaceAll('public.', '').replaceAll('dpg_app.', '')
}
export function comparableSchema(metadata) {
  return metadata.map((table) => ({
    name: table.name,
    columns: table.columns.map((c) => ({ name: c.name, type: normalizeDefinition(c.type),
      notNull: c.notNull, generated: c.generated, identity: c.identity,
      default: normalizeDefinition(c.default ?? '') })),
    constraints: table.constraints.map(normalizeDefinition).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name))
}
export function assertSchema(source, target) {
  requireGate(JSON.stringify(comparableSchema(source)) === JSON.stringify(comparableSchema(target)), 'SCHEMA_MAPPING_MISMATCH')
  for (const table of target) {
    requireGate(table.rls && table.forceRls, 'TARGET_RLS_REQUIRED')
    requireGate(table.insertTriggers.length === 0, 'INSERT_TRIGGER_REVIEW_REQUIRED')
    requireGate(table.columns.every((c) => !c.generated), 'GENERATED_COLUMN_REVIEW_REQUIRED')
  }
}
export function rowsSql(schema, table) {
  requireGate(['public', 'dpg_app'].includes(schema), 'SCHEMA_OUTSIDE_SCOPE')
  return `select to_jsonb(t)::text as row_text from ${identifier(schema)}.${tableIdentifier(table)} t order by to_jsonb(t)::text collate "C"`
}
export function insertSql(table, columns) {
  requireGate(columns.length > 0 && new Set(columns).size === columns.length, 'INVALID_COLUMNS')
  const names = columns.map(identifier).join(', ')
  return `insert into dpg_app.${tableIdentifier(table)} (${names}) overriding system value select ${names} from json_populate_recordset(null::dpg_app.${tableIdentifier(table)}, $1::json)`
}
export function assertResume(stage, checkpoint) {
  requireGate(['export', 'import', 'verify'].includes(stage), 'UNKNOWN_STAGE')
  requireGate(stage === 'export' ? !checkpoint : SHA.test(checkpoint ?? ''), 'CHECKPOINT_REQUIRED')
}

// ALTER SEQUENCE RESTART is transactional; setval() is deliberately never used.
// Keep this body identical in the installed function and the pre-write attestation.
export const SEQUENCE_BODY = `
declare
  linked text;
  highest bigint;
begin
  if session_user <> 'dpg_direct_import' or table_name <> all(array[${CATALOGUE_TABLES.map((t) => `'${t}'`).join(',')}]) then
    raise exception 'DIRECT_SEQUENCE_SCOPE';
  end if;
  linked := pg_get_serial_sequence(format('dpg_app.%I',table_name),column_name);
  if linked is null or split_part(linked,'.',1) <> 'dpg_app'
    or not exists(select 1 from pg_sequence where seqrelid=linked::regclass and seqincrement=1
      and restart_at between seqmin and seqmax) then
    raise exception 'DIRECT_SEQUENCE_SCOPE';
  end if;
  execute format('select max(%I)::bigint from dpg_app.%I',column_name,table_name) into highest;
  if highest is not null and restart_at <= highest then
    raise exception 'DIRECT_SEQUENCE_BOUND';
  end if;
  execute format('alter sequence %s restart with %s',linked,restart_at);
end
`

export function provisioningSql(purpose) {
  requireGate(['source', 'read', 'import'].includes(purpose), 'ROLE_PURPOSE')
  const schema = purpose === 'source' ? 'public' : 'dpg_app'
  const role = `dpg_direct_${purpose}`
  // No password or global ACL changes. Existing roles are never silently altered.
  const grants = CATALOGUE_TABLES.map((t) => `grant ${purpose === 'import' ? 'select, insert' : 'select'} on ${schema}.${identifier(t)} to ${role};`).join('\n')
  const sequenceGrants = `do $grant_sequences$
declare item record; linked text;
begin
  for item in select a.attname,c.relname from pg_attribute a
    join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='${schema}' and c.relname=any(array[${CATALOGUE_TABLES.map((t) => `'${t}'`).join(',')}])
      and a.attnum>0 and not a.attisdropped
  loop
    linked := pg_get_serial_sequence(format('${schema}.%I',item.relname),item.attname);
    if linked is not null then execute format('grant select on sequence %s to ${role}',linked); end if;
  end loop;
end $grant_sequences$;`
  const helper = purpose === 'import' ? `
create function dpg_app.direct_catalogue_restart(table_name text,column_name text,restart_at bigint)
returns void language plpgsql security definer set search_path=pg_catalog
as $direct_restart$${SEQUENCE_BODY}$direct_restart$;
revoke all on function dpg_app.direct_catalogue_restart(text,text,bigint) from public;
grant execute on function dpg_app.direct_catalogue_restart(text,text,bigint) to ${role};` : ''
  return `begin;
create role ${role} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls;
grant connect on database postgres to ${role};
grant usage on schema ${schema} to ${role};
${grants}
${sequenceGrants}
${helper}
commit;
-- Role remains NOLOGIN. Set its login/password through a protected provisioning session.
-- Never weaken PUBLIC ACLs automatically if inherited privileges fail attestation.
`
}
