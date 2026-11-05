// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { it, expect } from 'vitest'
import { ADOPTED_CHECKPOINT_MIGRATIONS } from '../supabase-runtime-migrations.mjs'
import { bootstrap, readInventory, readState, assertCapability, assertBackupLogin, backupInventory } from './database.mjs'
import { assertInventory, assertStateEqual, fingerprint, INVENTORY_SQL, POLICY } from './contract.mjs'
import { IMAGE, runArchive } from './archive.mjs'

const enabled=Boolean(process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE)
const archiveEnabled=process.env.EXISTING_BACKUP_ARCHIVE_INTEGRATION==='1'
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim()
it.runIf(enabled)('preserves populated catalogue, rejects drift/incomplete RLS coverage, rolls back failures and restores an encrypted snapshot',async()=>{
  const name=`dpg-existing-fixture-${process.pid}-${Date.now()}`
  let client,root,phase='container',temporary
  const previousEnv=Object.fromEntries(['APPROVED_SOURCE_SHA','GITHUB_RUN_ID','BACKUP_RETENTION_DAYS','AGE_RECIPIENT','AGE_IDENTITY'].map(k=>[k,process.env[k]]))
  try {
    expect(process.env.POSTGRES_SNAPSHOT_INTEGRATION_IMAGE).toBe(IMAGE)
    docker('run','--rm','--detach','--pull=never','--name',name,'--publish','127.0.0.1::5432','--read-only','--memory','1536m','--pids-limit','256',
      '--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1g','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=128m','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,noexec,size=64m','--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_USER=supabase_admin','--env','POSTGRES_DB=postgres',IMAGE)
    phase='startup'
    let ready=false
    for(let i=0;i<45;i++) {try{docker('exec',name,'pg_isready','-q','-h','127.0.0.1','-U','supabase_admin');ready=true;break}catch{await new Promise(r=>setTimeout(r,500))}}
    expect(ready).toBe(true)
    const port=Number(docker('port',name,'5432/tcp').split(':').at(-1))
    root=new pg.Client({host:'127.0.0.1',port,user:'supabase_admin',database:'postgres',connectionTimeoutMillis:5000})
    await root.connect()
    client=root
    await root.query('create role postgres login nosuperuser createrole createdb inherit noreplication bypassrls')
    phase='synthetic_schema'
    await client.query(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
      create schema auth;create schema storage;create schema extensions;create extension pgcrypto with schema extensions;
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table auth.users(id uuid primary key);create table storage.objects(id uuid primary key);
      set search_path to "$user",public,extensions;`)
    for(const file of ADOPTED_CHECKPOINT_MIGRATIONS)await client.query(readFileSync(`supabase/migrations/${file}`,'utf8'))
    await client.query('reset role')
    await client.query(`with category as (insert into dpg_app.categories(name,slug) values('Synthetic category','synthetic-category') returning id)
      insert into dpg_app.products(sku,name,slug,category_id,price,description) select 'SYNTHETIC-BACKUP-1','Synthetic populated product','synthetic-backup-1',id,123456,'Synthetic HTML content preserved' from category`)
    client=new pg.Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',connectionTimeoutMillis:5000})
    await client.connect()
    const capture=async()=>{await client.query('begin read only');try{return await readInventory(client)}finally{await client.query('rollback')}}
    const expected=await capture()
    expect(expected.relations.find(r=>r.name==='dpg_app.products_id_seq').acl.filter(a=>a.grantee==='dpg_migration').map(a=>a.privilege)).toEqual(['SELECT','UPDATE','USAGE'])
    const original=await readState(client,expected)
    const rejectsWith=async(promise,wanted)=>{
      let failure
      try{await promise}catch(error){failure=error}
      const reasons=new Set(['data_preservation_failed','inventory_drift','capability_role_invalid','capability_settings_invalid','capability_memberships_invalid','capability_schema_grants_invalid','capability_relation_grants_invalid','capability_policy_count_invalid','capability_policy_invalid','capability_effective_privileges_failed','direct_rights_or_ownership_failed','backup_login_already_exists','target_or_budget_failed'])
      const codes=new Set(['42601','42501','42704','42P01','42883','42703','42809'])
      if(failure?.message!==wanted)process.stdout.write(`EXISTING_TEST_FAILURE reason=${reasons.has(failure?.message)?failure.message:'UNCLASSIFIED'} code=${codes.has(failure?.code)?failure.code:'UNCLASSIFIED'}\n`)
      expect(failure?.message).toBe(wanted)
    }
    phase='reject_role_drift'
    await root.query('alter role dpg_runtime_login connection limit 9')
    await expect(bootstrap(client,fingerprint(expected),expected)).rejects.toThrow('inventory_drift')
    expect((await client.query("select to_regrole('dpg_backup') is null as absent")).rows[0].absent).toBe(true)
    await root.query('alter role dpg_runtime_login connection limit 10')
    const preflightInventory=await capture()
    for(const key of Object.keys(expected))if(fingerprint(expected[key])!==fingerprint(preflightInventory[key])) {
      process.stdout.write(`SYNTHETIC_PREFLIGHT_DIFF section=${key}\n`)
      if(Array.isArray(expected[key]))for(let i=0;i<expected[key].length;i++)if(fingerprint(expected[key][i])!==fingerprint(preflightInventory[key][i])) {
        const fields=Object.keys(expected[key][i]).filter(k=>fingerprint(expected[key][i][k])!==fingerprint(preflightInventory[key][i]?.[k]))
        process.stdout.write(`SYNTHETIC_PREFLIGHT_DIFF section=${key} index=${i} fields=${fields.join(',')}\n`)
      }
    }
    phase='rollback_unexpected_data_change'
    let observedInventory
    const faulty=new Proxy(client,{get(target,key){if(key==='query')return async(sql,...args)=>{
      const result=await target.query(sql,...args)
      if(sql===INVENTORY_SQL) { const candidate=Array.isArray(result)?result.at(-1):result; if(candidate.rows[0].inventory.roles.some(r=>r.name==='dpg_backup'))observedInventory=candidate.rows[0].inventory }
      if(typeof sql==='string' && sql.startsWith('create role dpg_backup'))await target.query('update dpg_app.products set price=1')
      return result
    };const value=target[key];return typeof value==='function'?value.bind(target):value}})
    try { await rejectsWith(bootstrap(faulty,fingerprint(expected),expected),'data_preservation_failed') }
    catch(error) {
      if(observedInventory) {
        const actual=structuredClone(observedInventory)
        actual.roles=actual.roles.filter(r=>r.name!=='dpg_backup')
        actual.memberships=actual.memberships.filter(m=>!m.slice(0,2).includes('dpg_backup'))
        for(const s of actual.schemas)s.acl=s.acl.filter(a=>a.grantee!=='dpg_backup')
        for(const r of actual.relations){r.acl=r.acl.filter(a=>a.grantee!=='dpg_backup');r.policies=r.policies.filter(p=>p.name!==POLICY)}
        for(const key of Object.keys(expected))if(fingerprint(expected[key])!==fingerprint(actual[key])) {
          process.stdout.write(`SYNTHETIC_METADATA_DIFF section=${key}\n`)
          if(Array.isArray(expected[key]))for(let i=0;i<expected[key].length;i++)if(fingerprint(expected[key][i])!==fingerprint(actual[key][i])) {
            const fields=Object.keys(expected[key][i]).filter(k=>fingerprint(expected[key][i][k])!==fingerprint(actual[key][i]?.[k]))
            process.stdout.write(`SYNTHETIC_METADATA_DIFF section=${key} index=${i} fields=${fields.join(',')}\n`)
          }
        }
      }
      throw error
    }
    assertStateEqual(original,await readState(client,expected),expected)
    expect((await client.query("select to_regrole('dpg_backup') is null as absent")).rows[0].absent).toBe(true)
    phase='reject_restrictive_rls_data_loss'
    await client.query('create policy synthetic_restrictive_backup on dpg_app.products as restrictive for select to public using(false)')
    const restrictive=await capture()
    await rejectsWith(bootstrap(client,fingerprint(restrictive),restrictive),'data_preservation_failed')
    expect((await client.query("select to_regrole('dpg_backup') is null as absent")).rows[0].absent).toBe(true)
    await client.query('drop policy synthetic_restrictive_backup on dpg_app.products')
    phase='reject_inherited_column_write'
    await root.query('grant update(price) on dpg_app.products to public')
    const columnGrant=await capture()
    await rejectsWith(bootstrap(client,fingerprint(columnGrant),columnGrant),'capability_effective_privileges_failed')
    expect((await client.query("select to_regrole('dpg_backup') is null as absent")).rows[0].absent).toBe(true)
    await root.query('revoke update(price) on dpg_app.products from public')
    phase='commit_exact_capability'
    await bootstrap(client,fingerprint(expected),expected)
    await client.query('begin read only')
    assertInventory(await readInventory(client),true,expected)
    await assertCapability(client,expected)
    await client.query('rollback')
    assertStateEqual(original,await readState(client,expected),expected)
    expect((await client.query("select to_regclass('dpg_control.runtime_migration_ledger') is null as absent")).rows[0].absent).toBe(true)
    phase='dedicated_login_contract'
    await client.query('create role dpg_backup_login login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls connection limit 2')
    await client.query('grant dpg_backup to dpg_backup_login with inherit false')
    await client.query('alter role dpg_backup_login set default_transaction_read_only=on')
    const checkLogin=async()=>{
      const login=new pg.Client({host:'127.0.0.1',port,user:'dpg_backup_login',database:'postgres',connectionTimeoutMillis:5000})
      try{await login.connect();await assertBackupLogin(login,expected)}finally{await login.end().catch(()=>{})}
    }
    await checkLogin()
    await client.query('grant dpg_backup to dpg_backup_login with inherit true granted by postgres')
    await expect(checkLogin()).rejects.toThrow('backup_login_contract_failed')
    await client.query('begin read only')
    await expect(backupInventory(client,expected)).rejects.toThrow('backup_login_membership_failed')
    await client.query('rollback')
    await client.query('grant dpg_backup to dpg_backup_login with inherit false granted by postgres')
    await client.query('grant update(price) on dpg_app.products to dpg_backup_login')
    await expect(checkLogin()).rejects.toThrow('direct_rights_or_ownership_failed')
    await client.query('revoke update(price) on dpg_app.products from dpg_backup_login')
    await checkLogin()
    if(archiveEnabled) {
      phase='synthetic_tls_and_login'
      temporary=mkdtempSync('/dev/shm/dpg-existing-test-')
      phase='synthetic_generate_tls'
      execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-keyout',path.join(temporary,'server.key'),'-out',path.join(temporary,'server.crt')],{stdio:'ignore'})
      phase='synthetic_copy_tls'
      for(const file of ['server.key','server.crt'])execFileSync('docker',['exec','-i',name,'sh','-c',`cat > /tmp/${file}`],{input:readFileSync(path.join(temporary,file)),stdio:['pipe','ignore','pipe'],timeout:10000})
      docker('exec',name,'chown','postgres:postgres','/tmp/server.key','/tmp/server.crt')
      docker('exec',name,'chmod','600','/tmp/server.key')
      phase='synthetic_configure_tls'
      await root.query("alter system set ssl_cert_file='/tmp/server.crt'")
      await root.query("alter system set ssl_key_file='/tmp/server.key'")
      await root.query('alter system set ssl=on')
      await root.query('select pg_reload_conf()')
      await new Promise(r=>setTimeout(r,500))
      phase='synthetic_generate_age_identity'
      const identityFile=path.join(temporary,'test-identity')
      execFileSync('age-keygen',['-o',identityFile],{stdio:'ignore'})
      process.env.AGE_RECIPIENT=execFileSync('age-keygen',['-y',identityFile],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()
      process.env.AGE_IDENTITY=readFileSync(identityFile,'utf8').split('\n').find(l=>l.startsWith('AGE-SECRET-KEY-'))
      process.env.APPROVED_SOURCE_SHA='a'.repeat(40);process.env.GITHUB_RUN_ID='123';process.env.BACKUP_RETENTION_DAYS='14'
      const directory=path.join(temporary,'encrypted')
      phase='encrypted_export'
      await runArchive('backup',directory,expected,{host:'127.0.0.1',port,user:'dpg_backup_login',database:'postgres',password:'unused-synthetic',ssl:{ca:readFileSync(path.join(temporary,'server.crt'),'utf8'),rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:120000})
      phase='isolated_restore'
      await runArchive('restore',directory,expected)
      phase='reject_ciphertext_corruption'
      const encryptedFile=path.join(directory,'state.json.age')
      const bytes=readFileSync(encryptedFile);bytes[bytes.length-1]^=1;writeFileSync(encryptedFile,bytes)
      await expect(runArchive('restore',directory,expected)).rejects.toThrow('ciphertext_integrity_failed')
    }
    process.stdout.write(`EXISTING_BACKUP_SYNTHETIC status=PASS populated=PASS drift=PASS rollback=PASS rls_completeness=PASS encrypted_restore=${archiveEnabled?'PASS':'NOT_RUN'}\n`)
  } catch(error) {
    const allowed=new Set(['42601','42501','42704','42P01','42883','42703','42809','28P01','ECONNREFUSED'])
    throw new Error(`EXISTING_BACKUP_SYNTHETIC_FAILED phase=${phase} stage=${/^restore_[a-z_]+$/.test(error?.archiveStage ?? '')?error.archiveStage:'unknown'} code=${allowed.has(error?.code)?error.code:'UNCLASSIFIED'}`)
  }
  finally {
    if(client)await client.end().catch(()=>{})
    if(root && root!==client)await root.end().catch(()=>{})
    try{docker('rm','--force',name)}catch{/* own synthetic container only */}
    if(temporary)rmSync(temporary,{recursive:true,force:true})
    for(const [key,value] of Object.entries(previousEnv))if(value===undefined)delete process.env[key];else process.env[key]=value
  }
},240000)
