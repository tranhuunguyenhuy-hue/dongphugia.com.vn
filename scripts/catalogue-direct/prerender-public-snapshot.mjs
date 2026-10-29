// Render only the existing public DTO through the canonical local Worker.
// Each completed route is durable and hash-checked before reuse; no DB access.
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {gzipSync} from 'node:zlib'
import {resolve,join,relative,isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
const SHA=/^[a-f0-9]{40}$/
const hash=b=>createHash('sha256').update(b).digest('hex')
const gate=(v,code)=>{if(!v)throw new Error(code)}
export function renderPaths(manifest,products){
 gate(manifest.contract==='dpg:public-catalogue-snapshot:v1'&&manifest.categories.length===4&&new Set(manifest.categories.map(c=>c.slug)).size===4,'RENDER_MANIFEST')
 const paths=new Set(['/','/lien-he','/ve-chung-toi'])
 for(const c of manifest.categories){
  gate(['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'].includes(c.slug),'RENDER_FAMILY')
  paths.add('/'+c.slug)
  const rootBrands=c.brands??c.homeProducts?.flatMap(p=>p.brands?[p.brands]:[])??[]
  const brandSlugs=new Set(rootBrands.map(b=>b.slug))
  for(const brandSlug of brandSlugs){gate(typeof brandSlug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brandSlug),'RENDER_BRAND');paths.add('/'+c.slug+'?brands='+brandSlug)}
  for(const l of c.listings){
   gate(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(l.slug)&&Number.isSafeInteger(l.totalCount)&&l.totalCount>0,'RENDER_LISTING')
   const base=`/${c.slug}/${l.slug}`;paths.add(base)
   for(let page=2;page<=Math.ceil(l.totalCount/(c.slug==='thiet-bi-ve-sinh'?12:24));page++)paths.add(base+'?page='+page)
  }
 }
 const urls=new Set()
 for(const p of products){gate(typeof p.url==='string'&&/^\/(?:thiet-bi-ve-sinh|thiet-bi-bep|vat-lieu-nuoc|gach-op-lat)\/[a-z0-9-]+\/[a-z0-9-]+$/.test(p.url)&&!urls.has(p.url),'RENDER_PRODUCT');urls.add(p.url);paths.add(p.url)}
 gate(urls.size===manifest.products&&paths.size<9000,'RENDER_COVERAGE')
 return [...paths].sort()
}
export async function prerender({assetsRoot,checkpointRoot,baseUrl,sourceSha,checkpoint,extractFlight,fetchImpl=fetch,concurrency=3}){
 const base=new URL(baseUrl)
 gate(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)&&base.pathname==='/'&&!base.username&&!base.password&&!base.search&&!base.hash,'RENDER_LOOPBACK_ONLY')
 gate(SHA.test(sourceSha)&&SHA.test(checkpoint)&&Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=4,'RENDER_IDENTITY')
 const catalogue=join(assetsRoot,'__catalogue/v1'),manifestBytes=await readFile(join(catalogue,'manifest.json')),manifest=JSON.parse(manifestBytes)
 gate(manifest.checkpoint===checkpoint,'RENDER_CHECKPOINT')
 const products=[]
 for(const b of manifest.productBuckets){gate(/^[a-f0-9]{2}$/.test(b),'RENDER_BUCKET');const data=JSON.parse(await readFile(join(catalogue,'products',b+'.json')));gate(data.checkpoint===checkpoint,'RENDER_BUCKET_CHECKPOINT');products.push(...data.products)}
 const inside=relative(resolve(assetsRoot),resolve(checkpointRoot))
 gate(inside==='..'||inside.startsWith('../')||isAbsolute(inside),'RENDER_CHECKPOINT_OUTSIDE_ASSETS_REQUIRED')
 const paths=renderPaths(manifest,products),root=join(checkpointRoot,'v1',sourceSha,checkpoint)
 await mkdir(root,{recursive:true})
 const progressPath=join(root,'progress.json')
 let progress={contract:'dpg:canonical-prerender:v1',sourceSha,checkpoint,snapshotHash:hash(manifestBytes),total:paths.length,completed:{}}
 try{const old=JSON.parse(await readFile(progressPath));gate(old.sourceSha===sourceSha&&old.checkpoint===checkpoint&&old.snapshotHash===progress.snapshotHash&&old.total===paths.length,'RENDER_RESUME_IDENTITY');progress=old}catch(error){if(error.code!=='ENOENT')throw error}
 let compressedBytes=0,reused=0
 for(const [key,e] of Object.entries(progress.completed)){
  gate(paths.includes(key),'RENDER_RESUME_ROUTE')
  for(const kind of ['html','rsc']){const bytes=await readFile(join(root,hash(key)+'.'+kind+'.gz'));gate(hash(bytes)===e[kind].sha256,'RENDER_RESUME_HASH');compressedBytes+=bytes.length}
  reused++
 }
 // Wait for this task's local Worker, without accepting another source candidate.
 let ready=false
 for(let n=0;n<40;n++){
  try{const r=await fetchImpl(new URL('/api/health',base),{signal:AbortSignal.timeout(1000),redirect:'error'});ready=r.status===200&&r.headers.get('x-dpg-source-sha')===sourceSha;await r.body?.cancel();if(ready)break}catch{}
  await new Promise(r=>setTimeout(r,250))
 }
 gate(ready,'RENDER_LOCAL_NOT_READY')
 let index=0,stopped=false,writeQueue=Promise.resolve()
 const save=()=>{const snapshot=JSON.stringify(progress);writeQueue=writeQueue.then(async()=>{await writeFile(progressPath+'.tmp',snapshot,{mode:0o600});await rename(progressPath+'.tmp',progressPath)});return writeQueue}
 await save()
 const pending=paths.filter(p=>!Object.hasOwn(progress.completed,p))
 const task=async()=>{while(!stopped){const key=pending[index++];if(!key)return
  try{
   const response=await fetchImpl(new URL(key,base),{redirect:'error',signal:AbortSignal.timeout(30000),headers:{Accept:'text/html'}})
   gate(response.status===200&&response.headers.get('x-dpg-source-sha')===sourceSha&&response.headers.get('content-type')?.includes('text/html')&&!response.headers.has('set-cookie'),'RENDER_HTTP')
   const html=await response.text();gate(Buffer.byteLength(html)<=2000000&&html.includes('<h1')&&html.includes('</html>'),'RENDER_HTML')
   const flight=extractFlight(html);gate(flight,'RENDER_FLIGHT_MISSING')
   const flightText=new TextDecoder().decode(flight);gate(!/^[0-9a-f]+:E\{/m.test(flightText)&&/^[0-9a-f]+:/m.test(flightText),'RENDER_FLIGHT_ERROR')
   const entry={}
   for(const [kind,body] of [['html',html],['rsc',flight]]){
    const bytes=gzipSync(body,{level:9});compressedBytes+=bytes.length;gate(compressedBytes<=200000000,'RENDER_BYTE_CAP')
    await writeFile(join(root,hash(key)+'.'+kind+'.gz'),bytes,{mode:0o600});entry[kind]={sha256:hash(bytes),bytes:bytes.length}
   }
   progress.completed[key]=entry;await save()
  }catch(error){stopped=true;throw error}
 }}
 const outcomes=await Promise.allSettled(Array.from({length:concurrency},task));await writeQueue
 const failed=outcomes.find(o=>o.status==='rejected');if(failed)throw failed.reason
 gate(Object.keys(progress.completed).length===paths.length,'RENDER_INCOMPLETE')
 const proof={contract:progress.contract,status:'COMPLETE',sourceSha,checkpoint,snapshotHash:progress.snapshotHash,routes:paths.length,products:manifest.products,compressedBytes,reused,rendering:'CANONICAL_WORKER_HTML_AND_EMBEDDED_FLIGHT',productionDns:'HOLD'}
 await writeFile(join(root,'ready.json'),JSON.stringify(proof),{mode:0o600})
 return proof
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].slice(2)]=process.argv[i+1]
 const adapterUrl=pathToFileURL(resolve('apps/public/node_modules/vinext/dist/build/prerender.js')).href
 const {extractRscPayloadFromPrerenderedHtml}=await import(/* @vite-ignore */adapterUrl)
 prerender({assetsRoot:resolve(args['assets-root']),checkpointRoot:resolve(args['checkpoint-root']),baseUrl:args['base-url'],sourceSha:args['source-sha'],checkpoint:args.checkpoint,extractFlight:extractRscPayloadFromPrerenderedHtml}).then(p=>console.log(JSON.stringify(p))).catch(error=>{console.error(JSON.stringify({status:'STOP',stage:'CANONICAL_PRERENDER',reason:/^RENDER_[A-Z_]+$/.test(error?.message??'')?error.message:'RENDER_FAILED',checkpointPreserved:true}));process.exitCode=1})
}
