// Bounded read-only diagnostic for the exact rejected Preview version.
import {spawn} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {exceptionCategory,createTailCollector} from './preview-diagnostic-safety.mjs'
const worker='dongphugia-v1-public-preview',version='0ecbc1a2-dd99-4330-bde6-8fcca77ffb1f'
const paths=['/','/thiet-bi-ve-sinh/lavabo','/thiet-bi-bep/voi-rua-chen','/vat-lieu-nuoc/loc-nuoc','/gach-op-lat/gach-op-lat']
const report={contract:'dpg:preview-p0-diagnostic:v1',version,requests:[],exceptions:[],tailExit:null}
const child=spawn(process.execPath,[process.env.WRANGLER_BIN,'tail',worker,'--format=json','--status=error','--ip=self','--version-id='+version],{stdio:['ignore','pipe','pipe']})
const collector=createTailCollector(e=>{for(const ex of e.exceptions??[])report.exceptions.push({name:['Error','TypeError','RangeError','AbortError'].includes(ex.name)?ex.name:'OTHER',category:exceptionCategory(ex.message)})})
child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>collector.feed(chunk))
child.stderr.resume() // Never persist CLI auth headers, account profile or raw logs.
const exited=new Promise(resolve=>child.on('exit',code=>{report.tailExit=code;resolve(null)}))
child.on('error',()=>{report.tailExit=-1})
try {
 await new Promise(r=>setTimeout(r,6000))
 const deadline=Date.now()+60000
 outer:for(let round=0;round<4;round++)for(const host of ['pr-196','0ecbc1a2'])for(const path of paths){
  if(Date.now()>deadline)break outer
  const url=`https://${host}-${worker}.tranhuunguyenhuy.workers.dev${path}`
  const start=Date.now()
  try {const r=await fetch(url,{signal:AbortSignal.timeout(10000)});const b=await r.arrayBuffer();report.requests.push({host,path,status:r.status,ms:Date.now()-start,bytes:b.byteLength,ray:r.headers.get('cf-ray')})}catch{report.requests.push({host,path,status:0,ms:Date.now()-start})}
 }
 await new Promise(r=>setTimeout(r,4000))
}finally{child.kill('SIGTERM');await Promise.race([exited,new Promise(r=>setTimeout(r,2000))])}
report.tailState={...collector.stats(),setupUnavailable:report.tailExit!==null&&report.tailExit!==0}
await writeFile(process.env.DIAGNOSTIC_OUTPUT,JSON.stringify(report,null,2),{mode:0o600})
console.log(JSON.stringify({requests:report.requests.length,failures:report.requests.filter(r=>r.status!==200).length,exceptions:report.exceptions,tailExit:report.tailExit}))
