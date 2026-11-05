import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { baseline, baselineSha, bootstrapStatements, assertInventory, assertStateEqual, dataStateSql, restoreShape, fingerprint, POLICY, tables, sequences } from './contract.mjs'
import { connection } from './database.mjs'
import { validateApproval } from './execution-gate.mjs'
import { validateEnvelope } from './archive.mjs'

function afterBootstrap() {
  const x=structuredClone(baseline)
  x.roles.unshift({name:'dpg_backup',login:false,super:false,createDb:false,createRole:false,inherit:false,replication:false,bypassRls:false,limit:0,settingsHash:createHash('sha256').update('').digest('hex')})
  for(const s of x.schemas)s.acl.push({grantee:'dpg_backup',grantor:s.owner,privilege:'USAGE',grantable:false})
  for(const r of x.relations)if(['r','p','S'].includes(r.kind)) {
    r.acl.push({grantee:'dpg_backup',grantor:r.owner,privilege:'SELECT',grantable:false})
    if(r.rls)r.policies.push({name:POLICY,command:'r',permissive:true,roles:['dpg_backup'],usingHash:createHash('sha256').update('true').digest('hex'),checkHash:null})
  }
  x.memberships.push(['dpg_backup',baseline.creator.name,true,false,false,baseline.creator.bootstrapGrantor])
  return x
}
const state=()=>[...tables,...sequences].map(r=>({identity:r.name,count:'1',hash:'a'.repeat(64)})).sort((a,b)=>a.identity.localeCompare(b.identity))

describe('existing-state backup contract',()=>{
  it('locks actual target coverage and preserves current recovery roles',()=>{
    expect(readFileSync('scripts/backup/existing-state/baseline.sha256','utf8').trim()).toBe(baselineSha)
    expect(tables).toHaveLength(66);expect(sequences).toHaveLength(52)
    expect(baseline.roles).toHaveLength(8)
    expect(baseline.schemas.map(s=>s.name)).toEqual(['dpg_app','dpg_control'])
    expect(()=>assertInventory(structuredClone(baseline))).not.toThrow()
    expect(()=>assertInventory(afterBootstrap(),true)).not.toThrow()
    expect(baseline.publicReadViews.map(v=>v.name)).toEqual(['extensions.pg_stat_statements','extensions.pg_stat_statements_info'])
  })
  it.each(['role','write','grantable','missing','policy','schema','routine','existing_acl','column_acl','creator_set','membership','default'])('rejects unauthorized %s changes',kind=>{
    const x=afterBootstrap()
    if(kind==='role')x.roles.find(r=>r.name==='dpg_backup').bypassRls=true
    if(kind==='write')x.relations.find(r=>r.kind==='r').acl.push({grantee:'dpg_backup',grantor:'dpg_migration',privilege:'INSERT',grantable:false})
    if(kind==='grantable')x.schemas[0].acl.at(-1).grantable=true
    if(kind==='missing')x.relations.pop()
    if(kind==='policy')x.relations.find(r=>r.rls).policies.find(p=>p.name===POLICY).roles.push('PUBLIC')
    if(kind==='schema')x.schemas[0].owner='other'
    if(kind==='routine')x.routines[0].definitionHash='b'.repeat(64)
    if(kind==='existing_acl')x.relations[0].acl[0].grantable=!x.relations[0].acl[0].grantable
    if(kind==='column_acl')x.relations[0].columnAclHash='b'.repeat(64)
    if(kind==='creator_set')x.memberships.find(m=>m[0]==='dpg_backup')[4]=true
    if(kind==='membership')x.memberships.push(['dpg_backup','dpg_runtime',false,false,true])
    if(kind==='default')x.defaults.push(['dpg_backup','dpg_app','r','unexpected'])
    expect(()=>assertInventory(x,true)).toThrow()
  })
  it('generates only capability DDL/SELECT grants, with no data write or legacy history adoption',()=>{
    const sql=bootstrapStatements().join(';\n')
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|bypassrls|login)\b/i)
    expect(sql).not.toContain('runtime_migration_ledger')
    expect(sql).not.toContain('dpg_backup_login')
    expect(sql.match(/grant select on table/g)).toHaveLength(66)
    expect(sql.match(/grant select on sequence/g)).toHaveLength(52)
    expect(sql.match(/create policy/g)).toHaveLength(tables.filter(t=>t.rls).length)
  })
  it('catches changed data, changed sequence state and missing coverage without exposing values',()=>{
    expect(()=>assertStateEqual(state(),state())).not.toThrow()
    expect(()=>assertStateEqual(state(),state().reverse())).not.toThrow()
    const changed=state();changed[0].hash='b'.repeat(64)
    expect(()=>assertStateEqual(state(),changed)).toThrow('data_preservation_failed')
    const seq=state();seq.find(r=>r.identity===sequences[0].name).hash='b'.repeat(64)
    expect(()=>assertStateEqual(state(),seq)).toThrow('data_preservation_failed')
    expect(()=>assertStateEqual(state(),state().slice(1))).toThrow('state_shape_invalid')
    expect(dataStateSql()).toMatch(/string_agg\(row_hash/)
    expect(dataStateSql()).not.toMatch(/\b(insert|update|delete|setval|nextval)\b/i)
  })
  it('restore contract checks functional schema and does not require future V1 modules',()=>{
    const source=restoreShape(afterBootstrap())
    const local=afterBootstrap();local.schemas[0].owner='postgres';local.roles=[];local.relations[0].owner='postgres'
    expect(fingerprint(restoreShape(local))).toBe(fingerprint(source))
    local.relations.reverse();local.routines.reverse();local.types.reverse();local.schemas.reverse()
    expect(fingerprint(restoreShape(local))).toBe(fingerprint(source))
    local.relations[0].shape='b'.repeat(64)
    expect(fingerprint(restoreShape(local))).not.toBe(fingerprint(source))
    expect(JSON.stringify(source)).not.toContain('dpg_v1')
  })
  it('accepts only exact backup login endpoints and keeps strict TLS',()=>{
    const value='postgresql://dpg_backup_login.bonxyxluzlxfkdetryoo:PRIVATE@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    expect(connection(value,true)).toMatchObject({user:'dpg_backup_login.bonxyxluzlxfkdetryoo',ssl:{rejectUnauthorized:true}})
    expect(()=>connection(value.replace('dpg_backup_login.','postgres.'),true)).toThrow('backup_user_invalid')
    expect(()=>connection(value+'?sslmode=disable',true)).toThrow()
  })
})
describe('one-use approval and artifact identities',()=>{
  const sha='a'.repeat(40),nonce='b'.repeat(32)
  const input={sha,operation:'bootstrap'}
  const approval=()=>({id:123,user:{login:'tranhuunguyenhuy-hue'},created_at:'2026-11-05T12:00:00Z',updated_at:'2026-11-05T12:00:00Z',body:`EXISTING-BACKUP-EXECUTE: sha=${sha} baseline=${baselineSha} operation=bootstrap quiescent=yes nonce=${nonce}`})
  it('requires exact unchanged Owner approval after merge',()=>{
    expect(validateApproval(approval(),[],input,'2026-11-05T11:00:00Z')).toBe(nonce)
    for(const mutate of [x=>{x.user.login='other'},x=>{x.updated_at='later'},x=>{x.body+='\n'},x=>{x.body=x.body.replace('quiescent=yes','quiescent=no')},x=>{x.body=x.body.replace('bootstrap','backup_restore')}]) {
      const x=approval();mutate(x);expect(()=>validateApproval(x,[],input,'2026-11-05T11:00:00Z')).toThrow()
    }
    expect(()=>validateApproval(approval(),[],input,'2026-11-05T13:00:00Z')).toThrow()
    expect(()=>validateApproval(approval(),[{body:`EXISTING-BACKUP-CLAIMED: comment=123 nonce=${nonce} `}],input,'2026-11-05T11:00:00Z')).toThrow('approval_claimed')
  })
  it('binds all encrypted files to exact source, target, baseline and run',()=>{
    const envelope={contract:'dongphugia:existing-state-backup:v1',baselineSha,target:'bonxyxluzlxfkdetryoo',sourceSha:sha,runId:'123',files:Object.fromEntries(['snapshot.dump.age','state.json.age','public-api.json.age'].map(n=>[n,'a'.repeat(64)]))}
    expect(()=>validateEnvelope(envelope,sha,'123')).not.toThrow()
    expect(()=>validateEnvelope(envelope,sha,'124')).toThrow()
    envelope.files['raw.json']='a'.repeat(64)
    expect(()=>validateEnvelope(envelope,sha,'123')).toThrow()
  })
  it('workflow defaults read-only and binds protected execution to exact source/one-use gate',()=>{
    const yaml=readFileSync('.github/workflows/existing-state-backup.yml','utf8')
    for(const part of ['default: inspect','environment: runtime-backup','github.run_attempt == 1','execution-gate.mjs','retention-days: 14','*.age','envelope.json'])expect(yaml).toContain(part)
    expect(yaml).not.toContain('schedule:')
    const source=readFileSync('scripts/backup/existing-state/archive.mjs','utf8')
    expect(source).toContain('PGSSLMODE=verify-full')
    expect(source).toContain("'--network','none'")
    expect(source).toContain("assertStateEqual(data, await readState(client, expected), expected)")
  })
})
