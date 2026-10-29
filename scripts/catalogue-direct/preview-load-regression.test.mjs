import {it,expect} from 'vitest'
import {runLoadRegression} from './preview-load-regression.mjs'
const sha='a'.repeat(40),checkpoint='b'.repeat(40),url='https://pr-199-dongphugia-v1-public-preview.tranhuunguyenhuy.workers.dev'
const manifest={contract:'dpg:public-catalogue-snapshot:v1',checkpoint,categories:['thiet-bi-ve-sinh','thiet-bi-bep','vat-lieu-nuoc','gach-op-lat'].map(slug=>({slug,listings:[{slug:'listing',totalCount:60}],homeProducts:[{url:`/${slug}/listing/product`}]}))}
function transport(fail){return async(u,options)=>{
 const x=new URL(u)
 if(x.pathname.includes('/__catalogue/'))return new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}})
 const rsc=options.headers.RSC==='1';const status=fail&&x.pathname.includes('/product')?500:200
 return new Response(rsc?'0:{"ok":true}':'<html><h1>Public product</h1></html>',{status,headers:{'content-type':rsc?'text/x-component':'text/html','X-DPG-Source-SHA':sha}})
}}
it('covers every family, paging and HTML/RSC, rejecting actual failures',async()=>{
 const r=await runLoadRegression({urls:[url],sourceSha:sha,checkpoint,repeats:2,fetchImpl:transport(true)})
 expect(r.requests).toBe(68);expect(r.failed).toBe(16);expect(r.records.some(x=>x.path.endsWith('?page=2'))).toBe(true)
})
it('does not equate request proof with browser or Owner acceptance',async()=>{
 const r=await runLoadRegression({urls:[url],sourceSha:sha,checkpoint,repeats:1,fetchImpl:transport(false)})
 expect(r.failed).toBe(0);expect(r.browserAcceptance).toBe('SEPARATE_GATE');expect(r.ownerAcceptance).toBe('PENDING')
 await expect(runLoadRegression({urls:['https://private.example'],sourceSha:sha,checkpoint})).rejects.toThrow('TARGET')
})
it('rejects streamed Flight errors even when HTTP status is 200',async()=>{
 const fetchImpl=async(u,options)=>{
  if(options?.headers?.RSC==='1')return new Response('0:{"partial":true}\n1:E{"digest":"render-error"}\n',{headers:{'content-type':'text/x-component','X-DPG-Source-SHA':sha}})
  return transport(false)(u,options)
 }
 const r=await runLoadRegression({urls:[url],sourceSha:sha,checkpoint,repeats:1,fetchImpl})
 expect(r.requests).toBe(34);expect(r.failed).toBe(17);expect(r.records.filter(x=>x.mode==='rsc').every(x=>!x.pass&&x.status===200)).toBe(true)
})
