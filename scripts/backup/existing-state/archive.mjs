import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, writeFileSync, rmSync, statfsSync, mkdirSync, lstatSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { baseline, CONTRACT, fingerprint, ident, requireGate, restoreShape, assertStateEqual, assertStateShape, assertSnapshotInventory, tablesFor, sequencesFor } from './contract.mjs'
import { preservePublicApi } from './public-api.mjs'
import { connection, assertTarget, readState, backupInventory, assertBackupLogin, assertCapability, API_SQL } from './database.mjs'

export const IMAGE='postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
const FILES=['snapshot.dump.age','state.json.age','public-api.json.age']
const hashFile=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const childEnv=()=>Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG|DATABASE_URL|AGE_IDENTITY|PRIVATE_KEY|TOKEN|PASSWORD/.test(key) && !/DATABASE_URL/.test(key)))
let workspace
let archiveStage='preflight'
function command(program,args,input,output) {
  const err=openSync(path.join(workspace,'command.error'),'w',0o600)
  const out=output ? openSync(output,'w',0o600) : 'pipe'
  try { return execFileSync(program,args,{input,env:childEnv(),stdio:['pipe',out,err],timeout:120000,encoding:output ? undefined : 'utf8'}) }
  finally {closeSync(err);if(output)closeSync(out)}
}
function validateLocalDocker() {
  requireGate(!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith('unix://'),'remote_docker_disallowed')
  const endpoint=command('docker',['context','inspect',process.env.DOCKER_CONTEXT || command('docker',['context','show']).trim(),'--format','{{(index .Endpoints "docker").Host}}']).trim()
  requireGate(endpoint.startsWith('unix://'),'remote_docker_disallowed')
  command('docker',['image','inspect',IMAGE])
}
function pgpassEscape(value) {
  requireGate(!/[\r\n]/.test(value),'credential_encoding_invalid')
  return value.replaceAll('\\','\\\\').replaceAll(':','\\:')
}
function assertIdentity() {
  requireGate(/^[a-f0-9]{40}$/.test(process.env.APPROVED_SOURCE_SHA ?? ''),'source_invalid')
  requireGate(/^[1-9]\d*$/.test(process.env.GITHUB_RUN_ID ?? ''),'run_invalid')
  requireGate(process.env.BACKUP_RETENTION_DAYS === '14','retention_invalid')
}
export function validateEnvelope(envelope, source, run, expected = baseline) {
  requireGate(envelope?.contract===CONTRACT && envelope.baselineSha===fingerprint(expected) && envelope.target==='bonxyxluzlxfkdetryoo' && envelope.sourceSha===source && envelope.runId===run,'envelope_identity_failed')
  requireGate(envelope.files && JSON.stringify(Object.keys(envelope.files).sort())===JSON.stringify([...FILES].sort()),'envelope_files_failed')
  requireGate(FILES.every(file=>/^[a-f0-9]{64}$/.test(envelope.files[file])),'envelope_checksum_failed')
}
async function backup(output, expected = baseline, suppliedTarget) {
  assertIdentity()
  const recipient=process.env.AGE_RECIPIENT
  requireGate(/^age1[0-9a-z]+$/.test(recipient ?? ''),'recipient_invalid')
  const target=suppliedTarget ?? connection(process.env.SUPABASE_RUNTIME_DATABASE_URL,true)
  const client=new pg.Client(target);client.on('error',()=>{})
  try {
    await client.connect()
    await assertBackupLogin(client,expected)
    await client.query('begin isolation level repeatable read read only')
    await client.query("set local statement_timeout='120s'; set local idle_in_transaction_session_timeout='180s'")
    await client.query('set local role dpg_backup')
    await assertTarget(client)
    const inventory=await backupInventory(client, expected)
    await assertCapability(client, expected)
    const data=await readState(client, expected)
    const api=preservePublicApi((await client.query(API_SQL)).rows[0].api,inventory)
    const snapshot=(await client.query('select pg_export_snapshot() as snapshot')).rows[0].snapshot
    requireGate(/^[A-Fa-f0-9-]+$/.test(snapshot),'snapshot_invalid')
    const credentials=path.join(workspace,'connection');mkdirSync(credentials,{mode:0o700})
    writeFileSync(path.join(credentials,'.pgpass'),[target.host,String(target.port),target.database,target.user,target.password].map(pgpassEscape).join(':')+'\n',{mode:0o600})
    writeFileSync(path.join(credentials,'root.crt'),target.ssl.ca,{mode:0o600})
    command('docker',['run','--rm','--pull=never','--read-only','--network','host','--memory','512m','--pids-limit','128',
      '--volume',`${credentials}:/run/connection:ro`,
      '--env',`PGHOST=${target.host}`,'--env',`PGPORT=${target.port}`,'--env',`PGUSER=${target.user}`,'--env','PGDATABASE=postgres',
      '--env','PGPASSFILE=/run/connection/.pgpass','--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/run/connection/root.crt',
      IMAGE,'pg_dump','--format=custom',`--snapshot=${snapshot}`,'--role=dpg_backup','--enable-row-security',
      '--no-comments','--no-blobs','--no-security-labels','--no-publications','--no-subscriptions','--schema=dpg_app','--schema=dpg_control'],undefined,path.join(workspace,'snapshot.dump'))
    assertStateEqual(data, await readState(client, expected), expected)
    await client.query('commit')
    writeFileSync(path.join(workspace,'state.json'),JSON.stringify({contract:CONTRACT,baselineSha:fingerprint(expected),inventory,data,sourceSha:process.env.APPROVED_SOURCE_SHA,runId:process.env.GITHUB_RUN_ID}),{mode:0o600})
    writeFileSync(path.join(workspace,'public-api.json'),JSON.stringify(api),{mode:0o600})
    mkdirSync(output,{recursive:true,mode:0o700})
    for(const file of FILES) command('age',['--encrypt','--recipient',recipient,'--output',path.join(output,file),path.join(workspace,file.slice(0,-4))])
    const envelope={contract:CONTRACT,target:'bonxyxluzlxfkdetryoo',baselineSha:fingerprint(expected),sourceSha:process.env.APPROVED_SOURCE_SHA,runId:process.env.GITHUB_RUN_ID,createdAt:new Date().toISOString(),files:Object.fromEntries(FILES.map(file=>[file,hashFile(path.join(output,file))]))}
    writeFileSync(path.join(output,'envelope.json'),JSON.stringify(envelope,null,2)+'\n',{mode:0o600})
    process.stdout.write(`EXISTING_BACKUP status=PASS encrypted=PASS tables=${tablesFor(expected).length} sequences=${sequencesFor(expected).length}\n`)
  } catch(error) {await client.query('rollback').catch(()=>{});throw error}
  finally {await client.end().catch(()=>{})}
}
function inertBootstrapSql(expected = baseline) {
  const roles=new Set(['anon','authenticated','service_role','dpg_backup','dpg_backup_login',expected.creator.bootstrapGrantor,...expected.roles.map(r=>r.name)])
  for(const r of expected.relations) for(const p of r.policies) for(const role of p.roles) if(!['PUBLIC','postgres'].includes(role))roles.add(role)
  return [...roles].sort().map(role=>`create role ${ident(role)} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;`).join('\n')+`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    create schema extensions;
    create extension pgcrypto with schema extensions;
  `
}
async function restore(input, expected = baseline) {
  assertIdentity()
  archiveStage='restore_identity'
  const identity=process.env.AGE_IDENTITY
  requireGate(typeof identity==='string' && identity.startsWith('AGE-SECRET-KEY-'),'identity_missing')
  const envelope=JSON.parse(readFileSync(path.join(input,'envelope.json'),'utf8'))
  validateEnvelope(envelope,process.env.APPROVED_SOURCE_SHA,process.env.GITHUB_RUN_ID,expected)
  for(const file of FILES) requireGate(lstatSync(path.join(input,file)).isFile() && !lstatSync(path.join(input,file)).isSymbolicLink() && hashFile(path.join(input,file))===envelope.files[file],'ciphertext_integrity_failed')
  archiveStage='restore_decrypt'
  const key=path.join(workspace,'identity');writeFileSync(key,identity,{mode:0o600})
  for(const file of FILES) command('age',['--decrypt','--identity',key,'--output',path.join(workspace,file.slice(0,-4)),path.join(input,file)])
  rmSync(key)
  const state=JSON.parse(readFileSync(path.join(workspace,'state.json'),'utf8'))
  requireGate(state.contract===CONTRACT && state.baselineSha===fingerprint(expected) && state.sourceSha===envelope.sourceSha && state.runId===envelope.runId,'encrypted_state_identity_failed')
  assertStateShape(state.data, expected)
  assertSnapshotInventory(state.inventory,expected)
  const name=`dpg-existing-restore-${process.pid}-${Date.now()}`
  let started=false
  try {
    archiveStage='restore_container'
    command('docker',['run','--rm','--detach','--pull=never','--name',name,'--network','none','--read-only','--memory','1536m','--pids-limit','256',
      '--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=128m','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,noexec,size=64m',
      '--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE]);started=true
    const isolation=command('docker',['inspect','--format','{{.HostConfig.NetworkMode}}|{{len .Mounts}}|{{.HostConfig.ReadonlyRootfs}}',name]).trim()
    requireGate(isolation==='none|0|true','restore_isolation_failed')
    let ready=false
    for(let i=0;i<45;i++) {
      try{command('docker',['exec',name,'pg_isready','-q','-U','postgres']);ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,1000))}
    }
    requireGate(ready,'restore_startup_failed')
    const psql=['exec','-i',name,'psql','-U','postgres','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1']
    archiveStage='restore_stub_roles'
    command('docker',psql,inertBootstrapSql(expected))
    archiveStage='restore_pg_restore'
    command('docker',['exec','-i',name,'pg_restore','-U','postgres','-d','postgres','--exit-on-error','--no-owner','--no-privileges'],readFileSync(path.join(workspace,'snapshot.dump')))
    archiveStage='restore_public_api'
    const api=preservePublicApi(JSON.parse(readFileSync(path.join(workspace,'public-api.json'),'utf8')),state.inventory,true)
    command('docker',psql,api.map(row=>row.definition).join('\n'))
    const {INVENTORY_SQL,dataStateSql}=await import('./contract.mjs')
    archiveStage='restore_inventory'
    const observedInventory=JSON.parse(command('docker',psql,`begin read only;\n${INVENTORY_SQL}\nrollback;`).trim())
    requireGate(fingerprint(restoreShape(observedInventory))===fingerprint(restoreShape(state.inventory)),'restore_schema_failed')
    archiveStage='restore_data'
    const observedData=JSON.parse(command('docker',psql,`begin read only; set local timezone='UTC'; set local datestyle='ISO, YMD'; ${dataStateSql(expected)}; rollback;`).trim())
    assertStateEqual(state.data,observedData,expected)
    process.stdout.write(`EXISTING_RESTORE status=PASS ciphertext=PASS isolated=PASS schema=PASS data=PASS tables=${tablesFor(expected).length} sequences=${sequencesFor(expected).length}\n`)
  } finally {if(started)try{command('docker',['rm','--force',name])}catch{ /* isolated container only */ }}
}
export async function runArchive(mode, directory, expected = baseline, target) {
  requireGate(['backup','restore'].includes(mode),'mode_invalid')
  requireGate(Number(statfsSync('/dev/shm').type)===0x01021994,'tmpfs_required')
  archiveStage='preflight'
  workspace=mkdtempSync('/dev/shm/dpg-existing-backup-')
  try {
    validateLocalDocker()
    requireGate(typeof directory==='string' && path.isAbsolute(directory),'backup_directory_invalid')
    if(mode==='backup')await backup(directory,expected,target)
    else await restore(directory,expected)
  } catch(error) { if(error && typeof error==='object')error.archiveStage=archiveStage; throw error } finally {rmSync(workspace,{recursive:true,force:true})}
}
export async function main() {
  await runArchive(process.argv[2],process.env.BACKUP_DIR)
}
if(process.argv[1]?.endsWith('/existing-state/archive.mjs')) void main().catch(()=>{
  process.stderr.write('EXISTING_ARCHIVE status=FAIL reason=contract_or_operation_failed\n');process.exitCode=1
})
