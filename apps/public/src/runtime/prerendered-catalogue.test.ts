import {beforeEach,it,expect,vi} from 'vitest'
import {gzipSync} from 'node:zlib'
import {servePrerenderedCatalogue,prerenderRouteKey} from './prerendered-catalogue'
const source='a'.repeat(40),checkpoint='b'.repeat(40)
beforeEach(()=>{vi.stubEnv('PUBLIC_CATALOGUE_CHECKPOINT',checkpoint)})
function environment(){return {ASSETS:{fetch:vi.fn(async(url:string)=>url.endsWith('ready.json')?Response.json({status:'COMPLETE',sourceSha:source,checkpoint}):new Response(new Uint8Array(gzipSync('canonical public content'))))}}}
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
it('normalizes only supported navigation and prevents route traversal/filters',()=>{
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?page=1&_rsc=x&utm_source=test'))).toBe('/thiet-bi-bep/voi-rua-chen')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?page=2'))).toBe('/thiet-bi-bep/voi-rua-chen?page=2')
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?price=1'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a'))).toBe('/thiet-bi-bep?brands=brand-a')
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-b'))).toBe('/thiet-bi-bep')
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,,brand-b'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?brands=brand-a,brand-a'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/voi-rua-chen?brands=brand-a'))).toBeNull()
  expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep?page=2'))).toBeNull()
 expect(prerenderRouteKey(new URL('https://preview.invalid/thiet-bi-bep/%2fprivate'))).toBeNull()
})
