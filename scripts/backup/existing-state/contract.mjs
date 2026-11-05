import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url))

export const baseline = JSON.parse(readFileSync(join(directory, 'baseline.json'), 'utf8'))
export const INVENTORY_SQL = readFileSync(join(directory, 'inventory.sql'), 'utf8')
export const CAPABILITY = 'dpg_backup'
export const POLICY = 'existing_state_backup_select'
export const CONTRACT = 'dongphugia:existing-state-backup:v1'
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]))
  return value
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
export const baselineSha = fingerprint(baseline)
export function requireGate(condition, reason) { if (!condition) throw new Error(reason) }
export function ident(value) {
  requireGate(/^[a-z][a-z0-9_]*$/.test(value), 'identifier_invalid')
  return `"${value}"`
}
export const qualified = name => name.split('.').map(ident).join('.')
export function validateBaseline(value) {
  requireGate(value?.version === 1 && value.target === 'bonxyxluzlxfkdetryoo', 'baseline_target_invalid')
  requireGate(JSON.stringify(value.schemas.map(s=>s.name)) === '["dpg_app","dpg_control"]', 'baseline_schemas_invalid')
  for (const r of value.relations) {
    requireGate(/^(dpg_app|dpg_control)\.[a-z][a-z0-9_]*$/.test(r.name), 'baseline_relation_invalid')
    requireGate(['r','p','S','v'].includes(r.kind), 'baseline_kind_invalid')
    requireGate(/^[a-f0-9]{64}$/.test(r.shape), 'baseline_shape_invalid')
  }
  requireGate(new Set(value.relations.map(r=>r.name)).size === value.relations.length, 'baseline_duplicate')
  requireGate(value.creator?.name==='postgres' && value.creator.super===false && value.creator.createRole===true && value.creator.bootstrapSuper===true, 'baseline_creator_invalid')
  requireGate(value.roles.every(r=>r.name !== CAPABILITY && r.name !== 'dpg_backup_login'), 'baseline_backup_role_exists')
}
validateBaseline(baseline)
export const tablesFor = value => value.relations.filter(r => ['r','p'].includes(r.kind))
export const sequencesFor = value => value.relations.filter(r => r.kind === 'S')
export const tables = tablesFor(baseline)
export const sequences = sequencesFor(baseline)

export function bootstrapStatements(value = baseline) {
  validateBaseline(value)
  const sql = ['create role dpg_backup nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 0']
  for (const s of value.schemas) sql.push(`grant usage on schema ${ident(s.name)} to dpg_backup`)
  for (const r of value.relations) {
    if (['r','p'].includes(r.kind)) {
      sql.push(`grant select on table ${qualified(r.name)} to dpg_backup`)
      if (r.rls) sql.push(`create policy ${ident(POLICY)} on ${qualified(r.name)} for select to dpg_backup using (true)`)
    } else if (r.kind === 'S') sql.push(`grant select on sequence ${qualified(r.name)} to dpg_backup`)
  }
  return sql
}

export function assertInventory(actual, backupPresent = false, expectedInventory = baseline) {
  const normalized = structuredClone(actual)
  if (backupPresent) {
    const role = normalized.roles.find(r => r.name === CAPABILITY)
    requireGate(role && !role.login && !role.super && !role.createDb && !role.createRole && !role.inherit && !role.replication && !role.bypassRls && role.limit === 0, 'capability_role_invalid')
    requireGate(role.settingsHash === createHash('sha256').update('').digest('hex'), 'capability_settings_invalid')
    normalized.roles = normalized.roles.filter(r => r.name !== CAPABILITY)
    const creatorGrant=[CAPABILITY,expectedInventory.creator.name,true,false,false,expectedInventory.creator.bootstrapGrantor]
    const grants=normalized.memberships.filter(m=>m.slice(0,2).includes(CAPABILITY))
    requireGate(grants.length===1 && JSON.stringify(grants[0])===JSON.stringify(creatorGrant),'capability_memberships_invalid')
    normalized.memberships=normalized.memberships.filter(m=>!m.slice(0,2).includes(CAPABILITY))
    for (const s of normalized.schemas) {
      const grants = s.acl.filter(a=>a.grantee === CAPABILITY)
      requireGate(grants.length === 1 && grants[0].privilege === 'USAGE' && !grants[0].grantable && grants[0].grantor === s.owner, 'capability_schema_grants_invalid')
      s.acl = s.acl.filter(a=>a.grantee !== CAPABILITY)
    }
    const trueHash = createHash('sha256').update('true').digest('hex')
    for (const r of normalized.relations) {
      const expected = expectedInventory.relations.find(b=>b.name === r.name)
      requireGate(expected, 'unexpected_relation')
      const allowed = ['r','p','S'].includes(r.kind)
      const grants = r.acl.filter(a=>a.grantee === CAPABILITY)
      requireGate(grants.length === (allowed ? 1 : 0) && grants.every(a=>a.privilege === 'SELECT' && !a.grantable && a.grantor === r.owner), 'capability_relation_grants_invalid')
      r.acl = r.acl.filter(a=>a.grantee !== CAPABILITY)
      const policies = r.policies.filter(p=>p.name === POLICY)
      requireGate(policies.length === (['r','p'].includes(r.kind) && expected.rls ? 1 : 0), 'capability_policy_count_invalid')
      for (const p of policies) requireGate(p.command === 'r' && p.permissive && JSON.stringify(p.roles) === '["dpg_backup"]' && p.usingHash === trueHash && p.checkHash === null, 'capability_policy_invalid')
      r.policies = r.policies.filter(p=>p.name !== POLICY)
    }
  }
  requireGate(fingerprint(normalized) === fingerprint(expectedInventory), 'inventory_drift')
}

export function dataStateSql(expected = baseline) {
  const selects = tablesFor(expected).map(t=>`select '${t.name}'::text as identity, count(*)::text as count, encode(sha256(convert_to(coalesce(string_agg(row_hash, '' order by row_hash collate "C"),''),'UTF8')),'hex') as hash from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') as row_hash from ${qualified(t.name)} x) digest_rows`)
  const seqs = sequencesFor(expected).map(s=>`select '${s.name}'::text as identity, '1'::text as count, encode(sha256(convert_to(jsonb_build_array(last_value,is_called)::text,'UTF8')),'hex') as hash from ${qualified(s.name)}`)
  return `select jsonb_agg(to_jsonb(entry) order by identity) as state from (${[...selects,...seqs].join('\nunion all\n')}) entry`
}
export function assertStateShape(state, contract = baseline) {
  const expected = [...tablesFor(contract),...sequencesFor(contract)].map(r=>r.name).sort()
  requireGate(Array.isArray(state) && state.length === expected.length, 'state_shape_invalid')
  requireGate(JSON.stringify(state.map(x=>x.identity).sort()) === JSON.stringify(expected), 'state_identity_invalid')
  requireGate(state.every(x=>/^(0|[1-9]\d*)$/.test(x.count) && /^[a-f0-9]{64}$/.test(x.hash)), 'state_entry_invalid')
}
export function assertStateEqual(before, after, contract = baseline) {
  assertStateShape(before, contract); assertStateShape(after, contract)
  requireGate(fingerprint(before) === fingerprint(after), 'data_preservation_failed')
}
// Restore deliberately omits original ownership/ACLs; functional definitions,
// policies, table flags, columns, constraints, indexes, triggers and data match.
export function restoreShape(inventory) {
  return {
    schemas:inventory.schemas.map(s=>s.name),
    relations:inventory.relations.map(r=>({name:r.name,kind:r.kind,rls:r.rls,forceRls:r.forceRls,shape:r.shape,policies:r.policies})),
    routines:inventory.routines.map(r=>({name:r.name,definitionHash:r.definitionHash})),
    types:inventory.types.map(t=>[t[0],t[1],t[3]]),
  }
}
