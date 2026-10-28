import { CATALOGUE_TABLES, identifier, requireGate } from './contract.mjs'

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]))
  return value
}

// Metadata and aggregate/empty-state only; never retrieve catalogue rows.
export async function setupState(client, schema) {
  requireGate(['public','dpg_app'].includes(schema), 'SETUP_SCHEMA')
  const tables=[]
  for (const name of CATALOGUE_TABLES) {
    const relation=`${schema}.${name}`
    const {rows:[table]}=await client.query(`select c.relname as name, pg_get_userbyid(c.relowner) as owner,
      c.relacl::text as acl,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
      from pg_class c where c.oid=$1::regclass`,[relation])
    requireGate(table, 'SETUP_TABLE_MISSING')
    table.rows=schema==='dpg_app' ? Number((await client.query(`select count(*)::text as n from ${identifier(schema)}.${identifier(name)}`)).rows[0].n) : null
    table.columns=(await client.query(`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,
      a.attnotnull as not_null,a.attidentity as identity,a.attgenerated as generated,pg_get_expr(d.adbin,d.adrelid) as default
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`,[relation])).rows
    table.constraints=(await client.query(`select conname as name,pg_get_constraintdef(oid) as definition,convalidated as validated
      from pg_constraint where conrelid=$1::regclass`,[relation])).rows
    table.indexes=(await client.query(`select pg_get_indexdef(indexrelid) as definition from pg_index where indrelid=$1::regclass`,[relation])).rows.map(r=>r.definition)
    table.policies=(await client.query(`select polname as name,polroles::text as roles,polcmd as command,
      pg_get_expr(polqual,polrelid) as using,pg_get_expr(polwithcheck,polrelid) as check
      from pg_policy where polrelid=$1::regclass`,[relation])).rows
    table.triggers=(await client.query(`select pg_get_triggerdef(oid) as definition,pg_get_functiondef(tgfoid) as function
      from pg_trigger where tgrelid=$1::regclass and not tgisinternal`,[relation])).rows
    tables.push(table)
  }
  const sequences=(await client.query(`select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relacl::text as acl,
    s.seqstart::text as start,s.seqincrement::text as increment,s.seqmin::text as min,s.seqmax::text as max,
    s.seqcache::text as cache,s.seqcycle as cycle from pg_sequence s join pg_class c on c.oid=s.seqrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1
    and exists(select 1 from pg_depend d join pg_class t on t.oid=d.refobjid
      join pg_namespace tn on tn.oid=t.relnamespace where d.objid=c.oid and d.deptype in ('a','i')
      and tn.nspname=$1 and t.relname=any($2::text[]))`,[schema,CATALOGUE_TABLES])).rows
  const sequence_state=[]
  for(const seq of sequences) sequence_state.push({name:seq.name,...(await client.query(
    `select last_value::text,is_called from ${identifier(schema)}.${identifier(seq.name)}`)).rows[0]})
  const new_roles=(await client.query(`select rolname from pg_roles where rolname=any($1::text[])`,[
    schema==='public'?['dpg_direct_source']:['dpg_direct_read','dpg_direct_import']])).rows
  const security_semantics=(await client.query(`select c.relname as table_name,'policy' as kind,p.polname as name,
    p.polpermissive::text as state from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relname=any($2::text[])
    union all select c.relname,'trigger',t.tgname,t.tgenabled::text from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=$1 and c.relname=any($2::text[]) and not t.tgisinternal`,[schema,CATALOGUE_TABLES])).rows
  if(schema==='dpg_app') for(const item of security_semantics) {
    // Canonical boundary migration creates permissive SELECT policies and
    // normally enabled statement guards. The older checkpoint omits these
    // flags; validate the canonical semantics and preserve them in this unit.
    if(item.kind==='policy') requireGate(item.state==='true','SETUP_POLICY_SEMANTICS')
    if(item.kind==='trigger' && item.name==='leo538_free_tier_headroom')
      requireGate(['O','A'].includes(item.state),'SETUP_TRIGGER_SEMANTICS')
  }
  const {rows:[helper]}=await client.query(`select to_regprocedure('dpg_app.direct_catalogue_restart(text,text,bigint)')::text as value`)
  return {tables,sequences,sequence_state,new_roles,new_helper:helper.value,security_semantics}
}

export function assertBeforeSetup(expected, actual) {
  for (const field of ['tables','sequences','sequence_state','new_roles','new_helper']) {
    requireGate(JSON.stringify(canonical(expected[field]))===JSON.stringify(canonical(actual[field])), 'SETUP_BEFORE_STATE_CHANGED')
  }
  if(expected.security_semantics) requireGate(JSON.stringify(canonical(expected.security_semantics))===
    JSON.stringify(canonical(actual.security_semantics)),'SETUP_BEFORE_STATE_CHANGED')
}
