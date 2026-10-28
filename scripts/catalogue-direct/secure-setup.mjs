// Administrative bootstrap only. Bulk catalogue transfer never receives these setup URLs.
import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCE, TARGET, SHA, connectionConfig, provisioningSql, requireGate, digest, assertBudget, identifier } from './contract.mjs'
import { attestRole, connect, closeConnections } from './run.mjs'
import { setupState, assertBeforeSetup } from './setup-state.mjs'

const env=process.env
const clients=[]
let directory,phase='setup_preflight',writeAttempted=false,checkpoint,committed=false
const BEFORE='354efb8cfe4740936c50f2f34030cf2081ab2a6d'
const KEY='x0l57JCVOgPjnBI6xNZSk2QC+njh3+ttEZI9tvExkAE='
function command(binary,args,input) {
  const r=spawnSync(binary,args,{input,encoding:null,maxBuffer:8000000,env:{PATH:env.PATH}})
  requireGate(!r.error && r.status===0,'SETUP_PROTECTED_COMMAND_FAILED')
  return r.stdout
}
async function api(path,method='GET',body) {
  requireGate(/^tranhuunguyenhuy-hue\/[A-Za-z0-9_.-]+$/.test(env.DIRECT_VAULT_REPOSITORY??''),'SETUP_VAULT')
  const response=await fetch('https://api.github.com/repos/'+env.DIRECT_VAULT_REPOSITORY+path,{
    method,redirect:'error',signal:AbortSignal.timeout(60000),
    headers:{Authorization:'Bearer '+env.DIRECT_VAULT_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)})
  requireGate(response.ok,'SETUP_VAULT_HTTP_'+response.status)
  return response.json()
}
async function encryptedBlob(commit,path) {
  const body=await api('/contents/'+path+'?ref='+commit)
  return Buffer.from(body.content,'base64')
}
function crypt(mode,input) {
  return command('age',mode==='decrypt'?['--decrypt','--identity',join(directory,'identity')]:[
    '--encrypt','--recipient',env.DIRECT_CHECKPOINT_AGE_RECIPIENT],input)
}
export function setupConfig(value,ca,project) {
  let url
  try { url=new URL(value) } catch { throw new Error('SETUP_URL_REQUIRED') }
  requireGate(url.hostname===`db.${project}.supabase.co` ||
    (/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
      && decodeURIComponent(url.username).endsWith('.'+project)), 'WRONG_PROJECT')
  // Source's free IPv4 Session endpoint was read directly from its Connect panel.
  if(url.hostname===`db.${SOURCE}.supabase.co` && project===SOURCE) {
    url.hostname='aws-1-ap-southeast-1.pooler.supabase.com'
    url.username=decodeURIComponent(url.username)+'.'+SOURCE
  }
  requireGate(!url.search && !url.hash,'SETUP_URI_OPTIONS_FORBIDDEN')
  requireGate(['5432','6543',''].includes(url.port),'SETUP_PORT')
  url.port='5432'
  if(url.protocol==='postgres:') url.protocol='postgresql:'
  const user=decodeURIComponent(url.username)
  // Apply the transfer lane's exact routing and verify-full TLS checks, then restore
  // the administrative setup principal. This function is never used for bulk copy.
  url.username=url.hostname.startsWith('db.')?'dpg_setup_binding':`dpg_setup_binding.${project}`
  return {...connectionConfig(url.toString(),ca,project),user,application_name:'dpg-direct-setup'}
}
async function admin(purpose) {
  const source=purpose==='source'
  const c=new pg.Client(setupConfig(env[source?'DIRECT_SOURCE_SETUP_DATABASE_URL':'DIRECT_TARGET_SETUP_DATABASE_URL'],
    env[source?'DIRECT_SOURCE_CA':'DIRECT_TARGET_CA'],source?SOURCE:TARGET))
  c.on('error',()=>{})
  clients.push(c)
  await c.connect()
  const {rows:[r]}=await c.query(`select current_user as name,rolcreaterole,rolbypassrls,
    current_setting('default_transaction_read_only') as read_only from pg_roles where rolname=current_user`)
  requireGate(r?.rolcreaterole && r.rolbypassrls && r.read_only==='off','SETUP_ADMIN_CAPABILITY_REQUIRED')
  return {client:c,config:c.connectionParameters,principal:r.name}
}
async function persistSetup(purpose,bundle) {
  const ref='heads/direct-setup-issue160-'+purpose
  requireGate((await api('/git/matching-refs/'+ref)).length===0,'SETUP_ATTEMPT_ALREADY_EXISTS')
  const encrypted=crypt('encrypt',Buffer.from(JSON.stringify(bundle)))
  requireGate(encrypted.length<4000000,'SETUP_CHECKPOINT_CAPACITY')
  const blob=await api('/git/blobs','POST',{encoding:'base64',content:encrypted.toString('base64')})
  const receipt={contract:'dpg:direct-setup:v1',purpose,codeSha:env.GITHUB_SHA,hash:digest(encrypted),bytes:encrypted.length,
    beforeTarget:BEFORE,source:SOURCE,target:TARGET}
  const rb=await api('/git/blobs','POST',{encoding:'utf-8',content:JSON.stringify(receipt)})
  const tree=await api('/git/trees','POST',{tree:[{path:'setup.age',mode:'100644',type:'blob',sha:blob.sha},
    {path:'receipt.json',mode:'100644',type:'blob',sha:rb.sha}]})
  const commit=await api('/git/commits','POST',{message:'Immutable direct setup '+purpose,tree:tree.sha,parents:[]})
  await api('/git/refs','POST',{ref:'refs/'+ref,sha:commit.sha})
  const readback=await encryptedBlob(commit.sha,'setup.age')
  requireGate(digest(readback)===receipt.hash && crypt('decrypt',readback).equals(Buffer.from(JSON.stringify(bundle))), 'SETUP_CHECKPOINT_READBACK')
  return commit.sha
}
function loginUrl(config,role,password,project) {
  const url=new URL('postgresql://localhost:5432/postgres')
  url.hostname=config.host; url.username=config.host.startsWith('db.')?role:role+'.'+project; url.password=password
  return url.toString()
}
async function main() {
  requireGate(env.GITHUB_ACTIONS==='true' && env.GITHUB_REF==='refs/heads/main'
    && env.GITHUB_REPOSITORY==='tranhuunguyenhuy-hue/dongphugia.com.vn'
    && env.GITHUB_ACTOR==='tranhuunguyenhuy-hue' && env.GITHUB_RUN_ATTEMPT==='1'
    && SHA.test(env.GITHUB_SHA??'') && env.APPROVED_SHA===env.GITHUB_SHA,'SETUP_AUTHORITY')
  requireGate(['source','target'].includes(env.SETUP_PURPOSE),'SETUP_PURPOSE')
  requireGate(env.ENV_PUBLIC_KEY===KEY && env.ENV_KEY_ID==='3380204578043523366','SETUP_ENVIRONMENT_KEY')
  assertBudget(JSON.parse(env.DIRECT_ZERO_COST_ATTESTATION??'null'))
  requireGate((await readFile('/proc/swaps','utf8')).trim().split('\n').length===1,'SETUP_SWAP_FORBIDDEN')
  requireGate((await statfs('/dev/shm')).type===0x01021994,'SETUP_TMPFS_REQUIRED')
  directory=await mkdtemp('/dev/shm/direct-setup-')
  await writeFile(join(directory,'identity'),env.DIRECT_CHECKPOINT_AGE_IDENTITY,{mode:0o600})
  requireGate(command('age-keygen',['-y',join(directory,'identity')]).toString().trim()===env.DIRECT_CHECKPOINT_AGE_RECIPIENT,'SETUP_RECIPIENT')
  const purpose=env.SETUP_PURPOSE
  phase='setup_'+purpose+'_connect'
  const selected=await admin(purpose)
  let expected
  if(purpose==='target') {
    // M1 source setup has no destination prerequisite. Reuse the verified
    // target preimage only when destination setup is actually selected.
    const encrypted=await encryptedBlob(BEFORE,'affected-state.age')
    requireGate(digest(encrypted)==='df0de24f7d41ff965c4fbd872058fdac73fed7f4d77d82f595116df58c8868f2','SETUP_BEFORE_CIPHERTEXT')
    const plain=crypt('decrypt',encrypted)
    requireGate(digest(plain)==='7d48235d944077cc0173fc64b8acf1f7208184476ba1ec51791d7151130183d3','SETUP_BEFORE_PLAINTEXT')
    expected=JSON.parse(plain)
    requireGate(expected.target===TARGET && expected.contract==='dpg:affected-state-before-setup:v1','SETUP_BEFORE_IDENTITY')
    phase='setup_live_before_comparison'
    await selected.client.query('begin isolation level repeatable read read only')
    assertBeforeSetup(expected,await setupState(selected.client,'dpg_app'))
    await selected.client.query('commit')
  }
  console.log(JSON.stringify({setup_authentication:'PASS',purpose,tls_verify_full:true,database_writes:false}))
  const roles=purpose==='source'?['source']:['read','import']
  const secretNames={source:'DIRECT_SOURCE_DATABASE_URL',read:'DIRECT_TARGET_READ_DATABASE_URL',import:'DIRECT_TARGET_IMPORT_DATABASE_URL'}
  const urls={},passwords={}
  phase='setup_checkpoint'
  const before=await setupState(selected.client,purpose==='source'?'public':'dpg_app')
  requireGate(before.new_roles.length===0,'SETUP_ROLE_ALREADY_EXISTS')
  const resume=env.SETUP_RESUME_CHECKPOINT
  if(resume) {
    // Bounded continuation of the proven rolled-back pre-data setup failure,
    // not a fresh credential/export attempt or a general import replay switch.
    requireGate(purpose==='target' && resume==='638d3e765fd28df009ef766e092828a96fe765f3','SETUP_RESUME_SCOPE')
    const refs=await api('/git/matching-refs/heads/direct-setup-issue160-target')
    requireGate(refs.some(r=>r.ref==='refs/heads/direct-setup-issue160-target' && r.object.sha===resume),'SETUP_RESUME_REF')
    const original=JSON.parse(crypt('decrypt',await encryptedBlob(resume,'setup.age')))
    requireGate(original.contract==='dpg:direct-setup:v1' && original.purpose==='target'
      && original.codeSha==='23ea494e30f8dc5b1f72e0204c70767ee1cbb818','SETUP_RESUME_IDENTITY')
    assertBeforeSetup(original.before,before)
    requireGate(Object.keys(original.urls).sort().join(',')===roles.map(r=>secretNames[r]).sort().join(','),'SETUP_RESUME_SECRET_SET')
    for(const role of roles) {
      const value=original.urls[secretNames[role]]
      const config=connectionConfig(value,env.DIRECT_TARGET_CA,TARGET)
      requireGate([`dpg_direct_${role}`,`dpg_direct_${role}.${TARGET}`].includes(config.user)
        && /^[A-Za-z0-9_-]{43}$/.test(config.password),'SETUP_RESUME_ROLE')
      urls[secretNames[role]]=value;passwords[role]=config.password
    }
    checkpoint=resume
    const marker='heads/direct-setup-resume-'+resume
    requireGate((await api('/git/matching-refs/'+marker)).length===0,'SETUP_RESUME_ALREADY_ATTEMPTED')
    // Preserve the original ref; the new immutable marker points at its same
    // encrypted credentials/preimage and permits only this one continuation.
    await api('/git/refs','POST',{ref:'refs/'+marker,sha:resume})
  } else {
    for(const role of roles) {
      passwords[role]=randomBytes(32).toString('base64url')
      urls[secretNames[role]]=loginUrl(selected.config,'dpg_direct_'+role,passwords[role],purpose==='source'?SOURCE:TARGET)
    }
    checkpoint=await persistSetup(purpose,{contract:'dpg:direct-setup:v1',purpose,codeSha:env.GITHUB_SHA,before,urls})
  }
  console.log(JSON.stringify({setup_checkpoint:checkpoint,purpose,status:'PERSISTED_READBACK_VERIFIED',database_writes:false}))
  phase='setup_transaction'
  await selected.client.query('begin')
  try {
    // PG17 non-superuser CREATEROLE defaults to ADMIN without SET on new roles.
    // Enable SET only for this transaction's new roles to attest their rights;
    // restore SET=false before commit. No existing role membership is widened.
    await selected.client.query("set local createrole_self_grant = 'set'")
    if(purpose==='target') {
      for(const name of expected.tables.map(t=>t.name)) await selected.client.query(`lock table dpg_app."${name}" in access exclusive mode`)
      assertBeforeSetup(expected,await setupState(selected.client,'dpg_app'))
      const sql=await readFile(new URL('./target-parity.sql',import.meta.url),'utf8')
      writeAttempted=true
      await selected.client.query(sql.replace(/\bbegin;/i,'').replace(/commit;\s*$/i,''))
    }
    for(const role of roles) {
      writeAttempted=true
      await selected.client.query(provisioningSql(role).replace(/^begin;\s*/,'').replace(/commit;\s*--[\s\S]*$/,''))
    }
    await selected.client.query(`create function pg_temp.direct_setup_login(role_name text, secret text) returns void
      language plpgsql security invoker set search_path=pg_catalog as $setter$
      begin
        if role_name <> all(array['dpg_direct_source','dpg_direct_read','dpg_direct_import']) then raise exception 'DIRECT_ROLE_SCOPE'; end if;
        execute format('alter role %I login password %L',role_name,secret);
      end $setter$`)
    for(const role of roles) {
      await selected.client.query('select pg_temp.direct_setup_login($1,$2)',['dpg_direct_'+role,passwords[role]])
      await selected.client.query('set local role dpg_direct_'+role)
      await attestRole(selected.client,role)
      await selected.client.query('reset role')
      await selected.client.query('grant dpg_direct_'+role+' to '+identifier(selected.principal)+' with set false')
    }
    phase='setup_commit'
    await selected.client.query('commit')
    committed=true
  } catch(error) {
    try { await selected.client.query('rollback') } catch { /* independent state check required */ }
    throw error
  }
  // Verify a fresh purpose-specific TLS login after commit without any catalogue read.
  phase='setup_independent_login'
  for(const role of roles) {
    env[secretNames[role]]=urls[secretNames[role]]
    const reader=await connect(role)
    await reader.end()
  }
  const payload=JSON.parse(command(env.SETUP_PYTHON,[fileURLToPath(new URL('./seal-setup.py',import.meta.url))],Buffer.from(JSON.stringify(urls))))
  payload.source_sha=env.GITHUB_SHA; payload.setup_checkpoint=checkpoint; payload.purpose=purpose
  await writeFile(env.SEALED_OUTPUT,JSON.stringify(payload),{mode:0o600})
  console.log(JSON.stringify({status:'PASS',purpose,setup_checkpoint:checkpoint,committed:true,
    independent_login_and_role_boundary:'PASS',sealed_secret_names:Object.keys(urls),plaintext_artifact:false}))
}

if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(error=>{
  const reason=/^[A-Z_0-9]+$/.test(error?.message??'')?error.message:
    ['28P01','42501','ENETUNREACH','ECONNREFUSED','ETIMEDOUT'].includes(error?.code)?error.code:'PROTECTED_SETUP_FAILED'
  console.log(JSON.stringify({status:'STOP',phase,reason,writeAttempted,committed,checkpoint,
    state:'PRESERVE_CHECKPOINT_NO_REPLAY'}));process.exitCode=1
}).finally(async()=>{
  await Promise.allSettled(clients.map(c=>c.end()))
  await closeConnections()
  if(directory) await rm(directory,{recursive:true,force:true})
  for(const key of Object.keys(env)) if(key.startsWith('DIRECT_')) delete env[key]
})
