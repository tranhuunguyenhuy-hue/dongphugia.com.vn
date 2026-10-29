import {it,expect} from 'vitest'
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {prerender,renderPaths} from './prerender-public-snapshot.mjs'
const sourceSha='a'.repeat(40),checkpoint='b'.repeat(40)
const families=['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat']
const products=families.map(f=>({url:`/${f}/listing/product`}))
const manifest={contract:'dpg:public-catalogue-snapshot:v1',checkpoint,products:4,productBuckets:['00'],categories:families.map((slug,index)=>({slug,brands:[{slug:`brand-${index}`,name:`Brand ${index}`}],listings:[{slug:'listing',totalCount:25}]}))}
async function fixture(){const root=await mkdtemp(join(tmpdir(),'dpg-public-render-test-'));await mkdir(join(root,'__catalogue/v1/products'),{recursive:true});await writeFile(join(root,'__catalogue/v1/manifest.json'),JSON.stringify(manifest));await writeFile(join(root,'__catalogue/v1/products/00.json'),JSON.stringify({checkpoint,products}));return root}
const ok=async()=>new Response('<html><h1>Actual canonical renderer</h1></html>',{headers:{'content-type':'text/html','x-dpg-source-sha':sourceSha}})
it('enumerates all products and exact canonical family pagination sizes',()=>{
 const paths=renderPaths(manifest,products)
 expect(paths).toHaveLength(20);expect(paths.filter(path=>path.includes('?brands=')).length).toBe(0);expect(paths).toContain('/thiet-bi-ve-sinh/listing?page=3');expect(paths).not.toContain('/thiet-bi-bep/listing?page=3')
 expect(()=>renderPaths({...manifest,products:5},products)).toThrow('COVERAGE')
})
it('preserves completed routes on failure, resumes hashes and rejects tampering',async()=>{
 const assetsRoot=await fixture();let calls=0
 const opts={assetsRoot,checkpointRoot:assetsRoot+'-checkpoint',baseUrl:'http://127.0.0.1:8790',sourceSha,checkpoint,concurrency:1,extractFlight:()=>new TextEncoder().encode('0:{"public":true}\n')}
 await expect(prerender({...opts,fetchImpl:async()=>++calls===4?new Response('failed',{status:503}):ok()})).rejects.toThrow('RENDER_HTTP')
 const root=join(assetsRoot+'-checkpoint','v1',sourceSha,checkpoint),progress=JSON.parse(await readFile(join(root,'progress.json')))
 expect(Object.keys(progress.completed)).toHaveLength(2);await expect(readFile(join(root,'ready.json'))).rejects.toThrow()
 const proof=await prerender({...opts,fetchImpl:ok});expect(proof.routes).toBe(20);expect(proof.reused).toBe(2)
 const file=(await import('node:fs/promises')).readdir;const gzip=(await file(root)).find(p=>p.endsWith('.html.gz'));await writeFile(join(root,gzip),'tampered')
 await expect(prerender({...opts,fetchImpl:ok})).rejects.toThrow('RESUME_HASH')
})
it('fails closed on remote targets and embedded render errors',async()=>{
 const assetsRoot=await fixture()
 await expect(prerender({assetsRoot,checkpointRoot:assetsRoot+'-checkpoint',baseUrl:'https://production.example',sourceSha,checkpoint,extractFlight:()=>null})).rejects.toThrow('LOOPBACK')
 await expect(prerender({assetsRoot,checkpointRoot:assetsRoot+'-checkpoint',baseUrl:'http://127.0.0.1:8790',sourceSha,checkpoint,fetchImpl:ok,extractFlight:()=>new TextEncoder().encode('0:{}\n1:E{"digest":"failed"}\n')})).rejects.toThrow('FLIGHT_ERROR')
})
