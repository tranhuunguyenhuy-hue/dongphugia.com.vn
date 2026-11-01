// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { publicOnlyPreflight, confirmWorkersFree, verifySnapshotHttps } from './public-preview.mjs'
import { WORKER_NAME, PREVIEW_ALIAS } from '../app-foundation/cloudflare-preview-publication.mjs'
const source='a'.repeat(40),checkpoint='b'.repeat(40)
it('uses only a fresh exact-account Dashboard proof on Billing403; never overrides a paid API plan',async()=>{
  const accountId='synthetic-account'
  const proof={contract:'dpg:cloudflare-workers-free-attestation:v1',accountHash:createHash('sha256').update(accountId).digest('hex'),
    plan:'workers_free',state:'active',billableUsd:0,verifiedAt:new Date().toISOString(),
    evidenceUrl:`https://dash.cloudflare.com/${accountId}/billing/subscriptions`}
  const args={accountId,apiToken:'synthetic',attestation:proof,fetchImpl:async()=>new Response('{}',{status:403})}
  expect((await confirmWorkersFree(args)).evidenceMode).toBe('AUTHENTICATED_DASHBOARD')
  await expect(confirmWorkersFree({...args,accountId:'wrong-account'})).rejects.toThrow('PUBLIC_PREVIEW_DASHBOARD_PROOF_INVALID')
  await expect(confirmWorkersFree({...args,attestation:{...proof,verifiedAt:'2020-01-01'}})).rejects.toThrow('PUBLIC_PREVIEW_DASHBOARD_PROOF_INVALID')
  await expect(confirmWorkersFree({...args,attestation:{...proof,verifiedAt:new Date(Date.now()-16*60*1000).toISOString()}}))
    .rejects.toThrow('PUBLIC_PREVIEW_DASHBOARD_PROOF_INVALID')
  await expect(confirmWorkersFree({...args,fetchImpl:async()=>Response.json({result:[{rate_plan:{public_name:'Workers Paid'}}]})})).rejects.toThrow()
})
async function digest(root) {
  const files=[]
  async function walk(dir=''){for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p)}}
  await walk();const hash=createHash('sha256')
  for(const file of files.sort((a,b)=>a.localeCompare(b)))hash.update(file+'\0').update(await readFile(path.join(root,file))).update('\0')
  return hash.digest('hex')
}
async function fixture() {
  const root=await mkdtemp(path.join(tmpdir(),'dpg-public-preview-fixture-'))
  await mkdir(path.join(root,'worker'));await mkdir(path.join(root,'assets/__catalogue/v1'),{recursive:true})
  await writeFile(path.join(root,'worker/index.js'),'// synthetic mechanism fixture only\n')
  const config={name:WORKER_NAME,compatibility_date:'2026-08-30',compatibility_flags:['nodejs_compat'],main:'worker/index.js',workers_dev:false,
    preview_urls:true,assets:{directory:'assets',binding:'ASSETS',not_found_handling:'none'},
    vars:{APP_ENV:'preview',APP_BUILD_TARGET:'public',APP_ORIGIN:'https://public-preview.invalid',PREVIEW_NOINDEX:'true'},no_bundle:true,rules:[]}
  const configBytes=JSON.stringify(config)
  await writeFile(path.join(root,'wrangler.preview.json'),configBytes)
  await writeFile(path.join(root,'assets/__catalogue/v1/manifest.json'),JSON.stringify({contract:'dpg:public-catalogue-snapshot:v1',checkpoint,m3CodeSha:'c'.repeat(40),m3RunId:'123',products:1,listingProducts:1,categories:[]}))
  const renderRoot=path.join(root,'assets/__render/v1',source,checkpoint)
  await mkdir(renderRoot,{recursive:true})
  const snapshotHash=createHash('sha256').update(await readFile(path.join(root,'assets/__catalogue/v1/manifest.json'))).digest('hex')
  await writeFile(path.join(renderRoot,'ready.json'),JSON.stringify({status:'COMPLETE',sourceSha:source,checkpoint,snapshotHash,products:1,routes:8,compressedBytes:100}))
  await writeFile(path.join(renderRoot,'progress.json'),JSON.stringify({sourceSha:source,checkpoint,snapshotHash,total:8,completed:Object.fromEntries(Array.from({length:8},(_,n)=>['/'+n,{}]))}))
  const evidence={contract:'dongphugia:public-worker-artifact:v1',sourceCommit:source,
    worker:{sha256:await digest(path.join(root,'worker')),wranglerGzipKiB:1},staticAssets:{sha256:await digest(path.join(root,'assets'))},
    previewConfig:{workerName:WORKER_NAME,previewAlias:PREVIEW_ALIAS,sha256:createHash('sha256').update(configBytes).digest('hex')},freeLimits:{passed:true}}
  await writeFile(path.join(root,'worker-artifact-evidence.json'),JSON.stringify(evidence))
  return {root,config}
}
describe('Public-only Preview publication mechanism, no live data or API',()=>{
  it('accepts the Public-only identity and rejects a modified immutable Worker',async()=>{
    const {root}=await fixture()
    const options={buildRoot:root,sourceSha:source,workflowRunId:'1',checkpoint,m3RunId:'123',pullRequest:Number(PREVIEW_ALIAS.slice(3))}
    try{
      const proof=await publicOnlyPreflight(options)
      expect(proof.candidateScope).toBe('public-catalogue-only');expect(proof.admin).toBe('deferred')
      await writeFile(path.join(root,'worker/index.js'),'// changed after assembly')
      await expect(publicOnlyPreflight(options)).rejects.toThrow('PUBLIC_PREVIEW_ARTIFACT_HASH')
    }finally{await rm(root,{recursive:true,force:true})}
  })
  it('rejects production routes or mismatched M3 checkpoint before publication',async()=>{
    const {root,config}=await fixture()
    const options={buildRoot:root,sourceSha:source,workflowRunId:'1',checkpoint,m3RunId:'123',pullRequest:Number(PREVIEW_ALIAS.slice(3))}
    try{
      await expect(publicOnlyPreflight({...options,checkpoint:'d'.repeat(40)})).rejects.toThrow('PUBLIC_PREVIEW_REAL_SNAPSHOT_REQUIRED')
      await writeFile(path.join(root,'wrangler.preview.json'),JSON.stringify({...config,routes:['www.dongphugia.vn/*']}))
      await expect(publicOnlyPreflight(options)).rejects.toThrow('CONFIG_KEY_FORBIDDEN:routes')
    }finally{await rm(root,{recursive:true,force:true})}
  })
  it('requires positive Workers Free evidence and never mutates provider state',async()=>{
    const fetchImpl=async(url,init)=>{
      expect(url).toContain('/subscriptions');expect(init.method).toBe('GET');expect(init.redirect).toBe('error')
      return Response.json({success:true,result:[{rate_plan:{public_name:'Workers Free'},component:{name:'workers'}}]})
    }
    await expect(confirmWorkersFree({accountId:'synthetic',apiToken:'test-only',fetchImpl})).resolves.toMatchObject({workersFreeConfirmed:true,mutation:false})
    await expect(confirmWorkersFree({accountId:'synthetic',apiToken:'test-only',fetchImpl:async()=>Response.json({success:true,result:[{rate_plan:{public_name:'Workers Paid'}}]})})).rejects.toThrow('FREE_NOT_CONFIRMED')
    await expect(confirmWorkersFree({accountId:'synthetic',apiToken:'test-only',fetchImpl:async()=>new Response('{}',{status:403})})).rejects.toThrow('HTTP_403')
  })
  it('rejects incomplete rendering even when the public snapshot exists',async()=>{
    const {root}=await fixture()
    try{
      await writeFile(path.join(root,'assets/__render/v1',source,checkpoint,'ready.json'),JSON.stringify({status:'INCOMPLETE'}))
      await expect(publicOnlyPreflight({buildRoot:root,sourceSha:source,workflowRunId:'1',checkpoint,m3RunId:'123',pullRequest:Number(PREVIEW_ALIAS.slice(3))})).rejects.toThrow('RENDER_INCOMPLETE')
    }finally{await rm(root,{recursive:true,force:true})}
  })
  it('never accepts a synthetic fixture health response as real-data M4 readiness',async()=>{
    await expect(verifySnapshotHttps({baseUrl:`https://${PREVIEW_ALIAS}-${WORKER_NAME}.synthetic.workers.dev`,sourceSha:source,checkpoint,m3RunId:'123',buildRoot:'/not-used',
      fetchImpl:async()=>Response.json({application:'public',status:'ok',catalogueMode:'synthetic-fixture'},{headers:{'X-DPG-Source-SHA':source}})})).rejects.toThrow('PUBLIC_PREVIEW_HEALTH_REAL_DATA')
  })
})
