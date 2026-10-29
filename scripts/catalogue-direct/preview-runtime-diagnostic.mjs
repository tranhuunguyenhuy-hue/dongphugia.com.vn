// Bounded read-only diagnostic for the exact rejected Preview version.
import {spawn} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
const worker='dongphugia-v1-public-preview',version='0ecbc1a2-dd99-4330-bde6-8fcca77ffb1f'
const paths=['/','/thiet-bi-ve-sinh/lavabo','/thiet-bi-bep/voi-rua-chen','/vat-lieu-nuoc/loc-nuoc','/gach-op-lat/gach-op-lat']
const report={contract:'dpg:preview-p0-diagnostic:v1',version,requests:[],exceptions:[],tailExit:null}
const safeMessage=s=>String(s).split('\n')[0].replace(/https?:\/\/[^\s"']+/g,'<url>').replace(/[\w.+-]+@[\w.-]+/g,'<email>').replace(/(['"`]).*?\1/g,'<value>').replace(/[A-Za-z0-9_\/-]{30,}/g,'<redacted>').slice(0,240)
const child=spawn(process.execPath,[process.env.WRANGLER_BIN,'tail',worker,'--format=json','--status=error','--ip=self','--version-id='+version],{stdio:['ignore','pipe','pipe']})
let buffer='',recording=false
child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{
 for(const line of chunk.split('\n')) {
  if(!recording&&line.trim()==='{'){recording=true;buffer=''}
  if(!recording)continue
  buffer+=line+'\n';if(buffer.length>100000){buffer='';recording=false;continue}
  try {const e=JSON.parse(buffer);recording=false;buffer='';for(const ex of e.exceptions??[])report.exceptions.push({name:['Error','TypeError','RangeError','AbortError'].includes(ex.name)?ex.name:'OTHER',message:safeMessage(ex.message)})}catch{}
 }
})
child.stderr.resume() // Never persist CLI auth headers, account profile or raw logs.
child.on('exit',code=>report.tailExit=code)
try {
 await new Promise(r=>setTimeout(r,6000))
 for(let round=0;round<4;round++)for(const host of ['pr-196','0ecbc1a2'])for(const path of paths){
  const url=`https://${host}-${worker}.tranhuunguyenhuy.workers.dev${path}`
  const start=Date.now()
  try {const r=await fetch(url,{signal:AbortSignal.timeout(10000)});const b=await r.arrayBuffer();report.requests.push({host,path,status:r.status,ms:Date.now()-start,bytes:b.byteLength,ray:r.headers.get('cf-ray')})}catch{report.requests.push({host,path,status:0,ms:Date.now()-start})}
 }
 await new Promise(r=>setTimeout(r,4000))
}finally{child.kill('SIGTERM')}
await writeFile(process.env.DIAGNOSTIC_OUTPUT,JSON.stringify(report,null,2),{mode:0o600})
console.log(JSON.stringify({requests:report.requests.length,failures:report.requests.filter(r=>r.status!==200).length,exceptions:report.exceptions,tailExit:report.tailExit}))
