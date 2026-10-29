// Actual public-snapshot request regression; never a browser/Owner-acceptance claim.
import {writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const HOST=/^(?:pr-[1-9][0-9]*|[a-f0-9]{8})-dongphugia-v1-public-preview\.tranhuunguyenhuy\.workers\.dev$/
function approved(value){const u=new URL(value);if(u.protocol!=='https:'||!HOST.test(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('LOAD_PROBE_TARGET');return u}
async function boundedText(response){const reader=response.body?.getReader();if(!reader)return {text:'',bytes:0};const parts=[];let bytes=0;for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>2000000){await reader.cancel();throw new Error('LOAD_PROBE_RESPONSE_CAP')}parts.push(r.value)}const joined=new Uint8Array(bytes);let at=0;for(const p of parts){joined.set(p,at);at+=p.byteLength}return {text:new TextDecoder().decode(joined),bytes}}
export async function runLoadRegression({urls,sourceSha,checkpoint,repeats=2,fetchImpl=fetch}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha)||!/^[a-f0-9]{40}$/.test(checkpoint)||!Number.isInteger(repeats)||repeats<1||repeats>3)throw new Error('LOAD_PROBE_IDENTITY')
 const records=[]
 const reasons=new Set(['LOAD_PROBE_RESPONSE_CAP','LOAD_PROBE_REDIRECT'])
 for(const value of urls){const base=approved(value);const mr=await fetchImpl(new URL('/__catalogue/v1/manifest.json',base),{redirect:'manual',signal:AbortSignal.timeout(12000)});const manifest=JSON.parse((await boundedText(mr)).text);if(mr.status!==200||manifest.checkpoint!==checkpoint||manifest.contract!=='dpg:public-catalogue-snapshot:v1')throw new Error('LOAD_PROBE_MANIFEST')
  if(new Set(manifest.categories.map(c=>c.slug)).size!==4)throw new Error('LOAD_PROBE_FOUR_FAMILIES_REQUIRED')
  const paths=['/'];for(const c of manifest.categories){const l=c.listings[0],p=c.homeProducts[0];if(!l||!p)throw new Error('LOAD_PROBE_SAMPLE');paths.push('/'+c.slug,'/'+c.slug+'/'+l.slug,p.url);if(l.totalCount>48)paths.push('/'+c.slug+'/'+l.slug+'?page=2')}
  for(let n=0;n<repeats;n++)for(const path of paths)for(const mode of ['html','rsc']){
   const start=Date.now();let target=new URL(path,base);if(mode==='rsc')target.searchParams.set('_rsc','')
   let record={host:base.hostname,path,repeat:n,mode,status:0,bytes:0,ms:0,pass:false}
   try {let response;for(let hop=0;hop<3;hop++){response=await fetchImpl(target,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{...(mode==='rsc'?{'RSC':'1'}:{Accept:'text/html'}),'User-Agent':n%2?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 PreviewStabilityProbe'}});if(![307,308].includes(response.status))break;const next=new URL(response.headers.get('location'),target);if(next.origin!==base.origin)throw new Error('LOAD_PROBE_REDIRECT');await response.body?.cancel();target=next}
    const body=await boundedText(response);const type=response.headers.get('content-type')??'';record={...record,status:response.status,bytes:body.bytes,ray:response.headers.get('cf-ray'),failureCategory:response.headers.get('x-dpg-render-failure'),pass:response.status===200&&response.headers.get('x-dpg-source-sha')===sourceSha&&(mode==='rsc'?type.includes('text/x-component')&&/^[0-9a-f]+:/m.test(body.text.slice(0,1000))&&!/^[0-9a-f]+:E\{/m.test(body.text):type.includes('text/html')&&body.text.includes('<h1')&&body.text.includes('</html>'))}
   }catch(error){record.reason=reasons.has(error?.message)?error.message:'NETWORK_OR_STREAM_FAILURE'}
   record.ms=Date.now()-start;records.push(record)
  }
 }
 return {contract:'dpg:preview-load-regression:v1',sourceSha,checkpoint,requests:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass).length,records,browserAcceptance:'SEPARATE_GATE',ownerAcceptance:'PENDING',productionDns:'HOLD'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].slice(2)]=process.argv[i+1];runLoadRegression({urls:[args.url,args['version-url']],sourceSha:args['source-sha'],checkpoint:args.checkpoint}).then(async report=>{await writeFile(args.output,JSON.stringify(report,null,2));console.log(JSON.stringify({requests:report.requests,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1}).catch(()=>{console.error('LOAD_REGRESSION_STOP');process.exitCode=1})}
