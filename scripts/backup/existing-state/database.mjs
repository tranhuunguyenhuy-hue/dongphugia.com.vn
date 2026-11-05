import pg from 'pg'
import { parseSupabaseRuntimeTarget } from '../supabase-runtime-target.mjs'
import { baseline, baselineSha, INVENTORY_SQL, assertInventory, assertStateEqual, assertStateShape, bootstrapStatements, dataStateSql, tables, sequences, tablesFor, sequencesFor, qualified, requireGate, fingerprint } from './contract.mjs'

export function connection(value, backup = false) {
  if (!backup) return parseSupabaseRuntimeTarget(value)
  let parsed
  try { parsed = new URL(value) } catch { throw new Error('backup_url_invalid') }
  const pooler = parsed.hostname === 'aws-0-ap-southeast-1.pooler.supabase.com'
  requireGate(decodeURIComponent(parsed.username) === (pooler ? 'dpg_backup_login.bonxyxluzlxfkdetryoo' : 'dpg_backup_login'), 'backup_user_invalid')
  const user = decodeURIComponent(parsed.username)
  parsed.username = pooler ? 'postgres.bonxyxluzlxfkdetryoo' : 'postgres'
  return { ...parseSupabaseRuntimeTarget(parsed.toString()), user }
}
export async function readInventory(client) {
  const result = await client.query(INVENTORY_SQL)
  return (Array.isArray(result) ? result.at(-1) : result).rows[0].inventory
}
export async function readState(client, expected = baseline) {
  const result = (await client.query(dataStateSql(expected))).rows[0].state
  assertStateShape(result, expected)
  return result
}
export async function assertTarget(client) {
  const r = (await client.query(`select
    current_setting('server_version_num')::integer between 170000 and 179999 as version,
    pg_database_size(current_database()) < 262144000 as size,
    exists(select 1 from dpg_control.target_contract where singleton and project_name='dongphugia-runtime' and region='ap-southeast-1' and environment='preview' and data_class='production-derived-reduced-runtime' and production_data_allowed and not production_credentials_allowed and not production_writes_allowed and hard_database_ceiling_bytes=367001600) as target,
    not exists(select 1 from pg_largeobject_metadata) as no_large_objects
  `)).rows[0]
  requireGate(r && Object.values(r).every(v=>v === true), 'target_or_budget_failed')
}
export async function assertDirectRights(client, role, capability = false, expected = baseline) {
  const permitted = capability ? [...tablesFor(expected),...sequencesFor(expected)].map(r=>r.name) : []
  const namespaces = capability ? expected.schemas.map(s=>s.name) : []
  const result = await client.query(`with subject as (select oid from pg_roles where rolname=$1), unexpected as (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace, lateral aclexplode(c.relacl) a
      where a.grantee=(select oid from subject) and not(n.nspname||'.'||c.relname=any($2::text[]) and a.privilege_type='SELECT' and not a.is_grantable)
    union all select 1 from pg_namespace n, lateral aclexplode(n.nspacl) a
      where a.grantee=(select oid from subject) and not(n.nspname=any($3::text[]) and a.privilege_type='USAGE' and not a.is_grantable)
    union all select 1 from pg_proc p, lateral aclexplode(p.proacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_type t, lateral aclexplode(t.typacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_database d, lateral aclexplode(d.datacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_tablespace t, lateral aclexplode(t.spcacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_foreign_server s, lateral aclexplode(s.srvacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_foreign_data_wrapper w, lateral aclexplode(w.fdwacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_default_acl d, lateral aclexplode(d.defaclacl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_parameter_acl p, lateral aclexplode(p.paracl) a where a.grantee=(select oid from subject)
    union all select 1 from pg_shdepend where refclassid='pg_authid'::regclass and refobjid=(select oid from subject) and deptype='o'
  ) select exists(select 1 from subject) and not exists(select 1 from unexpected) as safe`,[role,permitted,namespaces])
  requireGate(result.rows[0]?.safe===true,'direct_rights_or_ownership_failed')
}
export async function assertCapability(client, expected = baseline) {
  await assertDirectRights(client,'dpg_backup',true,expected)
  const allowedTables = [...tablesFor(expected).map(t=>t.name), ...expected.publicReadViews.map(v=>v.name)]
  const allowedSequences = sequencesFor(expected).map(s=>s.name)
  const result = await client.query(`select
    not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and (
        (c.relkind in ('r','p','v','m','f') and (
          has_table_privilege('dpg_backup',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          or (n.nspname||'.'||c.relname <> all($1::text[]) and has_table_privilege('dpg_backup',c.oid,'SELECT'))))
        or (c.relkind='S' and (has_sequence_privilege('dpg_backup',c.oid,'UPDATE,USAGE')
          or (n.nspname||'.'||c.relname <> all($2::text[]) and has_sequence_privilege('dpg_backup',c.oid,'SELECT'))))
        or c.relowner=(select oid from pg_roles where rolname='dpg_backup'))) as relations_safe,
    not exists(select 1 from pg_namespace where has_schema_privilege('dpg_backup',oid,'CREATE')) as no_schema_create,
    not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and
      (p.proowner=(select oid from pg_roles where rolname='dpg_backup') or
      (p.prosecdef and has_schema_privilege('dpg_backup',n.oid,'USAGE') and has_function_privilege('dpg_backup',p.oid,'EXECUTE')))) as routines_safe,
    not exists(select 1 from pg_database where datdba=(select oid from pg_roles where rolname='dpg_backup') or has_database_privilege('dpg_backup',oid,'CREATE')) as databases_safe,
    not exists(select 1 from pg_type where typowner=(select oid from pg_roles where rolname='dpg_backup')) as types_safe
  `, [allowedTables,allowedSequences])
  requireGate(Object.values(result.rows[0] ?? {}).length === 5 && Object.values(result.rows[0]).every(v=>v === true), 'capability_effective_privileges_failed')
}

export async function bootstrap(client, expectedSha, expected = baseline) {
  requireGate(expectedSha === fingerprint(expected), 'baseline_sha_mismatch')
  await client.query('begin isolation level serializable')
  try {
    await client.query("set local lock_timeout='5s'; set local statement_timeout='120s'; set local idle_in_transaction_session_timeout='180s'")
    // Quiescence is Owner-attested at execution approval. Locks also block table
    // writes; sequences are observed twice because nextval is nontransactional.
    await client.query(`lock table ${tablesFor(expected).map(t=>qualified(t.name)).join(',')} in share row exclusive mode`)
    await assertTarget(client)
    assertInventory(await readInventory(client), false, expected)
    requireGate(!(await client.query("select exists(select 1 from pg_roles where rolname='dpg_backup_login') as present")).rows[0].present, 'backup_login_already_exists')
    const before = await readState(client, expected)
    for (const sql of bootstrapStatements(expected)) await client.query(sql)
    assertInventory(await readInventory(client), true, expected)
    await assertCapability(client, expected)
    await client.query('set local role dpg_backup')
    assertStateEqual(before, await readState(client, expected), expected)
    await client.query('reset role')
    assertStateEqual(before, await readState(client, expected), expected)
    await assertTarget(client)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(()=>{})
    throw error
  }
}

export async function inspect(client) {
  await client.query('begin transaction isolation level repeatable read read only')
  try { await assertTarget(client); assertInventory(await readInventory(client)); }
  finally { await client.query('rollback') }
}

export async function assertBackupLogin(client) {
  const flags = (await client.query(`select
    session_user='dpg_backup_login' as session_exact,
    current_setting('transaction_read_only')='on' as readonly,
    exists(select 1 from pg_roles where rolname=session_user and rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit and not rolreplication and not rolbypassrls and rolconnlimit=1) as login_safe,
    (select count(*)=1 and bool_and(g.rolname='dpg_backup' and not m.admin_option and m.set_option) from pg_auth_members m join pg_roles g on g.oid=m.roleid where m.member=(select oid from pg_roles where rolname=session_user)) as membership_exact,
    not exists(select 1 from pg_auth_members where roleid=(select oid from pg_roles where rolname=session_user)) as no_members
  `)).rows[0]
  requireGate(flags && Object.values(flags).every(v=>v === true), 'backup_login_contract_failed')
  const directRights = (await client.query(`select not exists(
    select 1 from pg_class c, lateral aclexplode(c.relacl) a where a.grantee=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_namespace n, lateral aclexplode(n.nspacl) a where a.grantee=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_proc p, lateral aclexplode(p.proacl) a where a.grantee=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_type t, lateral aclexplode(t.typacl) a where a.grantee=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_class c where c.relowner=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_namespace where nspowner=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_proc where proowner=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_type where typowner=(select oid from pg_roles where rolname=session_user)
    union all select 1 from pg_database where datdba=(select oid from pg_roles where rolname=session_user)
  ) as safe`)).rows[0]
  requireGate(directRights?.safe === true, 'backup_login_direct_rights_failed')
  await assertDirectRights(client,'dpg_backup_login')
}
export async function backupInventory(client, expected = baseline) {
  const inventory = await readInventory(client)
  const normalized = structuredClone(inventory)
  const login = normalized.roles.find(r=>r.name === 'dpg_backup_login')
  requireGate(login && login.login && !login.super && !login.createRole && !login.createDb && !login.bypassRls && !login.replication && !login.inherit && login.limit === 1, 'backup_login_flags_failed')
  normalized.roles = normalized.roles.filter(r=>r.name !== 'dpg_backup_login')
  const membership = normalized.memberships.filter(m=>m.slice(0,2).includes('dpg_backup_login'))
  requireGate(membership.length === 1 && membership[0][0] === 'dpg_backup' && membership[0][1] === 'dpg_backup_login' && !membership[0][2] && membership[0][4], 'backup_login_membership_failed')
  normalized.memberships = normalized.memberships.filter(m=>!m.slice(0,2).includes('dpg_backup_login'))
  assertInventory(normalized, true, expected)
  return inventory
}
export const API_SQL = `select coalesce(string_agg(pg_get_functiondef(p.oid),E'\n' order by p.proname,pg_get_function_identity_arguments(p.oid)),'') as definitions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') and p.proname like 'runtime\\_%' escape '\\'`

export async function main() {
  const mode=process.argv[2]
  requireGate(['inspect','bootstrap'].includes(mode), 'mode_invalid')
  const client=new pg.Client(connection(process.env.SUPABASE_REHOME_DATABASE_URL))
  client.on('error',()=>{})
  try {
    await client.connect()
    if(mode==='inspect') await inspect(client)
    else await bootstrap(client,process.env.APPROVED_BASELINE_SHA)
    process.stdout.write(`EXISTING_BACKUP status=PASS mode=${mode} baseline=${baselineSha} tables=${tables.length} sequences=${sequences.length}\n`)
  } finally { await client.end().catch(()=>{}) }
}
if(process.argv[1]?.endsWith('/existing-state/database.mjs')) void main().catch(()=>{
  process.stderr.write('EXISTING_BACKUP status=FAIL reason=contract_or_database_operation_failed\n');process.exitCode=1
})
