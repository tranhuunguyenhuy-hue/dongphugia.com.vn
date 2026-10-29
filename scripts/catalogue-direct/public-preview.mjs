// Public-only immutable Preview units. No Admin build and no provider mutation.
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { validatePreviewConfig, WORKER_NAME, PREVIEW_ALIAS } from '../app-foundation/cloudflare-preview-publication.mjs'

const SHA=/^[a-f0-9]{40}$/
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
function gate(value,reason) { if(!value)throw new Error(reason) }
async function directoryDigest(root,relative='') {
  const paths=[]
  async function visit(child) {
    for(const entry of await readdir(path.join(root,child),{withFileTypes:true})) {
      gate(!entry.isSymbolicLink(),'PUBLIC_PREVIEW_SYMLINK_FORBIDDEN')
      const next=path.join(child,entry.name)
      if(entry.isDirectory())await visit(next)
      else if(entry.isFile())paths.push(next)
      else throw new Error('PUBLIC_PREVIEW_NONFILE_FORBIDDEN')
    }
  }
  await visit(relative)
  paths.sort((a,b)=>a.localeCompare(b))
  const hash=createHash('sha256');let totalBytes=0,largestFile=0
  for(const file of paths) {
    const bytes=await readFile(path.join(root,file));totalBytes+=bytes.length;largestFile=Math.max(largestFile,bytes.length)
    hash.update(file.split(path.sep).join('/')+'\0');hash.update(bytes);hash.update('\0')
  }
  return {sha256:hash.digest('hex'),fileCount:paths.length,totalBytes,largestFile}
}
export async function publicOnlyPreflight({buildRoot,sourceSha,workflowRunId,checkpoint,m3RunId,pullRequest}) {
  gate(SHA.test(sourceSha)&&SHA.test(checkpoint)&&/^\d+$/.test(workflowRunId)&&/^\d+$/.test(m3RunId),'PUBLIC_PREVIEW_IDENTITY_REQUIRED')
  gate(Number.isSafeInteger(pullRequest)&&pullRequest>0&&PREVIEW_ALIAS===`pr-${pullRequest}`,'PUBLIC_PREVIEW_ALIAS_MISMATCH')
  const configPath=path.join(buildRoot,'wrangler.preview.json')
  const configBytes=await readFile(configPath)
  const configProof=validatePreviewConfig(JSON.parse(configBytes))
  const evidence=JSON.parse(await readFile(path.join(buildRoot,'worker-artifact-evidence.json'),'utf8'))
  const manifest=JSON.parse(await readFile(path.join(buildRoot,'assets/__catalogue/v1/manifest.json'),'utf8'))
  gate(evidence.contract==='dongphugia:public-worker-artifact:v1'&&evidence.sourceCommit===sourceSha,'PUBLIC_PREVIEW_ARTIFACT_SOURCE')
  gate(evidence.previewConfig?.previewAlias===PREVIEW_ALIAS&&evidence.previewConfig?.workerName===WORKER_NAME,'PUBLIC_PREVIEW_ARTIFACT_RESOURCE')
  gate(manifest.contract==='dpg:public-catalogue-snapshot:v1'&&manifest.checkpoint===checkpoint
    &&manifest.m3RunId===m3RunId&&SHA.test(manifest.m3CodeSha)&&manifest.products>0&&manifest.listingProducts>0,'PUBLIC_PREVIEW_REAL_SNAPSHOT_REQUIRED')
  const renderRoot=path.join(buildRoot,'assets/__render/v1',sourceSha,checkpoint)
  const rendered=JSON.parse(await readFile(path.join(renderRoot,'ready.json'),'utf8'))
  const progress=JSON.parse(await readFile(path.join(renderRoot,'progress.json'),'utf8'))
  const snapshotHash=sha256(await readFile(path.join(buildRoot,'assets/__catalogue/v1/manifest.json')))
  gate(rendered.status==='COMPLETE'&&rendered.sourceSha===sourceSha&&rendered.checkpoint===checkpoint
    &&rendered.snapshotHash===snapshotHash&&rendered.products===manifest.products
    &&Number.isSafeInteger(rendered.routes)&&rendered.routes>=manifest.products+7&&rendered.routes<9000
    &&Number.isSafeInteger(rendered.compressedBytes)&&rendered.compressedBytes>0&&rendered.compressedBytes<=200000000
    &&progress.sourceSha===sourceSha&&progress.checkpoint===checkpoint&&progress.snapshotHash===snapshotHash
    &&progress.total===rendered.routes&&Object.keys(progress.completed).length===rendered.routes,'PUBLIC_PREVIEW_RENDER_INCOMPLETE')
  const worker=await directoryDigest(path.join(buildRoot,'worker'))
  const assets=await directoryDigest(path.join(buildRoot,'assets'))
  const previewConfigSha256=sha256(configBytes)
  gate(worker.sha256===evidence.worker?.sha256&&assets.sha256===evidence.staticAssets?.sha256
    &&previewConfigSha256===evidence.previewConfig?.sha256,'PUBLIC_PREVIEW_ARTIFACT_HASH')
  gate(evidence.freeLimits?.passed===true&&Number.isFinite(evidence.worker?.wranglerGzipKiB)
    &&evidence.worker.wranglerGzipKiB<=3072&&assets.fileCount<=20000&&assets.largestFile<=25*1024*1024,'PUBLIC_PREVIEW_FREE_CAPACITY')
  const entire=await directoryDigest(buildRoot)
  return {contract:'dongphugia:cloudflare-preview-publication-preflight:v1',candidateScope:'public-catalogue-only',sourceCommit:sourceSha,
    pullRequest,workflowRunId,publicArtifactSha256:entire.sha256,workerArtifactSha256:worker.sha256,staticAssetsSha256:assets.sha256,
    previewConfigSha256,...configProof,checkpoint,m3RunId,m3CodeSha:manifest.m3CodeSha,
    freeLimits:{workerGzipKiB:evidence.worker.wranglerGzipKiB,workerGzipLimitKiB:3072,staticAssetFiles:assets.fileCount,
      staticAssetLimit:20000,largestStaticAssetBytes:assets.largestFile,individualStaticAssetLimitBytes:25*1024*1024,passed:true},
    prerenderedRoutes:rendered.routes,prerenderedBytes:rendered.compressedBytes,
    productionSupabase:'not-bound',productionDnsOrTraffic:'unchanged-before-upload',admin:'deferred'}
}
export async function confirmWorkersFree({accountId,apiToken,fetchImpl=fetch,attestation}) {
  gate(accountId&&apiToken,'PUBLIC_PREVIEW_PROVIDER_CREDENTIALS_REQUIRED')
  const response=await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`,{
    method:'GET',redirect:'error',headers:{Authorization:'Bearer '+apiToken,Accept:'application/json'}})
  if(response.status===403 && attestation) {
    const proof=typeof attestation==='string'?JSON.parse(attestation):attestation
    const age=Date.now()-Date.parse(proof.verifiedAt)
    gate(proof.contract==='dpg:cloudflare-workers-free-attestation:v1'
      && proof.accountHash===sha256(accountId) && proof.plan==='workers_free' && proof.state==='active'
      && proof.billableUsd===0 && age>=0 && age<=86400000
      && proof.evidenceUrl===`https://dash.cloudflare.com/${accountId}/billing/subscriptions`,'PUBLIC_PREVIEW_DASHBOARD_PROOF_INVALID')
    return {contract:'dpg:public-preview-zero-cost:v1',workersFreeConfirmed:true,checkedAt:proof.verifiedAt,
      evidenceMode:'AUTHENTICATED_DASHBOARD',apiStatus:403,mutation:false}
  }
  gate(response.ok,'PUBLIC_PREVIEW_PLAN_HTTP_'+response.status)
  const body=await response.json()
  gate(body.success!==false&&Array.isArray(body.result),'PUBLIC_PREVIEW_PLAN_UNKNOWN')
  const plans=body.result.map(s=>[s.rate_plan?.public_name,s.rate_plan?.name,s.component?.name].filter(x=>typeof x==='string').join(' ')).filter(x=>/workers/i.test(x))
  gate(plans.some(x=>/workers[\s_-]+free|free.*workers/i.test(x)),'PUBLIC_PREVIEW_WORKERS_FREE_NOT_CONFIRMED')
  gate(plans.every(x=>/free/i.test(x)),'PUBLIC_PREVIEW_PAID_WORKERS_PLAN_FORBIDDEN')
  return {contract:'dpg:public-preview-zero-cost:v1',workersFreeConfirmed:true,checkedAt:new Date().toISOString(),mutation:false}
}
export async function verifySnapshotHttps({baseUrl,sourceSha,checkpoint,m3RunId,buildRoot,fetchImpl=fetch}) {
  const url=new URL(baseUrl)
  gate(url.protocol==='https:'&&url.hostname.startsWith(`${PREVIEW_ALIAS}-${WORKER_NAME}.`)&&url.hostname.endsWith('.workers.dev')
    &&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'PUBLIC_PREVIEW_URL')
  const request=async pathname=>fetchImpl(new URL(pathname,url),{redirect:'error'})
  const health=await request('/api/health');const state=await health.json()
  gate(health.status===200&&health.headers.get('X-DPG-Source-SHA')===sourceSha
    &&state.catalogueMode==='verified-snapshot'&&state.catalogueCheckpoint===checkpoint&&state.m3RunId===m3RunId
    &&state.publicProducts>0&&state.listingProducts>0,'PUBLIC_PREVIEW_HEALTH_REAL_DATA')
  const manifestPath='/__catalogue/v1/manifest.json'
  const projected=await request(manifestPath);const body=await projected.text()
  gate(projected.status===200&&projected.headers.get('X-Robots-Tag')?.includes('noindex')
    &&projected.headers.get('Cache-Control')?.includes('no-store'),'PUBLIC_PREVIEW_ASSET_POLICY')
  gate(sha256(body)===sha256(await readFile(path.join(buildRoot,'assets',manifestPath.slice(1)))),'PUBLIC_PREVIEW_SERVED_SNAPSHOT_HASH')
  const manifest=JSON.parse(body)
  const category=manifest.categories[0],listing=category?.listings?.[0],product=category?.homeProducts?.[0]
  gate(category&&listing&&product,'PUBLIC_PREVIEW_ROUTE_SAMPLE_REQUIRED')
  const paths=[`/${category.slug}`,`/${category.slug}/${listing.slug}`,product.url,'/lien-he','/ve-chung-toi']
  for(const pathname of paths) {
    const response=await request(pathname);const html=await response.text()
    gate(response.status===200&&response.headers.get('X-DPG-Source-SHA')===sourceSha
      &&response.headers.get('X-Robots-Tag')?.includes('noindex'),'PUBLIC_PREVIEW_REAL_ROUTE')
    if(pathname===product.url) gate(html.includes('Liên hệ')&&!html.includes('Mã fixture:'),'PUBLIC_PREVIEW_CONTACT_PRICING')
  }
  const missing=await request('/not-a-public-catalogue-route-160')
  gate(missing.status===404,'PUBLIC_PREVIEW_UNKNOWN_ROUTE')
  return {contract:'dpg:public-real-catalogue-preview:v1',sourceCommit:sourceSha,checkpoint,m3RunId,
    previewUrl:baseUrl,publicProducts:state.publicProducts,listingProducts:state.listingProducts,
    servedSnapshotHash:sha256(body),routesChecked:paths.length,unknownRoute:404,prices:'CONTACT_ONLY',admin:'deferred',productionDns:'HOLD'}
}
function parseArgs(args) { const out={};for(let i=0;i<args.length;i+=2){gate(args[i]?.startsWith('--')&&args[i+1],'PUBLIC_PREVIEW_ARGUMENT');out[args[i].slice(2)]=args[i+1]}return out }
async function main() {
  const [mode,...rest]=process.argv.slice(2);const args=parseArgs(rest)
  let result
  if(mode==='preflight')result=await publicOnlyPreflight({buildRoot:path.resolve(args['build-root']),sourceSha:args['source-sha'],
    workflowRunId:args['workflow-run-id'],checkpoint:args.checkpoint,m3RunId:args['m3-run-id'],pullRequest:Number(args['pr-number'])})
  else if(mode==='confirm-free')result=await confirmWorkersFree({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,apiToken:process.env.CLOUDFLARE_API_TOKEN,
    attestation:process.env.DIRECT_CLOUDFLARE_FREE_ATTESTATION})
  else if(mode==='verify-https')result=await verifySnapshotHttps({baseUrl:args.url,sourceSha:args['source-sha'],checkpoint:args.checkpoint,
    m3RunId:args['m3-run-id'],buildRoot:path.resolve(args['build-root'])})
  else throw new Error('PUBLIC_PREVIEW_MODE')
  await writeFile(args.output,JSON.stringify(result,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify({status:'PASS',unit:mode,...(mode==='confirm-free'?{workersFreeConfirmed:true}:{sourceCommit:result.sourceCommit,checkpoint:result.checkpoint,previewUrl:result.previewUrl})}))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  const reason=/^[A-Z_0-9]+$/.test(error?.message??'')?error.message:'PROTECTED_PREVIEW_FAILED'
  console.error('PUBLIC_PREVIEW status=STOP reason='+reason);process.exitCode=1
})
