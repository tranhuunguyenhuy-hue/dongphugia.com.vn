import { createHash } from 'node:crypto'
import { ident, fingerprint, requireGate } from './contract.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
const ordered=value=>[...value].sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1)
export const PUBLIC_API_SQL=`select coalesce(jsonb_agg(jsonb_build_object(
  'name',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'aclText',p.proacl::text,
  'privileges',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type,a.grantor) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
) order by p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) as api
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') and p.proname like 'runtime\\_%' escape '\\'`
function verifyAcl(row) {
  const role=/^[a-z][a-z0-9_]*$/
  requireGate(role.test(row.owner) && Array.isArray(row.privileges),'api_owner_or_acl_invalid')
  for(const a of row.privileges)requireGate((a.grantee==='PUBLIC' || role.test(a.grantee)) && a.grantor===row.owner && a.privilege==='EXECUTE' && typeof a.grantable==='boolean','api_acl_grantor_or_privilege_invalid')
  let expected
  if(row.aclText===null)expected=['PUBLIC',row.owner].map(grantee=>({grantee,grantor:row.owner,privilege:'EXECUTE',grantable:false}))
  else {
    requireGate(typeof row.aclText==='string' && row.aclText.startsWith('{') && row.aclText.endsWith('}'),'api_acl_text_invalid')
    expected=row.aclText.slice(1,-1).split(',').filter(Boolean).map(item=>{
      const m=/^([a-z][a-z0-9_]*|)=X(\*)?\/([a-z][a-z0-9_]*)$/.exec(item)
      requireGate(m,'api_acl_text_unsupported')
      return {grantee:m[1]||'PUBLIC',grantor:m[3],privilege:'EXECUTE',grantable:Boolean(m[2])}
    })
  }
  requireGate(fingerprint(ordered(expected))===fingerprint(ordered(row.privileges)),'api_acl_entries_mismatch')
}
function privilegeSql(row) {
  requireGate(/^public\.runtime_[a-z_]+\([a-z_0-9 ,]*\)$/.test(row.name),'api_signature_invalid')
  const owner=ident(row.owner)
  let sql=`alter function ${row.name} owner to ${owner};\n`
  if(row.aclText===null)return sql
  sql+=`set role ${owner};\nrevoke all on function ${row.name} from public, ${owner};\n`
  for(const a of row.privileges)sql+=`grant execute on function ${row.name} to ${a.grantee==='PUBLIC'?'public':ident(a.grantee)}${a.grantable?' with grant option':''};\n`
  return sql+'reset role;\n'
}
export function preservePublicApi(rows,inventory,requirePreservedSql=false) {
  const expected=inventory.routines.filter(r=>r.name.startsWith('public.runtime_'))
  requireGate(Array.isArray(rows) && rows.length===expected.length && new Set(rows.map(r=>r.name)).size===expected.length,'api_set_invalid')
  return rows.map(row=>{
    const reference=expected.find(r=>r.name===row.name)
    requireGate(reference && typeof row.definition==='string' && hash(row.definition)===reference.definitionHash && row.owner===reference.owner && hash(row.aclText??'')===reference.aclHash,'api_snapshot_metadata_mismatch')
    verifyAcl(row)
    const restorePrivilegesSql=privilegeSql(row)
    if(requirePreservedSql)requireGate(row.restorePrivilegesSql===restorePrivilegesSql,'api_recovery_statements_mismatch')
    return {...row,restorePrivilegesSql}
  })
}
