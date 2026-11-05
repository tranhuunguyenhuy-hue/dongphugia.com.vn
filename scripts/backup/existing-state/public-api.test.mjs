import { createHash } from 'node:crypto'
import { it, expect } from 'vitest'
import { preservePublicApi } from './public-api.mjs'
const hash=s=>createHash('sha256').update(s).digest('hex')
const row=()=>({name:'public.runtime_example(value text)',definition:'CREATE FUNCTION public.runtime_example(value text) RETURNS text LANGUAGE sql AS $$SELECT value$$;\n',owner:'postgres',aclText:'{postgres=X/postgres,authenticated=X/postgres}',privileges:[{grantee:'postgres',grantor:'postgres',privilege:'EXECUTE',grantable:false},{grantee:'authenticated',grantor:'postgres',privilege:'EXECUTE',grantable:false}]})
const inventory=r=>({routines:[{name:r.name,owner:r.owner,definitionHash:hash(r.definition),aclHash:hash(r.aclText??'')}]})
it('preserves recoverable public function owners and exact EXECUTE grants inside encrypted record',()=>{
  const r=row(),i=inventory(r),saved=preservePublicApi([r],i)
  expect(saved[0].restorePrivilegesSql).toContain('owner to "postgres"')
  expect(saved[0].restorePrivilegesSql).toContain('to "authenticated"')
  expect(preservePublicApi(saved,i,true)).toEqual(saved)
})
it('rejects altered definitions, grants, owner and recovery SQL',()=>{
  for(const mutate of [r=>{r.definition+='-- changed'},r=>{r.owner='other'},r=>{r.privileges[1].grantable=true},r=>{r.aclText='{=X/postgres}'}]) {
    const r=row(),i=inventory(r);mutate(r);expect(()=>preservePublicApi([r],i)).toThrow()
  }
  const r=row(),i=inventory(r),saved=preservePublicApi([r],i);saved[0].restorePrivilegesSql+='grant all to public;'
  expect(()=>preservePublicApi(saved,i,true)).toThrow('api_recovery_statements_mismatch')
})
it('keeps default/null function ACL semantics without inventing privileges',()=>{
  const r=row();r.aclText=null;r.privileges[1].grantee='PUBLIC'
  const saved=preservePublicApi([r],inventory(r))
  expect(saved[0].restorePrivilegesSql).toBe('alter function public.runtime_example(value text) owner to "postgres";\n')
})
