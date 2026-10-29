import {beforeEach,it,expect,vi} from 'vitest'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {servePrerenderedCatalogue,prerenderRouteKey} from './prerendered-catalogue'
const source='a'.repeat(40),checkpoint='b'.repeat(40)
beforeEach(()=>{vi.stubEnv('PUBLIC_CATALOGUE_CHECKPOINT',checkpoint)})
const manifest=()=>({contract:'dpg:public-catalogue-snapshot:v1',checkpoint,categories:[
 {slug:'thiet-bi-ve-sinh',brands:[]},
 {slug:'thiet-bi-bep',brands:[{slug:'brand-a',name:'Brand A'},{slug:'brand-b',name:'Brand B'}]},
 {slug:'vat-lieu-nuoc',brands:[]},
 {slug:'gach-op-lat',brands:[]},
]})
function environment(options:{manifestBody?:string;manifestStatus?:number}={}){return {ASSETS:{fetch:vi.fn(async(url:string)=>{
 if(url.endsWith('ready.json'))return Response.json({status:'COMPLETE',sourceSha:source,checkpoint})
 if(url.endsWith('/__catalogue/v1/manifest.json'))return new Response(options.manifestBody??JSON.stringify(manifest()),{status:options.manifestStatus??200})
 return new Response(new Uint8Array(gzipSync('canonical public content')))
})}}}
it('serves complete immutable content without SSR with explicit Flight/HTML encoding',async()=>{
 const env=environment()
 const html=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep/voi-rua-chen'),env,source)
 expect(html?.status).toBe(200);expect(html?.headers.get('X-DPG-Render')).toBe('PRERENDER');expect(await html?.text()).toBe('canonical public content')
 const rsc=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep/voi-rua-chen?_rsc=one',{headers:{RSC:'1','Accept-Encoding':'gzip'}}),env,source)
 expect(rsc?.headers.get('content-type')).toContain('text/x-component');expect(rsc?.headers.get('content-encoding')).toBe('gzip');expect(env.ASSETS.fetch.mock.calls.at(-1)?.[0]).toMatch(/\.rsc\.gz$/)
 expect(rsc?.headers.get('cache-control')).toContain('no-store');expect(rsc?.headers.get('x-robots-tag')).toContain('noindex')
})
it('requires complete exact checkpoint and restricts build rendering to loopback',async()=>{
 const missing={ASSETS:{fetch:async()=>new Response('missing',{status:404})},CATALOGUE_BUILD_RENDER:'true'}
 expect(await servePrerenderedCatalogue(new Request('http://127.0.0.1:8790/'),missing,source)).toBeNull()
 expect((await servePrerenderedCatalogue(new Request('https://preview.invalid/'),missing,source))?.status).toBe(503)
 expect((await servePrerenderedCatalogue(new Request('https://preview.invalid/',{method:'POST'}),missing,source))?.status).toBe(405)
})
it('serves one shared HTML and Flight asset key for every category-root brand selection',async()=>{
 const env=environment()
 const html=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-b'),env,source)
 const htmlAsset=env.ASSETS.fetch.mock.calls.at(-1)?.[0]
 const rsc=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-b',{headers:{RSC:'1'}}),env,source)
 const rscAsset=env.ASSETS.fetch.mock.calls.at(-1)?.[0]
 const rootDigest=createHash('sha256').update('/thiet-bi-bep').digest('hex')
 expect(html?.status).toBe(200)
 expect(htmlAsset).toContain(rootDigest+'.html.gz')
 expect(rsc?.headers.get('content-type')).toContain('text/x-component')
 expect(rscAsset).toContain(rootDigest+'.rsc.gz')
 expect(env.ASSETS.fetch.mock.calls.filter(call=>call[0].endsWith('/__catalogue/v1/manifest.json'))).toHaveLength(2)
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a'))).toBe('/thiet-bi-bep')
})
it('serves filtered Listing deep links through one bounded HTML and Flight page asset',async()=>{
 const env=environment()
 const routeKey='/thiet-bi-bep/voi-rua-chen?page=2'
 const routeDigest=createHash('sha256').update(routeKey).digest('hex')
 const html=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brand=brand-a,brand-b&page=2'),env,source)
 const htmlAsset=env.ASSETS.fetch.mock.calls.at(-1)?.[0]
 const rsc=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brand=brand-b&page=2&_rsc=flight',{headers:{RSC:'1'}}),env,source)
 const rscAsset=env.ASSETS.fetch.mock.calls.at(-1)?.[0]
 expect(html?.status).toBe(200)
 expect(htmlAsset).toContain(routeDigest+'.html.gz')
 expect(rsc?.headers.get('content-type')).toContain('text/x-component')
 expect(rscAsset).toContain(routeDigest+'.rsc.gz')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brand=brand-b&is_featured=true&page=2'))).toBe(routeKey)
})
it('returns 404 for a syntactically valid brand absent from the public root snapshot',async()=>{
 const env=environment()
 const response=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep?brands=unknown-brand'),env,source)
 expect(response?.status).toBe(404)
 expect(env.ASSETS.fetch.mock.calls.some(call=>call[0].includes(createHash('sha256').update('/thiet-bi-bep').digest('hex')))).toBe(false)
})
it('fails closed on oversized readiness and root manifest assets',async()=>{
 const oversizedReady={ASSETS:{fetch:async(url:string)=>url.endsWith('ready.json')
   ?new Response(new Uint8Array(4_097))
   :new Response(new Uint8Array(gzipSync('canonical public content')))}}
 expect((await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep'),oversizedReady,source))?.status).toBe(503)
 const oversizedManifest=environment({manifestBody:'x'.repeat(2_000_001)})
 expect((await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep?brands=brand-a'),oversizedManifest,source))?.status).toBe(503)
})
it.each([
 ['missing snapshot manifest',{manifestStatus:404}],
 ['malformed JSON snapshot manifest',{manifestBody:'not-json'}],
 ['wrong snapshot contract',{manifestBody:JSON.stringify({...manifest(),contract:'other'})}],
 ['wrong snapshot checkpoint',{manifestBody:JSON.stringify({...manifest(),checkpoint:'c'.repeat(40)})}],
 ['missing root brand metadata',{manifestBody:JSON.stringify({...manifest(),categories:manifest().categories.map(category=>category.slug==='thiet-bi-bep'?{slug:category.slug}:category)})}],
 ['malformed root brand metadata',{manifestBody:JSON.stringify({...manifest(),categories:manifest().categories.map(category=>category.slug==='thiet-bi-bep'?{...category,brands:[{slug:'Bad Slug',name:'Bad'}]}:category)})}],
])('returns 503 for %s',async(_label,options)=>{
 const env=environment(options)
 const response=await servePrerenderedCatalogue(new Request('https://preview.invalid/thiet-bi-bep?brands=brand-a'),env,source)
 expect(response?.status).toBe(503)
 expect(env.ASSETS.fetch.mock.calls.some(call=>call[0].includes(createHash('sha256').update('/thiet-bi-bep').digest('hex')))).toBe(false)
})
it('normalizes only supported navigation and prevents route traversal/filters',()=>{
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?page=1&_rsc=x&utm_source=test'))).toBe('/thiet-bi-bep/voi-rua-chen')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?page=2'))).toBe('/thiet-bi-bep/voi-rua-chen?page=2')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brand=brand-a,brand-b&is_featured=true&page=2&_rsc=flight'))).toBe('/thiet-bi-bep/voi-rua-chen?page=2')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brand=brand-a,brand-a'))).toBeNull()
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?price=1'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a'))).toBe('/thiet-bi-bep')
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-b'))).toBe('/thiet-bi-bep')
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-b,brand-a'))).toBe('/thiet-bi-bep')
  expect(prerenderRouteKey(new URL(`https://preview.invalid/thiet-bi-bep?brands=${Array.from({length:21},(_,i)=>`brand-${i}`).join(',')}`))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,,brand-b'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-a'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brands=brand-a'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?page=2'))).toBeNull()
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/%2fprivate'))).toBeNull()
})
